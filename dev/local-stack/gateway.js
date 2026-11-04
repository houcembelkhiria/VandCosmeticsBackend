// supabase-js talks to <url>/rest/v1/...; PostgREST serves at /. Traefik strips the prefix in production,
// this does the same locally. Usage: node gateway.js  (listens on 8100)
const http = require('http');
http.createServer((req, res) => {
  if (!req.url.startsWith('/rest/v1/') && req.url !== '/rest/v1') { res.writeHead(404).end('not found'); return; }
  const up = http.request({ host: '127.0.0.1', port: 55330, method: req.method, path: req.url.replace(/^\/rest\/v1/, '') || '/', headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => res.writeHead(502).end('postgrest down'));
  req.pipe(up);
}).listen(8100, '127.0.0.1', () => console.log('gateway on :8100'));
