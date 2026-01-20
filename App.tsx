
import React, { useState, useEffect, useRef } from 'react';
import { WebhookRequest, Session } from './types';
import { generateId, tryParseJson } from './utils/helpers';
import RequestViewer from './components/RequestViewer';
import ExampleLibrary from './components/ExampleLibrary';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Renaming state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState("");
  
  const editInputRef = useRef<HTMLInputElement>(null);

  // Initialize App
  useEffect(() => {
    // 1. Theme
    const savedTheme = localStorage.getItem('hooklog_theme') as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);

    // 2. Data from LocalStorage
    const savedSessions = localStorage.getItem('hooklog_sessions');
    const savedRequests = localStorage.getItem('hooklog_requests');
    
    let initialSessions: Session[] = [];
    if (savedSessions) {
      try {
        initialSessions = JSON.parse(savedSessions);
      } catch (e) { initialSessions = []; }
    }

    if (initialSessions.length === 0) {
      const defaultId = generateId();
      initialSessions = [{ id: defaultId, name: 'Default Session', created: Date.now() }];
    }
    setSessions(initialSessions);

    if (savedRequests) {
      try {
        setRequests(JSON.parse(savedRequests));
      } catch (e) { setRequests([]); }
    }

    // 3. Handle URL capture/switch
    const urlParams = new URLSearchParams(window.location.search);
    const hookId = urlParams.get('hook');
    
    if (hookId) {
      // Find or create session
      const existing = initialSessions.find(s => s.id === hookId);
      if (existing) {
        setActiveSessionId(hookId);
      } else {
        const newS: Session = { id: hookId, name: `Imported Hook`, created: Date.now() };
        setSessions(prev => [...prev, newS]);
        setActiveSessionId(hookId);
      }

      // Check if this is a "Callback" or just a "Paste"
      // Rules: 
      // - If navigation is 'navigate' (address bar paste), it's a UI switch.
      // - If there are other parameters, it might be a GET callback.
      // - The user requested: "Only accept callback when it is not browser"
      
      // Fix: Cast to any to access 'type' property on PerformanceEntry which might not be defined in some TS environments
      const navEntries = window.performance.getEntriesByType("navigation");
      const isBrowserPaste = (navEntries[0] as any)?.type === "navigate";
      const hasData = Array.from(urlParams.keys()).some(k => k !== 'hook');

      if (hasData && !isBrowserPaste) {
        // This is a simulated/external callback (e.g. from an iframe, fetch, or tool)
        const queryData: Record<string, string> = {};
        urlParams.forEach((v, k) => { if (k !== 'hook') queryData[k] = v; });

        const newReq: WebhookRequest = {
          id: generateId(),
          endpointId: hookId,
          timestamp: Date.now(),
          method: 'GET',
          url: window.location.href,
          headers: { 'User-Agent': navigator.userAgent, 'Accept': '*/*' },
          body: '',
          query: queryData,
          parsedBody: null,
          origin: 'remote'
        };
        setRequests(prev => [newReq, ...prev]);
        setSelectedRequestId(newReq.id);
      }

      // Clean URL to prevent re-capturing on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (initialSessions.length > 0) {
      setActiveSessionId(initialSessions[0].id);
    }
  }, []);

  // Persistent Save
  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem('hooklog_sessions', JSON.stringify(sessions));
    localStorage.setItem('hooklog_requests', JSON.stringify(requests));
    localStorage.setItem('hooklog_theme', theme);
    
    // Update body class for global background transitions
    document.body.className = theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  }, [sessions, requests, theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const createSession = () => {
    const uuid = generateId();
    const newName = `Session ${sessions.length + 1}`;
    const newSession: Session = { id: uuid, name: newName, created: Date.now() };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(uuid);
    setEditingSessionId(uuid);
    setEditingSessionName(newName);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this session and all its history?")) {
      const updated = sessions.filter(s => s.id !== id);
      setSessions(updated);
      setRequests(prev => prev.filter(r => r.endpointId !== id));
      if (activeSessionId === id) {
        setActiveSessionId(updated.length > 0 ? updated[0].id : null);
        setSelectedRequestId(null);
      }
    }
  };

  const startRenaming = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingSessionName(session.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveRename = () => {
    if (!editingSessionId) return;
    const trimmed = editingSessionName.trim();
    if (trimmed) {
      setSessions(prev => prev.map(s => s.id === editingSessionId ? { ...s, name: trimmed } : s));
    }
    setEditingSessionId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') setEditingSessionId(null);
  };

  const addRequest = (req: WebhookRequest) => {
    if (!activeSessionId) return;
    const newReq = { ...req, endpointId: activeSessionId };
    setRequests(prev => [newReq, ...prev]);
    setSelectedRequestId(newReq.id);
  };

  const clearHistory = () => {
    if (confirm("Clear all request history for this session?")) {
      setRequests(prev => prev.filter(r => r.endpointId !== activeSessionId));
      setSelectedRequestId(null);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const filteredRequests = requests.filter(r => r.endpointId === activeSessionId);
  const selectedRequest = requests.find(r => r.id === selectedRequestId);
  const isDark = theme === 'dark';

  const currentWebhookUrl = activeSessionId 
    ? `${window.location.origin}${window.location.pathname}?hook=${activeSessionId}`
    : "No active session";

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(currentWebhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Sidebar: History */}
      <div className={`w-80 flex flex-col border-r shrink-0 transition-colors ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
        <div className={`p-6 border-b space-y-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h1 className="text-xl font-bold tracking-tight">HookLog</h1>
            </div>
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {isDark ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.071 16.071l.707.707M7.757 7.757l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Webhook Endpoint</label>
              {activeSessionId && <button onClick={copyWebhookUrl} className="text-[10px] text-blue-600 font-bold hover:underline uppercase">Copy</button>}
            </div>
            <div className={`p-2 border rounded text-[10px] font-mono truncate select-all cursor-pointer transition-colors ${isDark ? 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`} onClick={copyWebhookUrl}>
              {currentWebhookUrl}
            </div>
            <div className="flex gap-2">
              <button onClick={clearHistory} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${isDark ? 'bg-slate-800 hover:bg-red-900/20 text-slate-400 border-slate-700 hover:border-red-500/50' : 'bg-white hover:bg-red-50 text-slate-500 border-slate-200 hover:border-red-200'}`}>Clear History</button>
              <button onClick={copyWebhookUrl} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                {copied ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          <section>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-3 px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>History ({filteredRequests.length})</h3>
            <div className="space-y-2">
              {filteredRequests.length === 0 ? (
                <div className={`text-center py-8 rounded-xl border border-dashed ${isDark ? 'bg-slate-900/30 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  <p className="text-[10px] uppercase tracking-wider">No callbacks recorded</p>
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${selectedRequestId === req.id ? (isDark ? 'bg-blue-600/10 border-blue-500/50 shadow-blue-900/20 shadow-lg' : 'bg-blue-50 border-blue-200 shadow-sm') : (isDark ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800' : 'bg-white border-slate-200 hover:border-slate-300')}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(req.timestamp).toLocaleTimeString()}</span>
                      <span className={`text-[9px] font-bold uppercase ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>{req.method}</span>
                    </div>
                    <div className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{req.parsedBody?.event || req.parsedBody?.type || req.parsedBody?.action || 'Callback Received'}</div>
                  </button>
                ))
              )}
            </div>
          </section>
          <section>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-3 px-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Templates</h3>
            <ExampleLibrary onSelect={addRequest} theme={theme} />
          </section>
        </div>
      </div>

      {/* Main content: Viewer */}
      <main className={`flex-1 overflow-hidden transition-colors border-r ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        {selectedRequest ? <RequestViewer request={selectedRequest} theme={theme} /> : (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border transition-all ${isDark ? 'bg-slate-900 border-slate-800 shadow-xl' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeSession ? `Waiting for callbacks on ${activeSession.name}` : 'Create a Session to Start'}</h2>
            <p className={`text-center max-w-sm text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Use the generated URL in your webhook settings. Any incoming call will appear in the history automatically.</p>
          </div>
        )}
      </main>

      {/* Sidebar: Sessions */}
      <div className={`w-72 flex flex-col shrink-0 transition-colors ${isDark ? 'bg-slate-900/50 border-l border-slate-800' : 'bg-slate-100/30 border-l border-slate-200'}`}>
        <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sessions</h3>
          <button onClick={createSession} className="p-1.5 text-blue-600 hover:bg-blue-600 hover:text-white rounded-full transition-all border border-blue-600/20 active:scale-90" title="New Session">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => { setActiveSessionId(session.id); setSelectedRequestId(null); }}
              className={`group relative flex flex-col p-4 rounded-xl cursor-pointer transition-all border shadow-sm ${activeSessionId === session.id ? (isDark ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/20' : 'bg-white border-blue-500 shadow-blue-500/10') : (isDark ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300')}`}
            >
              <div className="flex justify-between items-start mb-2">
                {editingSessionId === session.id ? (
                  <input ref={editInputRef} className={`text-sm font-bold border rounded px-2 py-1 w-full mr-2 focus:outline-none focus:ring-2 ${isDark ? 'bg-slate-900 text-blue-400 border-blue-500/50' : 'bg-slate-50 text-blue-600 border-blue-300'}`} value={editingSessionName} onChange={(e) => setEditingSessionName(e.target.value)} onBlur={saveRename} onKeyDown={handleRenameKeyDown} onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span className={`text-sm font-bold truncate flex-1 leading-tight hover:underline underline-offset-4 decoration-blue-500/50 ${activeSessionId === session.id ? 'text-blue-600' : (isDark ? 'text-slate-200' : 'text-slate-800')}`} onClick={(e) => startRenaming(session, e)} title="Click to rename">{session.name}</span>
                )}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => startRenaming(session, e)} className={`p-1 rounded ${isDark ? 'hover:bg-slate-700 text-slate-500 hover:text-blue-400' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-600'}`}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                  <button onClick={(e) => deleteSession(session.id, e)} className={`p-1 rounded ${isDark ? 'hover:bg-slate-700 text-slate-500 hover:text-red-400' : 'hover:bg-slate-100 text-slate-400 hover:text-red-600'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
              </div>
              <div className={`text-[9px] font-mono break-all leading-relaxed p-2 rounded-lg border select-all ${isDark ? 'text-slate-500 bg-black/20 border-white/5' : 'text-slate-500 bg-slate-50 border-slate-200'}`}>hook={session.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
