const { test, expect } = require('@playwright/test');

// The Google map occasionally swallows a click while its tiles engine is still
// initializing, so a single click is not a reliable way to place a pin. Retry
// until one registers — which is what a real player would do.
async function pinOnGoogleMap(page, position = { x: 210, y: 150 }) {
  await expect(async () => {
    await page.locator('#gmap').click({ position });
    await expect(page.locator('#goBtn')).toHaveText(/Make guess/i, { timeout: 3000 });
  }).toPass({ timeout: 25_000 });
}

// The one spec that exercises the real Google guess map (network-dependent).
// Everything else runs with ?plainmap=1 for determinism.
test.describe('google guess map', () => {
  test('activates when a key is configured and takes a guess', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    // map warms up from init(); the container activates once tiles engine loads
    await expect(page.locator('#gmap')).toHaveClass(/active/, { timeout: 30_000 });
    await expect(page.locator('#map')).toBeHidden();

    await page.locator('#deckSelect').selectOption('world'); // photo round vs the google guess map
    await page.locator('#svToggle').uncheck();
    await page.locator('#menuSolo').click();
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5');

    // click the Google map to drop a pin, then guess
    await pinOnGoogleMap(page, { x: 200, y: 150 });
    await page.locator('#goBtn').click();
    await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
    await expect(page.locator('#ptsReadout')).toHaveText(/\+[\d,]+ pts/);
  });

  test('recorded random solo game reaches the final screen unpersisted', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#deckSelect').selectOption('random');
    await page.locator('#roundsInput').fill('2');
    await page.locator('#joinName').fill('E2E-SoloRec');
    await expect(page.locator('#recToggle')).toBeEnabled();
    await page.locator('#recToggle').check();
    await page.locator('#menuSolo').click();
    await expect(page.locator('#roundLabel')).toHaveText('1 / 2', { timeout: 45_000 });
    for (let round = 1; round <= 2; round++) {
      // wait for the round to be ready before pinning, like the other specs
      await expect(page.locator('#panobox')).toHaveClass(/active/, { timeout: 20_000 });
      await pinOnGoogleMap(page, { x: 210, y: 150 });
      await page.locator('#goBtn').click();
      await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
      await page.locator('#goBtn').click();
    }
    await expect(page.locator('#finalScreen')).toBeVisible();
    await expect(page.locator('#finalTotal')).toHaveText(/^[\d,]+$/);
    // asserts the E2E-name server filter end-to-end
    await expect(page.locator('#finalRank')).toBeVisible();
    await expect(page.locator('#finalRank')).toHaveText(/Test game — not recorded/);
  });

  test('random-world weekly plays panoramas to the standings screen', async ({ page }) => {
    // only meaningful during a Random-world week (e.g. 2026-W34)
    const info = await (await page.request.get('/api/weekly')).json();
    test.skip(info.mode !== 'random', 'famous-deck week — weekly.spec covers it');
    await page.goto('/');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#joinName').fill('E2E-Weekly');
    await page.locator('#menuWeekly').click();
    // first run of the week may chart the deck (metadata lookups take a while)
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5', { timeout: 60_000 });
    for (let round = 1; round <= 5; round++) {
      await expect(page.locator('#panobox')).toHaveClass(/active/, { timeout: 20_000 });
      await pinOnGoogleMap(page, { x: 210, y: 150 });
      await page.locator('#goBtn').click();
      await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
      await page.locator('#goBtn').click();
    }
    await expect(page.locator('#weeklyScreen')).toBeVisible();
    await expect(page.locator('#weeklyHead')).toHaveText(/pts/);
  });

  test('random world solo round drops into a panorama', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#deckSelect').selectOption('random');
    await page.locator('#recToggle').uncheck(); // casual unrecorded game
    await page.locator('#roundsInput').fill('1');
    await page.locator('#menuSolo').click();
    // deck resolution can take a few seconds of metadata lookups
    await expect(page.locator('#roundLabel')).toHaveText('1 / 1', { timeout: 45_000 });
    await expect(page.locator('#panobox')).toHaveClass(/active/, { timeout: 20_000 });
    await pinOnGoogleMap(page, { x: 220, y: 160 });
    await page.locator('#goBtn').click();
    await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
    // reveal names the spot (metadata description or gazetteer city)
    await expect(page.locator('#revealName')).not.toHaveText('');
  });
});
