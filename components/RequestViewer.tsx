
import React, { useState } from 'react';
import { WebhookRequest } from '../types';
import { getStatusColor, formatTimestamp } from '../utils/helpers';
import JsonViewer from './JsonViewer';

interface RequestViewerProps {
  request: WebhookRequest;
  theme?: 'dark' | 'light';
}

const RequestViewer: React.FC<RequestViewerProps> = ({ request, theme = 'dark' }) => {
  const [queryViewMode, setQueryViewMode] = useState<'list' | 'json'>('json');
  const isDark = theme === 'dark';

  const hasBody = request.body && request.body.trim().length > 0;
  const hasQuery = Object.keys(request.query).length > 0;

  return (
    <div className={`flex flex-col h-full overflow-hidden transition-colors ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Top Sticky Header */}
      <div className={`p-6 border-b z-10 shrink-0 transition-colors ${isDark ? 'border-slate-800 bg-slate-950/80 backdrop-blur-md' : 'border-slate-200 bg-white/80 backdrop-blur-md'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(request.method)}`}>
              {request.method}
            </span>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Request Details</h2>
          </div>
          <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {formatTimestamp(request.timestamp)} • {new Date(request.timestamp).toLocaleDateString()}
          </span>
        </div>
        <div className={`p-3 rounded border mono text-xs break-all leading-relaxed transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          {request.url}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        
        {/* Headers Section */}
        <section>
          <h3 className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Headers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(request.headers).map(([key, value]) => (
              <div key={key} className={`flex flex-col p-3 rounded border transition-colors group hover:border-slate-700 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-blue-600 font-medium truncate mono text-[10px] uppercase tracking-widest mb-1">{key}</span>
                <span className={`break-all text-xs mono leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-10">
          
          {/* Payload / Body Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Payload / Body</h3>
              {!hasBody && hasQuery && (
                <span className="text-[10px] bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded border border-yellow-500/20 font-bold uppercase">
                  Query Fallback
                </span>
              )}
            </div>
            <div className="space-y-4">
              {request.parsedBody ? (
                <JsonViewer data={request.parsedBody} theme={theme} />
              ) : hasBody ? (
                <pre className={`p-4 rounded-lg mono text-sm border whitespace-pre-wrap overflow-x-auto transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  {request.body}
                </pre>
              ) : hasQuery ? (
                <div className="space-y-4">
                  <JsonViewer data={request.query} theme={theme} />
                </div>
              ) : (
                <div className={`italic py-8 text-center rounded-xl border border-dashed text-sm transition-colors ${isDark ? 'text-slate-500 bg-slate-900/50 border-slate-800' : 'text-slate-400 bg-slate-50/50 border-slate-200'}`}>
                  No request body content
                </div>
              )}
            </div>
          </section>

          {/* Query Parameters Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Query Parameters</h3>
              {hasQuery && (
                <div className={`flex rounded-lg p-1 border transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                  <button 
                    onClick={() => setQueryViewMode('json')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${queryViewMode === 'json' ? 'bg-blue-600 text-white shadow-sm' : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-900')}`}
                  >
                    JSON
                  </button>
                  <button 
                    onClick={() => setQueryViewMode('list')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${queryViewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-900')}`}
                  >
                    LIST
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {hasQuery ? (
                queryViewMode === 'json' ? (
                  <JsonViewer data={request.query} theme={theme} />
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(request.query).map(([key, value]) => (
                      <div key={key} className={`flex p-3 rounded border transition-colors ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                        <span className="text-blue-600 font-medium w-1/3 truncate pr-4 mono text-[11px] uppercase tracking-tight">{key}</span>
                        <span className={`flex-1 break-all text-sm mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className={`italic py-8 text-center rounded-xl border border-dashed text-sm transition-colors ${isDark ? 'text-slate-500 bg-slate-900/50 border-slate-800' : 'text-slate-400 bg-slate-50/50 border-slate-200'}`}>
                  No query parameters provided
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RequestViewer;
