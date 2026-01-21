const fs = require('fs/promises');
const path = require('path');

const DEFAULT_DB = { sessions: {}, requests: {} };

function now() {
  return Date.now();
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

class JsonStore {
  constructor({ dataDir = '/data', filename = 'db.json', maxRequestsPerSession = 2000 } = {}) {
    this.dataDir = dataDir;
    this.filename = filename;
    this.maxRequestsPerSession = maxRequestsPerSession;
    this.dbPath = path.join(this.dataDir, this.filename);
    this.db = DEFAULT_DB;
    this._writeLock = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.dbPath, 'utf8');
      const parsed = safeJsonParse(raw, DEFAULT_DB);
      // basic shape guard
      this.db = {
        sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
        requests: parsed.requests && typeof parsed.requests === 'object' ? parsed.requests : {}
      };
    } catch {
      this.db = DEFAULT_DB;
      await this._flush();
    }
  }

  async _flush() {
    // atomic-ish write: write temp then rename
    const tmp = this.dbPath + '.tmp';
    const data = JSON.stringify(this.db);
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, this.dbPath);
  }

  async _withWriteLock(fn) {
    this._writeLock = this._writeLock.then(fn, fn);
    return this._writeLock;
  }

  listSessions(ids) {
    const out = [];
    for (const id of ids) {
      const s = this.db.sessions[id];
      if (s) out.push(s);
    }
    return out;
  }

  getSession(id) {
    return this.db.sessions[id] || null;
  }

  async upsertSession({ id, name }) {
    const existing = this.db.sessions[id];
    const created = existing?.created ?? now();
    const session = { id, name: name || existing?.name || 'Hook Session', created };

    await this._withWriteLock(async () => {
      this.db.sessions[id] = session;
      if (!this.db.requests[id]) this.db.requests[id] = [];
      await this._flush();
    });

    return session;
  }

  async createSession({ id, name }) {
    // id is optional
    const sessionId = id;
    if (!sessionId) throw new Error('id_required');
    return this.upsertSession({ id: sessionId, name: name || 'My Hook' });
  }

  async renameSession(id, name) {
    const existing = this.db.sessions[id];
    if (!existing) return null;
    const session = { ...existing, name };
    await this._withWriteLock(async () => {
      this.db.sessions[id] = session;
      await this._flush();
    });
    return session;
  }

  getRequests(sessionId, { limit = 200 } = {}) {
    const arr = this.db.requests[sessionId] || [];
    return arr.slice(0, limit);
  }

  async clearRequests(sessionId) {
    await this._withWriteLock(async () => {
      this.db.requests[sessionId] = [];
      await this._flush();
    });
  }

  async addRequest(sessionId, reqObj) {
    await this._withWriteLock(async () => {
      if (!this.db.requests[sessionId]) this.db.requests[sessionId] = [];
      this.db.requests[sessionId].unshift(reqObj);
      if (this.db.requests[sessionId].length > this.maxRequestsPerSession) {
        this.db.requests[sessionId].length = this.maxRequestsPerSession;
      }
      await this._flush();
    });
    return reqObj;
  }
}

module.exports = { JsonStore };

