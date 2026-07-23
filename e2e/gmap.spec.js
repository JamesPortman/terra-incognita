const { test, expect } = require('@playwright/test');

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
    await page.locator('#gmap').click({ position: { x: 200, y: 150 } });
    await expect(page.locator('#goBtn')).toHaveText(/Make guess/i, { timeout: 10_000 });
    await page.locator('#goBtn').click();
    await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
    await expect(page.locator('#ptsReadout')).toHaveText(/\+[\d,]+ pts/);
  });

  test('random world solo round drops into a panorama', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#deckSelect').selectOption('random');
    await page.locator('#roundsInput').fill('1');
    await page.locator('#menuSolo').click();
    // deck resolution can take a few seconds of metadata lookups
    await expect(page.locator('#roundLabel')).toHaveText('1 / 1', { timeout: 45_000 });
    await expect(page.locator('#panobox')).toHaveClass(/active/, { timeout: 20_000 });
    await page.locator('#gmap').click({ position: { x: 220, y: 160 } });
    await expect(page.locator('#goBtn')).toHaveText(/Make guess/i, { timeout: 10_000 });
    await page.locator('#goBtn').click();
    await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
    // reveal names the spot (metadata description or gazetteer city)
    await expect(page.locator('#revealName')).not.toHaveText('');
  });
});
