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
  }
  await tableReady;
}

module.exports = { getSql, ensureTable };
