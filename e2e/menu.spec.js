const { test, expect } = require('@playwright/test');

test.describe('menu', () => {
  test('shows title, actions, and a 60s default round time', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#menuScreen h2')).toHaveText('Terra Incognita');
    await expect(page.locator('#menuSolo')).toBeVisible();
    await expect(page.locator('#menuHost')).toBeVisible();
    await expect(page.locator('#roundSecInput')).toHaveValue('60');
    await expect(page.locator('#timerLabel')).toHaveText('1:00');
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
