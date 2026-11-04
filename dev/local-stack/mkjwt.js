// node mkjwt.js <role>  -> HS256 JWT signed with the local dev secret
const crypto = require('crypto');
const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const role = process.argv[2] || 'anon';
const head = b({ alg: 'HS256', typ: 'JWT' });
const body = b({ role, iss: 'local', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 365 });
const sig = crypto.createHmac('sha256', 'devonly-jwt-secret-devonly-jwt-secret-1234').update(`${head}.${body}`).digest('base64url');
console.log(`${head}.${body}.${sig}`);
