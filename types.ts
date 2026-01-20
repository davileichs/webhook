
export interface Session {
  id: string; // The UUID hook value
  name: string;
  created: number;
}

export interface WebhookRequest {
  id: string;
  endpointId: string; // Associated session ID
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  query: Record<string, string>;
  parsedBody: any | null;
  origin: string;
}

export interface AppState {
  sessions: Session[];
  activeSessionId: string | null;
  requests: WebhookRequest[];
}
