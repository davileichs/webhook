
export const generateId = () => {
  // Simple UUID v4-ish generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const formatTimestamp = (ts: number) => {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const tryParseJson = (data: string): any | null => {
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
};

export const getStatusColor = (method: string) => {
  switch (method.toUpperCase()) {
    case 'POST': return 'text-green-400 bg-green-400/10';
    case 'GET': return 'text-blue-400 bg-blue-400/10';
    case 'PUT': return 'text-yellow-400 bg-yellow-400/10';
    case 'DELETE': return 'text-red-400 bg-red-400/10';
    default: return 'text-slate-400 bg-slate-400/10';
  }
};

export const serializeState = (data: any): string => {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch (e) {
    console.error("Failed to serialize state", e);
    return "";
  }
};

export const deserializeState = (str: string): any => {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch (e) {
    console.error("Failed to deserialize state", e);
    return null;
  }
};

export const downloadJson = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
