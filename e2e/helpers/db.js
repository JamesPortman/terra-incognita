// Neon access for E2E cleanup — E2E games write real leaderboard rows; every
// E2E player name is prefixed "E2E-" and removed in afterAll.
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

function loadEnvLocal() {
  const p = path.join(__dirname, '..', '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function deleteE2ELeaderboardRows() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) return;
  const sql = neon(process.env.DATABASE_URL);
  await sql`DELETE FROM leaderboard WHERE player_name LIKE 'E2E-%'`;
}

module.exports = { deleteE2ELeaderboardRows };
