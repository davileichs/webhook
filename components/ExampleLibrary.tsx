
import React from 'react';
import { WebhookRequest } from '../types';
import { generateId } from '../utils/helpers';

interface ExampleLibraryProps {
  onSelect: (req: WebhookRequest) => void;
  theme?: 'dark' | 'light';
}

const TEMPLATES = [
  {
    name: 'Stripe: Payment Intent',
    method: 'POST',
    body: {
      id: "evt_1Nl...J9",
      object: "event",
      api_version: "2022-11-15",
      created: 1693564000,
      data: {
        object: {
          id: "pi_3Nl...8a",
          amount: 2000,
          currency: "usd",
          status: "succeeded",
          payment_method_types: ["card"]
        }
      },
      type: "payment_intent.succeeded"
    }
  },
  {
    name: 'Marketing: Lead Capture',
    method: 'GET',
    query: {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane.doe@example.com",
      phone: "+15550199",
      source: "facebook_ads"
    },
    body: ""
  },
  {
    name: 'GitHub: Push Event',
    method: 'POST',
    body: {
      ref: "refs/heads/main",
      repository: {
        name: "hook-log",
        full_name: "user/hook-log"
      },
      commits: [{ id: "83c1...23", message: "Update README.md" }]
    }
  }
];

const ExampleLibrary: React.FC<ExampleLibraryProps> = ({ onSelect, theme = 'dark' }) => {
  const isDark = theme === 'dark';

  return (
    <div className="grid grid-cols-1 gap-2">
      {TEMPLATES.map((t) => (
        <button
          key={t.name}
          onClick={() => {
            onSelect({
              id: generateId(),
              endpointId: '', // Set by App
              timestamp: Date.now(),
              method: t.method,
              url: `https://hooklog.app/callback?hook=active${t.query ? '&' + new URLSearchParams(t.query as any).toString() : ''}`,
              headers: { 
                'Content-Type': t.body ? 'application/json' : 'text/html', 
                'User-Agent': `${t.name.split(':')[0]} Webhook`,
                'X-Request-Id': generateId()
              },
              body: t.body ? (typeof t.body === 'string' ? t.body : JSON.stringify(t.body)) : '',
              query: (t.query as any) || { hook: 'active' },
              parsedBody: t.body || null,
              origin: '8.8.8.8'
            });
          }}
          className={`text-left p-3 rounded-lg border transition-all group ${isDark ? 'bg-slate-800/50 hover:bg-slate-800 border-slate-700' : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm hover:shadow'}`}
        >
          <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-tight">{t.method}</div>
          <div className={`text-xs font-semibold ${isDark ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{t.name}</div>
        </button>
      ))}
    </div>
  );
};

export default ExampleLibrary;
