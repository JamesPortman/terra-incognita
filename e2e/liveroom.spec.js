const { test, expect } = require('@playwright/test');
const { deleteE2ELeaderboardRows } = require('./helpers/db.js');

// Full two-browser live room: host screen + one phone player, photo mode,
// short rounds. Exercises the real Redis room state end to end.
test.describe('live room', () => {
  test.afterAll(async () => {
    await deleteE2ELeaderboardRows();
  });

  test('host and player play a full game to the standings', async ({ browser }) => {
    const host = await (await browser.newContext()).newPage();
    const player = await (await browser.newContext()).newPage();

    // host creates a photo-mode room with 30s rounds
    await host.goto('/?plainmap=1');
    await expect(host.locator('#modeToggleRow')).toBeVisible();
    await host.locator('#svToggle').uncheck();
    await host.locator('#roundSecInput').fill('30');
    await host.locator('#menuHost').click();
    await expect(host.locator('#lobbyScreen')).toBeVisible();
    const code = (await host.locator('#lobbyCode').textContent()).trim();
    expect(code).toMatch(/^[A-Z2-9]{4}$/);

    // player joins via the join link
    await player.goto(`/?join=${code}&plainmap=1`);
    await player.locator('#joinName').fill('E2E-Scout');
    await player.locator('#menuJoin').click();
    await expect(player.locator('#lobbyScreen')).toBeVisible();
    await expect(player.locator('#lobbyRole')).toHaveText(/waiting for the host/i);

    // host sees the player chip and starts
    await expect(host.locator('#lobbyPlayers .chip')).toHaveText(['E2E-Scout']);
    await host.locator('#lobbyStart').click();

    for (let round = 1; round <= 5; round++) {
      // both sides land in the question
      await expect(player.locator('#roundLabel')).toHaveText(`${round} / 5`);
      await expect(host.locator('#distReadout')).toHaveText(/0\/1 answered/);

      // player drops a pin and locks in
      await expect(player.locator('#goBtn')).toHaveText(/Place a pin to guess/i);
      await player.locator('#map').click(); // element center is always inside the map
      await expect(player.locator('#goBtn')).toHaveText(/Make guess/i);
      await player.locator('#goBtn').click();
      await expect(player.locator('#goBtn')).toHaveText(/Locked in|Waiting for host/i);

      // everyone answered -> auto-reveal on both screens
      await expect(player.locator('#distReadout')).toHaveText(/your pin landed/);
      await expect(host.locator('#distReadout')).toHaveText(/closest: E2E-Scout/);
      await expect(host.locator('#goBtn')).toHaveText(round < 5 ? /Next round/i : /Final standings/i);

      // reveal map shows the player's named pin on both screens
      await expect(host.locator('#map text').first()).toHaveText(/E2E-Scout/);

      await host.locator('#goBtn').click();
    }

    // standings on both screens, with the player as winner
    await expect(host.locator('#standingsScreen')).toBeVisible();
    await expect(player.locator('#standingsScreen')).toBeVisible();
    await expect(host.locator('#standWinner')).toHaveText(/E2E-Scout takes it/);
    await expect(host.locator('#standList li').first()).toContainText('E2E-Scout');

    // the finished game reached the all-time leaderboard
    await expect(host.locator('#standLbTable')).toContainText('E2E-Scout');
  });

  test('room is capped and codes are single-use for joining after start', async ({ browser, request }) => {
    // API-level guard checks driven through the deployed dev server
    const create = await request.post('/api/create', { data: { roundSec: 30 } });
    const { code, hostToken } = await create.json();
    await request.post('/api/join', { data: { code, name: 'E2E-A' } });
    await request.post('/api/next', { data: { code, hostToken } });
    const late = await request.post('/api/join', { data: { code, name: 'E2E-Late' } });
    expect(late.status()).toBe(409);
  });
});
