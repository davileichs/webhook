import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Session, WebhookRequest } from './types';
import { copyTextToClipboard, tryParseJson } from './utils/helpers';
import ExampleLibrary from './components/ExampleLibrary';
import RequestViewer from './components/RequestViewer';

const LS_SESSION_IDS = 'hooklog_session_ids';
const LS_ACTIVE_SESSION_ID = 'hooklog_active_session_id';
const LS_THEME = 'hooklog_theme';
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {})
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function loadSessionIds(): string[] {
  const raw = localStorage.getItem(LS_SESSION_IDS);
  if (raw) {
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) return ids.filter((x) => typeof x === 'string');
    } catch {
      // ignore
    }
  }

  // migration from old storage: hooklog_sessions = [{id, ...}]
  const legacy = localStorage.getItem('hooklog_sessions');
  if (legacy) {
    try {
      const sessions = JSON.parse(legacy);
      if (Array.isArray(sessions)) {
        const ids = sessions.map((s) => s?.id).filter((x) => typeof x === 'string');
        localStorage.setItem(LS_SESSION_IDS, JSON.stringify(ids));
        return ids;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

function saveSessionIds(ids: string[]) {
  localStorage.setItem(LS_SESSION_IDS, JSON.stringify(ids));
}

const AppServer: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isSharedView, setIsSharedView] = useState(false);

  const [copiedHook, setCopiedHook] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) || null, [sessions, activeSessionId]);
  const filteredRequests = useMemo(() => requests.filter((r) => r.endpointId === activeSessionId), [requests, activeSessionId]);
  const selectedRequest = useMemo(() => requests.find((r) => r.id === selectedRequestId) || null, [requests, selectedRequestId]);

  const hookEndpointUrl = activeSessionId ? `${window.location.origin}/hook/${activeSessionId}` : '';

  useEffect(() => {
    const savedTheme = localStorage.getItem(LS_THEME) as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);

    const bootstrap = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hookFromUrl = urlParams.get('hook');

      let ids = loadSessionIds();
      let active = localStorage.getItem(LS_ACTIVE_SESSION_ID);

      // pasted shared link => ONLY show that session in this view
      if (hookFromUrl) {
        setIsSharedView(true);
        if (!ids.includes(hookFromUrl)) ids = [hookFromUrl, ...ids];
        saveSessionIds(ids);
        localStorage.setItem(LS_ACTIVE_SESSION_ID, hookFromUrl);

        let session: Session;
        try {
          session = await fetchJson<Session>(`/api/sessions/${encodeURIComponent(hookFromUrl)}`);
        } catch {
          session = await fetchJson<Session>(`/api/sessions/${encodeURIComponent(hookFromUrl)}`, {
            method: 'PUT',
            body: JSON.stringify({ name: 'Shared Hook' })
          });
        }

        setSessions([session]);
        setActiveSessionId(hookFromUrl);
        setSelectedRequestId(null);
        return;
      } else {
        setIsSharedView(false);
      }

      // new browser => create server session and persist uuid locally
      if (ids.length === 0) {
        const created = await fetchJson<Session>('/api/sessions', { method: 'POST', body: JSON.stringify({ name: 'My Hook' }) });
        ids = [created.id];
        active = created.id;
      }

      saveSessionIds(ids);
      if (active) localStorage.setItem(LS_ACTIVE_SESSION_ID, active);

      const loaded: Session[] = [];
      for (const id of ids) {
        try {
          loaded.push(await fetchJson<Session>(`/api/sessions/${encodeURIComponent(id)}`));
        } catch {
          // create if missing (helps when backend data was reset)
          loaded.push(
            await fetchJson<Session>(`/api/sessions/${encodeURIComponent(id)}`, {
              method: 'PUT',
              body: JSON.stringify({ name: hookFromUrl === id ? 'Shared Hook' : 'My Hook' })
            })
          );
        }
      }

      setSessions(loaded);
      setActiveSessionId(active || loaded[0]?.id || null);
    };

    bootstrap().catch(console.error);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_THEME, theme);
    document.body.className = theme === 'dark' ? 'theme-dark bg-app text-app' : 'theme-light bg-app text-app';
  }, [theme]);

  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;

    const fetchRequests = async () => {
      try {
        const items = await fetchJson<WebhookRequest[]>(`/api/sessions/${encodeURIComponent(activeSessionId)}/requests?limit=400`);
        if (cancelled) return;
        const hydrated = items.map((r) => ({ ...r, parsedBody: r.parsedBody ?? tryParseJson(r.body) }));
        setRequests(hydrated);
        if (hydrated.length > 0 && !selectedRequestId) setSelectedRequestId(hydrated[0].id);
      } catch (e) {
        console.error(e);
      }
    };

    fetchRequests();
    const t = window.setInterval(fetchRequests, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [activeSessionId, selectedRequestId]);

  const createSession = async () => {
    const created = await fetchJson<Session>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name: `Hook ${sessions.length + 1}` })
    });

    setSessions((prev) => [created, ...prev]);
    setActiveSessionId(created.id);
    setSelectedRequestId(null);

    const ids = loadSessionIds();
    saveSessionIds(ids.includes(created.id) ? ids : [created.id, ...ids]);
    localStorage.setItem(LS_ACTIVE_SESSION_ID, created.id);

    setEditingSessionId(created.id);
    setEditingSessionName(created.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const deleteSessionLocal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this hook from this browser? (Server data remains)')) return;

    setSessions((prev) => prev.filter((s) => s.id !== id));
    const ids = loadSessionIds().filter((x) => x !== id);
    saveSessionIds(ids);

    if (activeSessionId === id) {
      const nextActive = ids[0] ?? null;
      setActiveSessionId(nextActive);
      setSelectedRequestId(null);
      if (nextActive) localStorage.setItem(LS_ACTIVE_SESSION_ID, nextActive);
      else localStorage.removeItem(LS_ACTIVE_SESSION_ID);
    }
  };

  const saveRename = async () => {
    if (!editingSessionId) return;
    const trimmed = editingSessionName.trim();
    if (!trimmed) return setEditingSessionId(null);

    try {
      const updated = await fetchJson<Session>(`/api/sessions/${encodeURIComponent(editingSessionId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed })
      });
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      console.error(e);
    } finally {
      setEditingSessionId(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') setEditingSessionId(null);
  };

  const clearHistory = async () => {
    if (!activeSessionId) return;
    if (!confirm('Clear all request history for this hook?')) return;
    await fetchJson(`/api/sessions/${encodeURIComponent(activeSessionId)}/requests`, { method: 'DELETE' });
    setRequests([]);
    setSelectedRequestId(null);
  };

  const addRequest = async (req: WebhookRequest) => {
    if (!activeSessionId) return;
    const newReq = { ...req, endpointId: activeSessionId };
    await fetchJson(`/api/sessions/${encodeURIComponent(activeSessionId)}/requests`, {
      method: 'POST',
      body: JSON.stringify(newReq)
    });
  };

  const copyHook = async () => {
    if (!hookEndpointUrl) return;
    const ok = await copyTextToClipboard(hookEndpointUrl);
    if (!ok) return;
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans transition-colors duration-200 bg-app text-app">
      {/* Sidebar: Requests */}
      <div className="w-80 flex flex-col border-r shrink-0 transition-colors bg-panel border-app">
        <div className="p-6 border-b space-y-4 border-app">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold tracking-tight">HookLog</h1>
            </div>
            <button
              onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
              className="p-2 rounded-lg transition-colors border border-app bg-panel-2 text-muted btn-ghost ring-accent"
              title="Toggle theme"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.071 16.071l.707.707M7.757 7.757l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-2">URL (webhook + viewer)</label>
            <div className="p-2 border border-app rounded text-[10px] mono truncate transition-colors bg-panel-2 text-muted">
              {hookEndpointUrl || 'No active hook'}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={copyHook}
                className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ring-accent ${
                  copiedHook ? 'bg-accent-soft text-accent border border-accent' : 'btn-primary'
                }`}
              >
                {copiedHook ? 'Copied!' : 'Copy URL'}
              </button>
              <button
                onClick={clearHistory}
                className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all bg-panel border-app text-muted hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 px-2 text-muted-2">Captured Requests ({filteredRequests.length})</h3>
            <div className="space-y-2">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-app bg-panel-2 text-muted">
                  <p className="text-[10px] uppercase tracking-wider">Waiting for webhook calls...</p>
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      selectedRequestId === req.id ? 'bg-accent-soft border-accent shadow-lg' : 'bg-panel border-app hover-panel'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] mono text-muted-2">{new Date(req.timestamp).toLocaleTimeString()}</span>
                      <span className="text-[9px] font-bold uppercase text-muted-2">{req.method}</span>
                    </div>
                    <div className="text-sm font-semibold truncate text-app">
                      {req.parsedBody?.event || req.parsedBody?.type || req.parsedBody?.action || 'Request Data'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 px-2 text-muted-2">Mock Generator</h3>
            <ExampleLibrary onSelect={addRequest} theme={theme} />
          </section>
        </div>
      </div>

      {/* Main: Viewer */}
      <main className="flex-1 overflow-hidden transition-colors border-r bg-app border-app">
        {selectedRequest ? <RequestViewer request={selectedRequest} theme={theme} /> : (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border transition-all bg-panel border-app shadow-xl">
              <svg className="w-8 h-8 text-muted-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-xl font-bold mb-2 text-app">{activeSession ? `Active Hook: ${activeSession.name}` : 'Create a Hook to Start'}</h2>
            <p className="text-center max-w-sm text-sm text-muted">Send a request to the webhook URL. The server stores it, and this UI will show it automatically.</p>
          </div>
        )}
      </main>

      {/* Sidebar: Hooks */}
      {!isSharedView && (
        <div className="w-72 flex flex-col shrink-0 transition-colors bg-panel border-l border-app">
          <div className="p-6 border-b flex items-center justify-between border-app">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-2">Available Hooks</h3>
            <button onClick={createSession} className="p-1.5 icon-btn-accent transition-all active:scale-90" title="New Hook">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => { setActiveSessionId(session.id); localStorage.setItem(LS_ACTIVE_SESSION_ID, session.id); setSelectedRequestId(null); }}
                className={`w-full p-4 rounded-xl border transition-all group ${
                  activeSessionId === session.id ? 'bg-accent-soft border-accent shadow-lg' : 'bg-panel border-app hover-panel'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  {editingSessionId === session.id ? (
                    <input
                      ref={editInputRef}
                      className="text-sm font-bold border rounded px-2 py-1 w-full mr-2 bg-panel-2 text-accent border-accent ring-accent"
                      value={editingSessionName}
                      onChange={(e) => setEditingSessionName(e.target.value)}
                      onBlur={saveRename}
                      onKeyDown={handleRenameKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={`text-sm font-bold truncate flex-1 leading-tight ${activeSessionId === session.id ? 'text-accent' : 'text-app'}`}
                      onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditingSessionName(session.name); setTimeout(() => editInputRef.current?.focus(), 50); }}
                      title="Click to rename"
                    >
                      {session.name}
                    </span>
                  )}
                  <button onClick={(e) => deleteSessionLocal(session.id, e)} className="p-1 rounded transition-opacity opacity-0 group-hover:opacity-100 text-muted hover:bg-red-500/10 hover:text-red-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
                <div className="text-[9px] mono break-all leading-relaxed p-2 rounded-lg border select-all text-muted bg-panel-2 border-app">ID: {session.id}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppServer;

