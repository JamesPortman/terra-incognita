const { test, expect } = require('@playwright/test');

test.describe('map search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?plainmap=1'); // deterministic SVG guess map
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#deckSelect').selectOption('famous');
    await page.locator('#svToggle').uncheck();
    await page.locator('#menuSolo').click();
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5');
  });

  test('city search flies the map to the city', async ({ page }) => {
    const before = await page.locator('#map > g').getAttribute('transform');
    await page.locator('#searchBox').fill('tokyo');
    await expect(page.locator('#searchResults .item').first()).toContainText('Tokyo');
    await page.locator('#searchBox').press('Enter');
    const after = await page.locator('#map > g').getAttribute('transform');
    expect(after).not.toBe(before);
    expect(after).toMatch(/scale\(6/);
  });

  test('country search fits the map to the country', async ({ page }) => {
    await page.locator('#searchBox').fill('braz');
    const first = page.locator('#searchResults .item').first();
    await expect(first).toContainText('Brazil');
    await expect(first).toContainText('country');
    await first.click();
    const t = await page.locator('#map > g').getAttribute('transform');
    expect(t).toMatch(/scale\((?!1\))/); // zoomed in, not scale(1)
  });

  test('accent-insensitive matching finds São Paulo', async ({ page }) => {
    await page.locator('#searchBox').fill('sao paulo');
    await expect(page.locator('#searchResults .item').first()).toContainText('São Paulo');
  });
});
