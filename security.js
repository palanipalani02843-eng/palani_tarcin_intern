const crypto = require('crypto');

let bcryptLib;
try {
  bcryptLib = require('bcryptjs');
} catch (e) {
  bcryptLib = null;
}

const bcrypt = {
  genSaltSync: (rounds) => bcryptLib ? bcryptLib.genSaltSync(rounds) : crypto.randomBytes(16).toString('hex'),
  genSalt: async (rounds) => bcryptLib ? bcryptLib.genSalt(rounds) : crypto.randomBytes(16).toString('hex'),
  hashSync: (pwd, salt) => bcryptLib ? bcryptLib.hashSync(pwd, salt) : `scrypt$${salt}$${crypto.scryptSync(pwd, salt, 32).toString('hex')}`,
  hash: async (pwd, salt) => bcryptLib ? bcryptLib.hash(pwd, salt) : `scrypt$${salt}$${crypto.scryptSync(pwd, salt, 32).toString('hex')}`,
  compare: async (pwd, hash) => {
    if (!hash || !pwd) return false;
    if (typeof hash === 'string' && hash.startsWith('scrypt$')) {
      const parts = hash.split('$');
      const salt = parts[1];
      const expected = parts[2];
      const actual = crypto.scryptSync(pwd, salt, 32).toString('hex');
      return expected === actual;
    }
    if (bcryptLib && typeof hash === 'string' && (hash.startsWith('$2a$') || hash.startsWith('$2b$'))) {
      return bcryptLib.compare(pwd, hash);
    }
    return false;
  }
};

let jwt;
try {
  jwt = require('jsonwebtoken');
} catch (e) {
  jwt = {
    sign: (payload, secret, options = {}) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 3600);
      const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
      return `${header}.${body}.${sig}`;
    },
    verify: (token, secret) => {
      if (!token) throw new Error('Token required');
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token structure');
      const sig = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
      if (sig !== parts[2]) throw new Error('Invalid signature');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
      return payload;
    }
  };
}

module.exports = {
  bcrypt,
  jwt
};
