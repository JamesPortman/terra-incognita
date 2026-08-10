const { test, expect } = require('@playwright/test');

// Start a solo photo game (Street View off so no Google dependency in CI).
async function startSolo(page, { roundSec = 60 } = {}) {
  await page.goto('/?plainmap=1'); // deterministic SVG guess map
  await expect(page.locator('#menuSolo')).toBeVisible();
  // toggle appears once /api/config resolves; uncheck if present
  const toggleRow = page.locator('#modeToggleRow');
  await expect(toggleRow).toBeVisible();
  await page.locator('#deckSelect').selectOption('world'); // random is the default; famous keeps specs deterministic
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

  test('shows time spent off-tab on the reveal and final table', async ({ page }) => {
    await startSolo(page);
    await expect(page.locator('#roundLabel')).toHaveText('1 / 5');
    // simulate switching away for ~3.5s during the first round
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.locator('#map').click();
    await page.locator('#goBtn').click();
    await expect(page.locator('#distReadout')).toHaveText(/👀 \d+s off-tab/);
    await page.locator('#goBtn').click();
    // stay on the tab for the remaining rounds — no badge on those
    for (let round = 2; round <= 5; round++) await guessAndAdvance(page);
    await expect(page.locator('#finalScreen')).toBeVisible();
    await expect(page.locator('#finalTable .peek')).toHaveCount(1);
    await expect(page.locator('#finalTable .peek')).toHaveText(/👀\d+s/);
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

test.describe('recorded solo game (random world only)', () => {
  // the server-scored happy path lives in gmap.spec.js (it needs Google);
  // these tests cover the menu rules and Hall hygiene without any network
  test('record toggle is only available for Random world', async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#modeToggleRow')).toBeVisible(); // config loaded
    // famous decks are casual-only
    await expect(page.locator('#recToggle')).toBeDisabled();
    await expect(page.locator('#recToggle')).not.toBeChecked();
    await page.locator('#deckSelect').selectOption('random');
    await expect(page.locator('#recToggle')).toBeEnabled();
    await page.locator('#deckSelect').selectOption('world');
    await expect(page.locator('#recToggle')).toBeDisabled();
    await expect(page.locator('#recToggle')).not.toBeChecked();
  });

  test('recording requires a name (checked before any Maps lookups)', async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#deckSelect').selectOption('random');
    await page.locator('#recToggle').check();
    await page.locator('#joinName').fill('');
    await page.locator('#menuSolo').click();
    await expect(page.locator('#menuErr')).toHaveText(/enter your name/i);
  });

  test('the Hall defaults to group games and never shows test agents', async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#menuLb')).toBeVisible();
    await page.locator('#menuLb').click();
    await expect(page.locator('#lbScreen')).toBeVisible();
    // group board is the default view
    await expect(page.locator('#lbSoloToggle')).not.toBeChecked();
    await expect(page.locator('#lbTable')).not.toContainText('E2E-SoloRec');
    await expect(page.locator('#lbPodium')).not.toContainText('E2E-SoloRec');
    // the solo board is clean of test agents too
    await page.locator('#lbSoloToggle').check();
    await expect(page.locator('#lbTable')).not.toContainText('Loading');
    await expect(page.locator('#lbTable')).not.toContainText('E2E-SoloRec');
    await expect(page.locator('#lbPodium')).not.toContainText('E2E-SoloRec');
  });
});

test.describe('best-five scoring', () => {
  test('a six-round game drops the weakest round and says so', async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#deckSelect').selectOption('world');
    await page.locator('#svToggle').uncheck();
    await page.locator('#roundsInput').fill('6');
    await expect(page.locator('#bestFiveNote')).toBeVisible();
    await page.locator('#menuSolo').click();
    for (let round = 1; round <= 6; round++) {
      await expect(page.locator('#roundLabel')).toHaveText(`${round} / 6`);
      await page.locator('#map').click();
      await expect(page.locator('#goBtn')).toHaveText(/Make guess/i);
      await page.locator('#goBtn').click();
      await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
      await page.locator('#goBtn').click();
    }
    await expect(page.locator('#finalScreen')).toBeVisible();
    await expect(page.locator('#finalOutOf')).toHaveText(/out of 25,000 — best 5 rounds count/);
    await expect(page.locator('#finalTable tr')).toHaveCount(6);
    await expect(page.locator('#finalTable tr', { hasText: '(dropped)' })).toHaveCount(1);
  });
});
