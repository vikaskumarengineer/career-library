// password.js — shared bcrypt helpers so student & admin passwords are
// never stored in plain text in data/db.json.
const bcrypt = require('bcryptjs');
const SALT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), SALT_ROUNDS);
}

// Verifies a plain-text password against what's stored.
// Falls back to a direct string comparison for any password saved before
// hashing was added, so older data.json files don't lock everyone out —
// it will simply be re-hashed the next time that password is changed/set.
function verifyPassword(plain, stored) {
  if (!stored) return false;
  const isHashed = typeof stored === 'string' && /^\$2[aby]\$/.test(stored);
  if (isHashed) return bcrypt.compareSync(String(plain), stored);
  return String(plain) === stored;
}

module.exports = { hashPassword, verifyPassword };
