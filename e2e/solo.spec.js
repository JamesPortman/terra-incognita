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
  test('record toggle is only available for Random world and defaults on', async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#modeToggleRow')).toBeVisible(); // config loaded
    // random world is the default deck, with recording on by default
    await expect(page.locator('#deckSelect')).toHaveValue('random');
    await expect(page.locator('#recToggle')).toBeEnabled();
    await expect(page.locator('#recToggle')).toBeChecked();
    // famous decks are casual-only
    await page.locator('#deckSelect').selectOption('world');
    await expect(page.locator('#recToggle')).toBeDisabled();
    await expect(page.locator('#recToggle')).not.toBeChecked();
    await page.locator('#deckSelect').selectOption('random');
    await expect(page.locator('#recToggle')).toBeEnabled();
    await expect(page.locator('#recToggle')).toBeChecked();
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
    // the solo toggle only appears under the Random world deck filter
    await expect(page.locator('#lbSoloRow')).toBeHidden();
    await expect(page.locator('#lbTable')).not.toContainText('E2E-SoloRec');
    await expect(page.locator('#lbPodium')).not.toContainText('E2E-SoloRec');
    await page.locator('#lbDeckFilter').selectOption('Random world (Street View)');
    await expect(page.locator('#lbSoloRow')).toBeVisible();
    await expect(page.locator('#lbSoloToggle')).not.toBeChecked(); // group is still the default
    await expect(page.locator('#lbSoloNote')).toBeHidden();
    // the solo board announces avg-per-round scoring and is clean of test agents
    await page.locator('#lbSoloToggle').check();
    await expect(page.locator('#lbSoloNote')).toBeVisible();
    await expect(page.locator('#lbTable')).not.toContainText('Loading');
    await expect(page.locator('#lbTable')).not.toContainText('E2E-SoloRec');
    await expect(page.locator('#lbPodium')).not.toContainText('E2E-SoloRec');
    // leaving the Random world filter hides and resets the toggle
    await page.locator('#lbDeckFilter').selectOption('');
    await expect(page.locator('#lbSoloRow')).toBeHidden();
    await expect(page.locator('#lbSoloNote')).toBeHidden();
  });
});

test.describe('leaderboard replay', () => {
  // the write path needs a real recorded game; this pins the view itself
  // against a stubbed row so it stays deterministic
  const GAME = {
    name: 'Adham', score: 9439, rounds: 5, deck: 'World — Famous Places', solo: false,
    detail: [
      { lat: 48.8584, lon: 2.2945, label: 'Eiffel Tower', glat: 45, glon: 5, km: 481, pts: 3900 },
      { lat: 35.0394, lon: 135.7292, label: 'Kinkaku-ji', glat: 34, glon: 134, km: 170, pts: 4600 },
      { lat: -22.9519, lon: -43.2105, label: 'Christ the Redeemer', glat: null, glon: null, km: null, pts: 0 },
    ],
  };

  test('opens a score and maps its rounds against the guesses', async ({ page }) => {
    await page.route('**/api/leaderboard?*deck=*', (route) => route.fulfill({
      json: { top: [{ id: 42, name: 'Adham', score: 9439, deck: 'World — Famous Places', hasDetail: true, playedAt: '2026-08-04T16:57:42Z' }], pastSeasons: [] },
    }));
    await page.route('**/api/leaderboard?detail=42', (route) => route.fulfill({ json: GAME }));

    await page.goto('/?plainmap=1');
    await expect(page.locator('#menuLb')).toBeVisible();
    await page.locator('#menuLb').click();
    await page.locator('#lbDeckFilter').selectOption('World — Famous Places');

    const row = page.locator('#lbPodium [data-detail="42"]');
    await expect(row).toBeVisible();
    await row.click();

    await expect(page.locator('#detailScreen')).toBeVisible();
    await expect(page.locator('#detailHead')).toHaveText('Adham — 9,439');
    // one map: a real-place dot per round, a numbered pin per round, and a
    // dashed line only for rounds that were actually guessed
    await expect(page.locator('#detailMap circle')).toHaveCount(6);
    await expect(page.locator('#detailMap text')).toHaveCount(3);
    await expect(page.locator('#detailMap line')).toHaveCount(2);
    await expect(page.locator('#detailTable tr')).toHaveCount(4); // header + 3 rounds
    await expect(page.locator('#detailTable')).toContainText('Eiffel Tower');
    await expect(page.locator('#detailTable')).toContainText('no guess');

    await page.locator('#detailBack').click();
    await expect(page.locator('#lbScreen')).toBeVisible();
  });

  test('rows without kept detail are not clickable', async ({ page }) => {
    await page.route('**/api/leaderboard?*deck=*', (route) => route.fulfill({
      json: { top: [{ id: 7, name: 'Older', score: 8000, deck: 'World — Famous Places', hasDetail: false }], pastSeasons: [] },
    }));
    await page.goto('/?plainmap=1');
    await page.locator('#menuLb').click();
    await page.locator('#lbDeckFilter').selectOption('World — Famous Places');
    await expect(page.locator('#lbPodium')).toContainText('Older');
    await expect(page.locator('[data-detail]')).toHaveCount(0);
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
