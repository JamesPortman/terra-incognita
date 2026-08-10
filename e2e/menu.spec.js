const { test, expect } = require('@playwright/test');

test.describe('menu', () => {
  test('shows title, actions, and a 60s default round time', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#menuScreen h2')).toHaveText('Terra Incognita');
    await expect(page.locator('#menuSolo')).toBeVisible();
    await expect(page.locator('#menuHost')).toBeVisible();
    await expect(page.locator('#roundSecInput')).toHaveValue('60');
    await expect(page.locator('#roundsInput')).toHaveValue('5');
    await expect(page.locator('#deckSelect')).toHaveValue('na');
    await expect(page.locator('#timerLabel')).toHaveText('1:00');
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

  test('join link prefills the room code', async ({ page }) => {
    await page.goto('/?join=ABCD');
    await expect(page.locator('#joinCode')).toHaveValue('ABCD');
  });
});
