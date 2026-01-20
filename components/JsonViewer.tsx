
import React from 'react';

interface JsonViewerProps {
  data: any;
  theme?: 'dark' | 'light';
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, theme = 'dark' }) => {
  const jsonString = JSON.stringify(data, null, 2);
  const isDark = theme === 'dark';

  return (
    <div className={`rounded-lg p-4 overflow-auto max-h-[500px] border transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
      <pre className={`mono text-sm leading-relaxed ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
        {jsonString.split('\n').map((line, i) => (
          <div key={i} className={`flex transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-200/50'}`}>
            <span className={`mr-4 select-none w-6 shrink-0 text-right ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
};

export default JsonViewer;
