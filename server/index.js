const express = require('express');
const crypto = require('crypto');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { JsonStore } = require('./store');

const PORT = parseInt(process.env.PORT || '3001', 10);
const DATA_DIR = process.env.DATA_DIR || '/data';

function parseCommaList(v) {
  if (typeof v !== 'string') return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function toRecordOfStrings(headers, { redact = [] } = {}) {
  const out = {};
  const redactSet = new Set(redact.map((h) => String(h).toLowerCase()));
  for (const [k, v] of Object.entries(headers || {})) {
    const keyLower = String(k).toLowerCase();
    if (redactSet.has(keyLower)) continue;
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v)) out[k] = v.join(', ');
    else if (typeof v === 'number') out[k] = String(v);
  }
  return out;
}

function pickQuery(q, { redactKeys = [] } = {}) {
  const out = {};
  const redactSet = new Set(redactKeys.map((x) => String(x).toLowerCase()));
  for (const [k, v] of Object.entries(q || {})) {
    const keyLower = String(k).toLowerCase();
    if (redactSet.has(keyLower)) continue;
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v)) out[k] = v.join(', ');
    else if (v != null) out[k] = String(v);
  }
  return out;
}

async function main() {
  const store = new JsonStore({ dataDir: DATA_DIR });
  await store.init();

  const app = express();
  app.set('trust proxy', true);

  const HOOK_TOKEN = typeof process.env.HOOK_TOKEN === 'string' ? process.env.HOOK_TOKEN : '';
  const HOOK_TOKEN_HEADER = String(process.env.HOOK_TOKEN_HEADER || 'x-hook-token').toLowerCase();
  const HOOK_TOKEN_QUERY = String(process.env.HOOK_TOKEN_QUERY || 'token');
  const HOOK_IP_ALLOWLIST = parseCommaList(process.env.HOOK_IP_ALLOWLIST);
  const HOOK_RATE_LIMIT_WINDOW_MS = Math.max(
    1000,
    parseInt(String(process.env.HOOK_RATE_LIMIT_WINDOW_MS || '60000'), 10) || 60000
  );
  const HOOK_RATE_LIMIT_MAX = Math.max(1, parseInt(String(process.env.HOOK_RATE_LIMIT_MAX || '60'), 10) || 60);

  if (!HOOK_TOKEN) {
    // eslint-disable-next-line no-console
    console.warn(
      '[hooklog] HOOK_TOKEN is not set. /hook/:id is publicly writable. Set HOOK_TOKEN to require a shared secret.'
    );
  }

  // Rate limit session-related API endpoints (slows brute-force/enumeration)
  const API_RATE_LIMIT_WINDOW_MS = Math.max(
    1000,
    parseInt(String(process.env.API_RATE_LIMIT_WINDOW_MS || '60000'), 10) || 60000
  );
  const API_RATE_LIMIT_MAX = Math.max(1, parseInt(String(process.env.API_RATE_LIMIT_MAX || '300'), 10) || 300);
  const apiLimiter = rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    limit: API_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      // eslint-disable-next-line no-console
      console.warn(`[hooklog] api_rate_limited ip=${req.ip} path=${req.originalUrl}`);
      return res.status(429).json({ error: 'rate_limited' });
    }
  });

  const hookLimiter = rateLimit({
    windowMs: HOOK_RATE_LIMIT_WINDOW_MS,
    limit: HOOK_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      // eslint-disable-next-line no-console
      console.warn(`[hooklog] rate_limited ip=${req.ip} path=${req.originalUrl}`);
      return res.status(429).json({ error: 'rate_limited' });
    }
  });

  function hookGuard(req, res, next) {
    if (HOOK_IP_ALLOWLIST.length > 0 && !HOOK_IP_ALLOWLIST.includes(String(req.ip))) {
      // eslint-disable-next-line no-console
      console.warn(`[hooklog] ip_blocked ip=${req.ip} path=${req.originalUrl}`);
      return res.status(403).json({ error: 'ip_blocked' });
    }

    if (HOOK_TOKEN) {
      const hdrVal = req.headers[HOOK_TOKEN_HEADER];
      const providedHeader = Array.isArray(hdrVal) ? hdrVal[0] : typeof hdrVal === 'string' ? hdrVal : '';
      const providedQuery =
        typeof req.query?.[HOOK_TOKEN_QUERY] === 'string' ? req.query[HOOK_TOKEN_QUERY] : '';

      const provided = providedHeader || providedQuery;
      if (!provided || !safeEqual(provided, HOOK_TOKEN)) {
        // eslint-disable-next-line no-console
        console.warn(`[hooklog] unauthorized_hook ip=${req.ip} path=${req.originalUrl}`);
        return res.status(401).json({ error: 'unauthorized' });
      }
    }

    return next();
  }

  // Serve built frontend (copied into /app/public in the container)
  const publicDir = path.join(__dirname, 'public');

  // API
  app.use('/api', express.json({ limit: '2mb' }));
  app.use('/api/sessions', apiLimiter);

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // Create a new session (server generates UUID)
  app.post('/api/sessions', async (req, res) => {
    const id = crypto.randomUUID();
    const name = typeof req.body?.name === 'string' ? req.body.name : 'My Hook';
    const session = await store.upsertSession({ id, name });
    res.status(201).json(session);
  });

  // Create or fetch a session with a specific id (used when opening a shared link)
  app.put('/api/sessions/:id', async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'missing_id' });
    const name = typeof req.body?.name === 'string' ? req.body.name : 'Shared Hook';
    const session = await store.upsertSession({ id, name });
    res.json(session);
  });

  app.get('/api/sessions/:id', (req, res) => {
    const s = store.getSession(req.params.id);
    if (!s) return res.status(404).json({ error: 'not_found' });
    res.json(s);
  });

  app.patch('/api/sessions/:id', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'invalid_name' });
    const s = await store.renameSession(req.params.id, name);
    if (!s) return res.status(404).json({ error: 'not_found' });
    res.json(s);
  });

  app.get('/api/sessions/:id/requests', (req, res) => {
    const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
    const items = store.getRequests(req.params.id, { limit });
    res.json(items);
  });

  app.delete('/api/sessions/:id/requests', async (req, res) => {
    await store.clearRequests(req.params.id);
    res.json({ ok: true });
  });

  // Allow the UI to add mock requests
  app.post('/api/sessions/:id/requests', async (req, res) => {
    const sessionId = req.params.id;
    await store.upsertSession({ id: sessionId, name: 'Hook Session' });

    const incoming = req.body || {};
    const id = typeof incoming.id === 'string' ? incoming.id : crypto.randomUUID();
    const timestamp = typeof incoming.timestamp === 'number' ? incoming.timestamp : Date.now();
    const method = typeof incoming.method === 'string' ? incoming.method : 'POST';
    const url = typeof incoming.url === 'string' ? incoming.url : '';
    const headers = typeof incoming.headers === 'object' && incoming.headers ? incoming.headers : {};
    const body = typeof incoming.body === 'string' ? incoming.body : '';
    const query = typeof incoming.query === 'object' && incoming.query ? incoming.query : {};
    const origin = typeof incoming.origin === 'string' ? incoming.origin : req.ip;

    const reqObj = {
      id,
      endpointId: sessionId,
      timestamp,
      method,
      url,
      headers,
      body,
      query,
      parsedBody: null,
      origin
    };

    await store.addRequest(sessionId, reqObj);
    res.status(201).json(reqObj);
  });

  // Protect webhook endpoint against abuse (optional token, optional allowlist, and rate limiting)
  app.use('/hook', hookGuard, hookLimiter);

  // Webhook endpoint: accept any method/content-type and store it
  app.all('/hook/:id', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    const sessionId = req.params.id;

    // Single URL behavior:
    // If a browser opens /hook/:id, redirect to viewer instead of storing.
    const accept = String(req.headers.accept || '');
    if (req.method === 'GET' && accept.toLowerCase().includes('text/html')) {
      return res.redirect(302, `/?hook=${encodeURIComponent(sessionId)}`);
    }

    await store.upsertSession({ id: sessionId, name: 'Hook Session' });

    const bodyBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const body = bodyBuf.toString('utf8');
    const headers = toRecordOfStrings(req.headers, { redact: ['authorization', HOOK_TOKEN_HEADER] });
    const query = pickQuery(req.query, { redactKeys: [HOOK_TOKEN_QUERY] });
    const method = req.method || 'GET';
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const reqObj = {
      id: crypto.randomUUID(),
      endpointId: sessionId,
      timestamp: Date.now(),
      method,
      url: fullUrl,
      headers,
      body,
      query,
      parsedBody: null,
      origin: req.ip
    };

    await store.addRequest(sessionId, reqObj);
    res.json({ ok: true, requestId: reqObj.id });
  });

  // Static files (SPA)
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    // Let API/hook paths 404 if they reach here
    if (req.path.startsWith('/api') || req.path.startsWith('/hook')) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`hooklog-server listening on :${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

