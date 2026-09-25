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

test.describe('map search in Farsi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#langSelect').selectOption('fa'); // the menu is hidden once a game starts
    await page.locator('#deckSelect').selectOption('world');
    await page.locator('#svToggle').uncheck();
    await page.locator('#menuSolo').click();
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5');
  });

  test('in Farsi, Persian names find places and results show in Persian', async ({ page }) => {
    const first = page.locator('#searchResults .item').first();
    // loaded on demand, so retry the query until the names have arrived
    await expect(async () => {
      await page.locator('#searchBox').fill('');
      await page.locator('#searchBox').fill('پاریس');
      await expect(first).toContainText('پاریس', { timeout: 500 });
    }).toPass();
    await expect(first).toContainText('فرانسه'); // country sub-label in Persian too
    await page.locator('#searchBox').press('Enter');
    await expect(page.locator('#searchBox')).toHaveValue('پاریس');
    expect(await page.locator('#map > g').getAttribute('transform')).toMatch(/scale\(6/);
  });

  test('Farsi search ignores Arabic letter forms and zero-width joiners', async ({ page }) => {
    const first = page.locator('#searchResults .item').first();
    await expect(async () => {
      await page.locator('#searchBox').fill('');
      await page.locator('#searchBox').fill('تهران');
      await expect(first).toContainText('تهران', { timeout: 500 });
    }).toPass();
    // Arabic yeh (ي) and kaf (ك) typed on an Arabic keyboard
    await page.locator('#searchBox').fill('مكزيك');
    await expect(first).toContainText('مکزیک');
    // a zero-width non-joiner matches the plain space in "لس آنجلس"
    await page.locator('#searchBox').fill('لس\u200cآنجلس');
    await expect(first).toContainText('لس آنجلس');
    // English still works while the interface is Farsi, shown in Persian
    await page.locator('#searchBox').fill('tokyo');
    await expect(first).toContainText('توکیو');
  });
});
