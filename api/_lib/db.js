const { neon } = require('@neondatabase/serverless');

let sql = null;
let tableReady = null;

function getSql() {
  if (!sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

async function ensureTable() {
  if (!tableReady) {
    tableReady = getSql()`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id serial PRIMARY KEY,
        room_code text NOT NULL,
        player_name text NOT NULL,
        score int NOT NULL,
        rounds int NOT NULL,
        played_at timestamptz NOT NULL DEFAULT now()
      )`;
    tableReady = tableReady.then(() =>
      getSql()`ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS deck text`);
    // per-round replay: [{lat, lon, label, glat, glon, km, pts}] — null for
    // games recorded before this column existed
    tableReady = tableReady.then(() =>
      getSql()`ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS detail jsonb`);
  }
  await tableReady;
}

let weeklyReady = null;
async function ensureWeeklyTable() {
  if (!weeklyReady) {
    weeklyReady = getSql()`
      CREATE TABLE IF NOT EXISTS weekly_scores (
        id serial PRIMARY KEY,
        week text NOT NULL,
        player_name text NOT NULL,
        score int NOT NULL,
        rounds int NOT NULL,
        played_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (week, player_name)
      )`;
    weeklyReady = weeklyReady.then(() =>
      getSql()`ALTER TABLE weekly_scores ADD COLUMN IF NOT EXISTS away_ms int`);
    weeklyReady = weeklyReady.then(() =>
      getSql()`ALTER TABLE weekly_scores ADD COLUMN IF NOT EXISTS detail jsonb`);
  }
  await weeklyReady;
}

let archiveReady = null;
async function ensureArchiveTable() {
  if (!archiveReady) {
    archiveReady = getSql()`
      CREATE TABLE IF NOT EXISTS leaderboard_archive (
        id serial PRIMARY KEY,
        season text NOT NULL,
        player_name text NOT NULL,
        score int NOT NULL,
        rounds int NOT NULL,
        deck text,
        played_at timestamptz,
        archived_at timestamptz NOT NULL DEFAULT now()
      )`;
  }
  await archiveReady;
}

module.exports = { getSql, ensureTable, ensureWeeklyTable, ensureArchiveTable };
