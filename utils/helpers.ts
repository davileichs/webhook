
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
    case 'POST': return 'badge-post';
    case 'GET': return 'badge-get';
    case 'PUT': return 'badge-put';
    case 'DELETE': return 'badge-delete';
    default: return 'badge-default';
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

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  // Modern async Clipboard API (requires secure context; may be unavailable in some environments)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fall through to legacy method
    console.warn('Clipboard API copy failed, trying fallback.', e);
  }

  // Fallback for older/locked-down browsers
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, el.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch (e) {
    console.warn('Fallback copy failed.', e);
    return false;
  }
};
