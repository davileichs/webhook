
import React from 'react';

interface JsonViewerProps {
  data: any;
  theme?: 'dark' | 'light';
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, theme = 'dark' }) => {
  const jsonString = JSON.stringify(data, null, 2);
  void theme;

  return (
    <div className="rounded-lg p-4 overflow-auto max-h-[500px] border border-app transition-colors bg-panel">
      <pre className="mono text-sm leading-relaxed text-muted">
        {jsonString.split('\n').map((line, i) => (
          <div key={i} className="flex transition-colors hover-panel">
            <span className="mr-4 select-none w-6 shrink-0 text-right text-muted-2">{i + 1}</span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
};

export default JsonViewer;
