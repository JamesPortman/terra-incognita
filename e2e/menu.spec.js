const { test, expect } = require('@playwright/test');

test.describe('menu', () => {
  test('shows title, actions, and a 60s default round time', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#menuScreen h2')).toHaveText('Terra Incognita');
    await expect(page.locator('#menuSolo')).toBeVisible();
    await expect(page.locator('#menuHost')).toBeVisible();
    await expect(page.locator('#roundSecInput')).toHaveValue('60');
    await expect(page.locator('#roundsInput')).toHaveValue('5');
    await expect(page.locator('#deckSelect')).toHaveValue('random'); // default once config enables it
    await expect(page.locator('#recToggle')).toBeChecked(); // recording defaults on for random
    await expect(page.locator('#timerLabel')).toHaveText('1:00');
    // no game yet — the round counter must not read like one is in progress,
    // or every "the game started" assertion in the suite passes vacuously
    await expect(page.locator('#roundLabel')).toHaveText('–');
  });

  test('day/night toggle flips the theme and persists', async ({ page }) => {
    await page.goto('/');
    const theme = page.locator('#themeBtn');
    await expect(theme).toHaveText('🌙');
    await theme.click();
    await expect(theme).toHaveText('☀️');
    await expect(page.locator('body')).toHaveClass(/day/);
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/day/);
    await page.locator('#themeBtn').click(); // back to night for other specs
    await expect(page.locator('body')).not.toHaveClass(/day/);
  });

  test('language dropdown switches the interface and persists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#menuSolo')).toHaveText('Play solo'); // default English
    await page.locator('#langSelect').selectOption('es');
    await expect(page.locator('#menuSolo')).toHaveText('Jugar solo');
    await expect(page.locator('#menuWeekly')).toHaveText('Expedición semanal');
    await expect(page.locator('#joinName')).toHaveAttribute('placeholder', 'Tu nombre');
    await expect(page.locator('.hud .label').first()).toHaveText('Ronda'); // top bar follows too
    await expect(page.locator('.tagline')).toHaveText('Adivina dónde en la Tierra');
    await page.reload();
    await expect(page.locator('#menuSolo')).toHaveText('Jugar solo'); // persisted
    await page.locator('#langSelect').selectOption('pt');
    await expect(page.locator('#menuSolo')).toHaveText('Jogar sozinho');
    await page.locator('#langSelect').selectOption('en');
    await expect(page.locator('#menuSolo')).toHaveText('Play solo');
  });

  test('?lang= opens the game in any language and remembers it', async ({ page }) => {
    const solo = { en: 'Play solo', es: 'Jugar solo', pt: 'Jogar sozinho', fa: 'بازی تک‌نفره' };
    for (const [lang, text] of Object.entries(solo)) {
      await page.goto(`/?lang=${lang}`);
      await expect(page.locator('#menuSolo')).toHaveText(text);
      await expect(page.locator('#langSelect')).toHaveValue(lang);
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
    }
    await page.goto('/?lang=fa-IR'); // region suffixes are fine
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await page.goto('/'); // remembered without the parameter
    await expect(page.locator('#menuSolo')).toHaveText('بازی تک‌نفره');
    await page.goto('/?lang=xx'); // unknown code: keep the saved choice
    await expect(page.locator('#menuSolo')).toHaveText('بازی تک‌نفره');
    await page.goto('/?lang=en&join=ABCD'); // combines with an invite link
    await expect(page.locator('#menuSolo')).toHaveText('Play solo');
    await expect(page.locator('#joinCode')).toHaveValue('ABCD');
  });

  test('Farsi flips the page right-to-left, and back', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.locator('#langSelect').selectOption('fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('#menuSolo')).toHaveText('بازی تک‌نفره');
    await expect(page.locator('#joinName')).toHaveAttribute('placeholder', 'نام شما');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); // persisted
    await page.locator('#langSelect').selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#menuSolo')).toHaveText('Play solo');
  });

  test('architecture page shares the game theme', async ({ page }) => {
    await page.goto('/architecture');
    await expect(page.locator('h1')).toHaveText('Architecture');
    await expect(page.locator('body')).not.toHaveClass(/day/);
    await page.locator('#themeBtn').click();
    await expect(page.locator('body')).toHaveClass(/day/);
    // the game picks up the same setting…
    await page.goto('/');
    await expect(page.locator('body')).toHaveClass(/day/);
    // …and flipping it in the game flips the architecture page back
    await page.locator('#themeBtn').click();
    await page.goto('/architecture');
    await expect(page.locator('body')).not.toHaveClass(/day/);
  });

  test('mute toggle flips and persists', async ({ page }) => {
    await page.goto('/');
    const mute = page.locator('#muteBtn');
    await expect(mute).toHaveText('🔊');
    await mute.click();
    await expect(mute).toHaveText('🔇');
    await page.reload();
    await expect(page.locator('#muteBtn')).toHaveText('🔇');
  });

  test('rejects joining a room that does not exist', async ({ page }) => {
    await page.goto('/');
    await page.locator('#joinCode').fill('ZZZZ');
    await page.locator('#joinName').fill('E2E-Nobody');
    await page.locator('#menuJoin').click();
    await expect(page.locator('#menuErr')).toHaveText(/room not found/);
  });

// A centred flex scroll container pushes overflow off the TOP, where scrollTop
  // cannot reach it — the menu title and the weekly kicker were being cut in half
  // and could not be scrolled back into view on a short window.
  test('short windows can still reach the top of every panel', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 480 });
    await page.goto('/');

    const geometry = () => page.evaluate(() => {
      const m = document.querySelector('.modal.show');
      const s = m.querySelector('.sheet');
      m.scrollTop = -9999; // ask for the very top
      const mr = m.getBoundingClientRect(), sr = s.getBoundingClientRect();
      return { id: m.id, hiddenAbove: Math.round(mr.top - sr.top), taller: sr.height > mr.height };
    });

    const menu = await geometry();
    expect(menu.taller, 'viewport is too tall to exercise the overflow').toBe(true);
    expect(menu.hiddenAbove, `${menu.id} hides its top`).toBeLessThanOrEqual(0);
    await expect(page.locator('#menuScreen h2')).toBeInViewport();

    // the weekly board is the tallest panel: kicker, table, past weeks, buttons
    await page.locator('#menuWeeklyBoard').click();
    await expect(page.locator('#weeklyScreen')).toBeVisible();
    const weekly = await geometry();
    expect(weekly.hiddenAbove, `${weekly.id} hides its top`).toBeLessThanOrEqual(0);
    await expect(page.locator('#weeklyKicker')).toBeInViewport();

    // and a tall window must still centre the sheet, not top-align it
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.goto('/');
    const gaps = await page.evaluate(() => {
      const m = document.querySelector('.modal.show');
      const mr = m.getBoundingClientRect(), sr = m.querySelector('.sheet').getBoundingClientRect();
      return { above: sr.top - mr.top, below: mr.bottom - sr.bottom };
    });
    expect(gaps.above).toBeGreaterThan(10);
    expect(Math.abs(gaps.above - gaps.below)).toBeLessThanOrEqual(2);
  });

  test('join link prefills the room code', async ({ page }) => {
    await page.goto('/?join=ABCD');
    await expect(page.locator('#joinCode')).toHaveValue('ABCD');
  });
});
