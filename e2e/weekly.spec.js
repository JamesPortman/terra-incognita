const { test, expect } = require('@playwright/test');

// Full weekly run with an E2E- name: replayable, scored server-side, and never
// written to weekly_scores — so this spec is repeatable and leaves no rows.
test.describe('weekly expedition', () => {
  test('plays the week to the standings screen', async ({ page }) => {
    // random-world weeks need Google panoramas — covered by gmap.spec.js
    const info = await (await page.request.get('/api/weekly')).json();
    test.skip(info.mode === 'random', 'random-world week — see the gmap spec');
    await page.goto('/?plainmap=1');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#joinName').fill('E2E-Weekly');
    await page.locator('#menuWeekly').click();

    for (let round = 1; round <= 5; round++) {
      await expect(page.locator('#roundLabel')).toHaveText(`${round} / 5`);
      await expect(page.locator('#goBtn')).toHaveText(/Place a pin to guess/i);
      await page.locator('#map').click();
      await expect(page.locator('#goBtn')).toHaveText(/Make guess/i);
      await page.locator('#goBtn').click();
      // server round-trip scores the guess
      await expect(page.locator('#distReadout')).toHaveText(/your pin landed/);
      await expect(page.locator('#goBtn')).toHaveText(round < 5 ? /Next round/i : /See weekly standings/i);
      await page.locator('#goBtn').click();
    }

    await expect(page.locator('#weeklyScreen')).toBeVisible();
    await expect(page.locator('#weeklyHead')).toHaveText(/pts/);
    await page.locator('#weeklyMenu').click();
    await expect(page.locator('#menuScreen')).toBeVisible();
  });

  test('requires a name and shows this week\'s board from the menu', async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#modeToggleRow')).toBeVisible();
    await page.locator('#joinName').fill('');
    await page.locator('#menuWeekly').click();
    await expect(page.locator('#menuErr')).toHaveText(/enter your name/i);

    await page.locator('#menuWeeklyBoard').click();
    await expect(page.locator('#weeklyScreen')).toBeVisible();
    await expect(page.locator('#weeklyKicker')).toHaveText(/Weekly Expedition · \d{4}-W\d{2}/);

    // past expeditions render most-recent-first when any exist
    const info = await (await page.request.get('/api/weekly')).json();
    if (info.past && info.past.length) {
      await expect(page.locator('#weeklyPastHead')).toBeVisible();
      await expect(page.locator('#weeklyPast .weeklabel').first()).toHaveText(info.past[0].week);
      const labels = await page.locator('#weeklyPast .weeklabel').allTextContents();
      expect([...labels].sort().reverse()).toEqual(labels); // descending weeks
    } else {
      await expect(page.locator('#weeklyPastHead')).toBeHidden();
    }
  });

  test('this week\'s rounds stay hidden, past weeks open', async ({ page }) => {
    await page.goto('/?plainmap=1');
    await expect(page.locator('#menuWeeklyBoard')).toBeVisible();
    await page.locator('#menuWeeklyBoard').click();
    await expect(page.locator('#weeklyScreen')).toBeVisible();
    const info = await (await page.request.get('/api/weekly')).json();

    // the board is public before you play, so no row on it may open a replay
    await expect(page.locator('#weeklyTable [data-detail]')).toHaveCount(0);
    if (info.top.length) await expect(page.locator('#weeklyLockNote')).toBeVisible();

    // and the API refuses even a hand-crafted request for this week
    if (info.top.length) {
      const res = await page.request.get(`/api/weekly?detail=${info.top[0].id}`);
      expect(res.status()).toBe(403);
      expect(await res.json()).toMatchObject({ error: /stay hidden/ });
    }

    // finished weeks are fair game
    if (info.past && info.past.length && info.past[0].top[0].hasDetail) {
      await expect(page.locator('#weeklyPast [data-detail]').first()).toBeVisible();
      const res = await page.request.get(`/api/weekly?detail=${info.past[0].top[0].id}`);
      expect(res.status()).toBe(200);
      expect((await res.json()).detail.length).toBeGreaterThan(0);
    }
  });
});
