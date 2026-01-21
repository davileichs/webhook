
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

  const hasBody = request.body && request.body.trim().length > 0;
  const hasQuery = Object.keys(request.query).length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden transition-colors bg-app text-app">
      {/* Top Sticky Header */}
      <div className="p-6 border-b z-10 shrink-0 transition-colors border-app bg-app backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(request.method)}`}>
              {request.method}
            </span>
            <h2 className="text-xl font-semibold text-app">Request Details</h2>
          </div>
          <span className="text-sm font-medium text-muted">
            {formatTimestamp(request.timestamp)} • {new Date(request.timestamp).toLocaleDateString()}
          </span>
        </div>
        <div className="p-3 rounded border border-app bg-panel-2 mono text-xs break-all leading-relaxed transition-colors text-muted">
          {request.url}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        
        {/* Headers Section */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-muted-2">Headers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(request.headers).map(([key, value]) => (
              <div key={key} className="flex flex-col p-3 rounded border border-app transition-colors group bg-panel hover-panel">
                <span className="text-accent font-medium truncate mono text-[10px] uppercase tracking-widest mb-1">{key}</span>
                <span className="break-all text-xs mono leading-relaxed text-muted">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-10">
          
          {/* Payload / Body Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-2">Payload / Body</h3>
            </div>
            <div className="space-y-4">
              {request.parsedBody ? (
                <JsonViewer data={request.parsedBody} theme={theme} />
              ) : hasBody ? (
                <pre className="p-4 rounded-lg mono text-sm border border-app bg-panel whitespace-pre-wrap overflow-x-auto transition-colors text-muted">
                  {request.body}
                </pre>
              ) : (
                <div className="italic py-8 text-center rounded-xl border border-dashed text-sm transition-colors text-muted bg-panel-2 border-app">
                  No request body content
                </div>
              )}
            </div>
          </section>

          {/* Query Parameters Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-2">Query Parameters</h3>
              {hasQuery && (
                <div className="flex rounded-lg p-1 border transition-colors bg-panel border-app">
                  <button 
                    onClick={() => setQueryViewMode('json')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${queryViewMode === 'json' ? 'bg-accent shadow-sm' : 'text-muted btn-ghost'}`}
                  >
                    JSON
                  </button>
                  <button 
                    onClick={() => setQueryViewMode('list')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${queryViewMode === 'list' ? 'bg-accent shadow-sm' : 'text-muted btn-ghost'}`}
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
                      <div key={key} className="flex p-3 rounded border border-app transition-colors bg-panel hover-panel">
                        <span className="text-accent font-medium w-1/3 truncate pr-4 mono text-[11px] uppercase tracking-tight">{key}</span>
                        <span className="flex-1 break-all text-sm mono text-muted">{value}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="italic py-8 text-center rounded-xl border border-dashed text-sm transition-colors text-muted bg-panel-2 border-app">
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
