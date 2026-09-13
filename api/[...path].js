// Vercel serverless proxy -> your bot on Cybrancee.
//
// Why a function instead of a plain rewrite:
//   * rewrites do not reliably forward Set-Cookie from an external origin, so
//     your session cookie was being dropped and every page bounced to /login
//   * a raw IP + non-standard port over http is a common rewrite failure
//   * this reports the real error instead of a blank 502
//
// Set BOT_URL in Vercel -> Settings -> Environment Variables to change the
// target without redeploying code.

export const config = {
  api: { bodyParser: false },   // pass bodies through untouched
};

const BOT = (process.env.BOT_URL || 'http://5.78.148.33:5005').replace(/\/+$/, '');

// headers that must not be copied from the incoming request
const STRIP_REQ = new Set([
  'host', 'connection', 'content-length', 'transfer-encoding',
  'x-forwarded-host', 'x-forwarded-proto', 'x-vercel-id',
  'x-vercel-forwarded-for', 'x-vercel-deployment-url', 'accept-encoding',
]);

// headers that must not be copied back to the browser
const STRIP_RES = new Set([
  'content-encoding', 'content-length', 'transfer-encoding', 'connection',
]);

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req, res) {
  // /api/__diag -> prove the proxy itself is alive and show what it targets
  if (req.url.startsWith('/api/__diag')) {
    let reach = null;
    const t0 = Date.now();
    try {
      const r = await fetch(BOT + '/api/system/stats', {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      reach = { ok: true, status: r.status, ms: Date.now() - t0,
                contentType: r.headers.get('content-type') };
    } catch (e) {
      reach = { ok: false, ms: Date.now() - t0, error: e.name + ': ' + e.message };
    }
    res.setHeader('content-type', 'application/json');
    return res.status(200).end(JSON.stringify({
      proxy: 'alive',
      target: BOT,
      botReachable: reach,
      node: process.version,
    }, null, 2));
  }

  const target = BOT + req.url;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!STRIP_REQ.has(k.toLowerCase())) headers[k] = v;
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req),
      redirect: 'manual',
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    // surface the real reason rather than a blank 502
    res.setHeader('content-type', 'application/json');
    return res.status(502).end(JSON.stringify({
      error: 'Could not reach the bot',
      target,
      reason: e.name + ': ' + e.message,
      hint: 'Check the bot is running and that BOT_URL is correct.',
    }, null, 2));
  }

  // pass headers back, fixing cookies so the browser accepts them
  const setCookie = typeof upstream.headers.getSetCookie === 'function'
    ? upstream.headers.getSetCookie()
    : (upstream.headers.raw ? upstream.headers.raw()['set-cookie'] : null);

  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (STRIP_RES.has(k) || k === 'set-cookie') return;
    res.setHeader(key, value);
  });

  if (setCookie && setCookie.length) {
    // a cookie scoped to the bot's IP would be rejected on the Vercel domain,
    // so drop Domain= and let it default to the current host
    const fixed = setCookie.map(c =>
      c.replace(/;\s*Domain=[^;]*/ig, '')
       .replace(/;\s*SameSite=[^;]*/ig, '')
       .replace(/;\s*Path=[^;]*/ig, '')
       .replace(/;\s*Secure/ig, '') + '; Path=/; SameSite=Lax'
    );
    res.setHeader('set-cookie', fixed);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.status(upstream.status).end(buf);
}
