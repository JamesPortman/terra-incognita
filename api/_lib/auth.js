// Shared credential checks for room/host/admin tokens.
const crypto = require('crypto');

// Constant-time token compare. Both sides must be non-empty strings — an
// absent or empty token never matches, even if the expected value is also
// missing (undefined === undefined was the prototype-key bypass). Hashing
// first gives timingSafeEqual the equal-length buffers it requires.
function tokenMatches(given, expected) {
  if (typeof given !== 'string' || given.length === 0) return false;
  if (typeof expected !== 'string' || expected.length === 0) return false;
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(given).digest(),
    crypto.createHash('sha256').update(expected).digest(),
  );
}

// Look up a map entry only if it is the map's own property, so ids like
// `constructor`, `__proto__` or `toString` never resolve to Object.prototype.
function ownEntry(map, key) {
  if (!map || typeof key !== 'string' || !Object.hasOwn(map, key)) return undefined;
  return map[key];
}

module.exports = { tokenMatches, ownEntry };
