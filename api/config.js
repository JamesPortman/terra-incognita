// Public client config. The Maps key is referrer-restricted, so exposing it
// here is by design — serving it from an env var keeps it out of the repo.
const { sendJSON } = require('./_lib/rooms.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  sendJSON(res, 200, { mapsKey: process.env.GOOGLE_MAPS_KEY || null });
};
