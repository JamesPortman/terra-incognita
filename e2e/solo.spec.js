const { test, expect } = require('@playwright/test');

// Start a solo photo game (Street View off so no Google dependency in CI).
async function startSolo(page, { roundSec = 60 } = {}) {
  await page.goto('/?plainmap=1'); // deterministic SVG guess map
  await expect(page.locator('#menuSolo')).toBeVisible();
  // toggle appears once /api/config resolves; uncheck if present
  const toggleRow = page.locator('#modeToggleRow');
  await expect(toggleRow).toBeVisible();
  await page.locator('#deckSelect').selectOption('famous'); // random is the default; famous keeps specs deterministic
  await page.locator('#svToggle').uncheck();
  await page.locator('#roundSecInput').fill(String(roundSec));
  await page.locator('#menuSolo').click();
}

async function guessAndAdvance(page) {
  await expect(page.locator('#goBtn')).toHaveText(/Place a pin to guess/i);
  await page.locator('#map').click(); // element center is always inside the map
  await expect(page.locator('#goBtn')).toHaveText(/Make guess/i);
  await page.locator('#goBtn').click();
  await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
  await expect(page.locator('#ptsReadout')).toHaveText(/\+[\d,]+ pts/);
  await page.locator('#goBtn').click();
}

test.describe('solo game', () => {
  test('plays five rounds to the final screen with a results map', async ({ page }) => {
    await startSolo(page);
    for (let round = 1; round <= 5; round++) {
      await expect(page.locator('#roundLabel')).toHaveText(`${round} / 5`);
      await guessAndAdvance(page);
    }
    await expect(page.locator('#finalScreen')).toBeVisible();
    await expect(page.locator('#finalTotal')).toHaveText(/^[\d,]+$/);
    await expect(page.locator('#finalTable tr')).toHaveCount(5);
    // results map: one numbered guess pin + one actual dot per round
    await expect(page.locator('#finalMap circle')).toHaveCount(10);
    await expect(page.locator('#finalMap text')).toHaveCount(5);

    // play again resets cleanly
    await page.locator('#againBtn').click();
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5');
    await expect(page.locator('#scoreLabel')).toHaveText('0');
  });

  test('times out a round with no pin as +0 pts', async ({ page }) => {
    await startSolo(page, { roundSec: 10 });
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5');
    await expect(page.locator('#distReadout')).toHaveText(/time's up/, { timeout: 20_000 });
    await expect(page.locator('#ptsReadout')).toHaveText('+0 pts');
    await expect(page.locator('#goBtn')).toHaveText(/Next round/i);
  });

  test('back to menu from the final screen', async ({ page }) => {
    await startSolo(page);
    for (let round = 1; round <= 5; round++) await guessAndAdvance(page);
    await page.locator('#finalMenuBtn').click();
    await expect(page.locator('#menuScreen')).toBeVisible();
  });

  test('Expedition complete button confirms before returning to menu', async ({ page }) => {
    await startSolo(page);
    for (let round = 1; round <= 5; round++) await guessAndAdvance(page);
    const goBtn = page.locator('#goBtn');
    await expect(goBtn).toHaveText(/Expedition complete/i);
    await expect(goBtn).toBeEnabled();
    await goBtn.click();
    await expect(goBtn).toHaveText(/Go back to the menu\?/i);
    await goBtn.click();
    await expect(page.locator('#menuScreen')).toBeVisible();
  });

  test('Expedition complete confirm reverts if not confirmed', async ({ page }) => {
    await startSolo(page);
    for (let round = 1; round <= 5; round++) await guessAndAdvance(page);
    await page.locator('#goBtn').click();
    await expect(page.locator('#goBtn')).toHaveText(/Go back to the menu\?/i);
    // do nothing — the ask should revert after ~4s
    await expect(page.locator('#goBtn')).toHaveText(/Expedition complete/i, { timeout: 7_000 });
    await expect(page.locator('#finalScreen')).toBeVisible();
  });
});
