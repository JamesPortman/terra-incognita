const { test, expect } = require('@playwright/test');

// Full weekly run with an E2E- name: replayable, scored server-side, and never
// written to weekly_scores — so this spec is repeatable and leaves no rows.
test.describe('weekly expedition', () => {
  test('plays the week to the standings screen', async ({ page }) => {
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
  });
});
