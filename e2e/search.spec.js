const { test, expect } = require('@playwright/test');

test.describe('map search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?plainmap=1'); // deterministic SVG guess map
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#deckSelect').selectOption('world');
    await page.locator('#svToggle').uncheck();
    await page.locator('#menuSolo').click();
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5');
  });

  test('small-city search (50k+ gazetteer) flies the map to the city', async ({ page }) => {
    const before = await page.locator('#map > g').getAttribute('transform');
    await page.locator('#searchBox').fill('medicine hat');
    const first = page.locator('#searchResults .item').first();
    await expect(first).toContainText('Medicine Hat');
    await expect(first).toContainText('Canada');
    await expect(first).toContainText('city');
    await page.locator('#searchBox').press('Enter');
    const after = await page.locator('#map > g').getAttribute('transform');
    expect(after).not.toBe(before);
    expect(after).toMatch(/scale\(6/);
  });

  test('region search ranks admin regions above same-named cities', async ({ page }) => {
    await page.locator('#searchBox').fill('ontario');
    const first = page.locator('#searchResults .item').first();
    await expect(first).toContainText('Ontario');
    await expect(first).toContainText('Canada'); // the province, not Ontario CA (US city)
    await expect(first).toContainText('region');
    await first.click();
    const t = await page.locator('#map > g').getAttribute('transform');
    expect(t).toMatch(/scale\((?!1\))/); // fitted to the region box, not world view
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
    const first = page.locator('#searchResults .item').first();
    await expect(first).toContainText('São Paulo');
    await expect(first).toContainText('region'); // the Brazilian state ranks first
  });
});
