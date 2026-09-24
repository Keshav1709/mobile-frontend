import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';

/**
 * The dashboard's live WebSocket (`/api/v1/vms/ws/live`), one connection per session.
 *
 * Ported from the web console's `lib/console/liveSocket.ts`. The server authenticates
 * the token in the query string, requires `live.view`, fans out per organisation and
 * pushes `init | cameras | stats | detections | event | flow_event | kpi_update | alert`.
 * Nothing on the server was built for this; the app is simply a second client of it.
 *
 * Two things a phone must do that a browser tab never had to:
 *
 *   - Backgrounding. iOS and Android suspend sockets when the app leaves the screen.
 *     Rather than trust a connection that may or may not have survived, the socket is
 *     closed on background and reopened on foreground.
 *
 *   - Token freshness. The token goes in the URL, so it must be minted right before
 *     connecting — a cached one that expired while the phone was in a pocket closes
 *     with 4003 and is not retried.
 *
 * The socket is per organisation. The open centre goes in the URL as `org_id`, which
 * the server honours on the same terms as `X-Org-ID` and — unlike HTTP — refuses with
 * 4003 rather than silently streaming the account's own centre. A switch tears the
 * socket down and opens a new one. `forOrgId` is what the server actually confirmed:
 * learned from the `org_id` on pushed payloads, so screens can trust it.
 */

export interface WsDetection {
  track_id?: number | null;
  class_name: string;
  confidence: number;
  bbox: [number, number, number, number];
  name?: string | null;
  person?: string | null;
}

export interface DetectionsPayload {
  camera_id: string;
  timestamp?: string | number;
  frame_w?: number;
  frame_h?: number;
  detections: WsDetection[];
}

export interface CameraEvent {
  camera_id: string;
  timestamp: string;
  event_type: string;
  direction?: string;
  detections?: WsDetection[];
  counts?: { IN: number; OUT: number };
}

export interface CameraStats {
  camera_id: string;
  status: string;
  total_in: number;
  total_out: number;
  last_event: string | null;
  events_per_minute: number;
}

export interface LiveFlowEvent {
  id: string;
  event_type: string;
  camera_id: string;
  zone_id?: string | null;
  zone_name?: string | null;
  direction?: string | null;
  class_name?: string | null;
  timestamp?: string | null;
  received_at: number;
}

export interface LiveAlert {
  id?: string;
  alert_id?: string;
  type?: string;
  severity?: string;
  camera_id?: string | null;
  location?: string | null;
  at?: string | null;
  received_at: number;
}

export interface LiveState {
  isConnected: boolean;
  /** The organisation this socket streams — the account's default, see the note above. */
  forOrgId: string | null;
  cameras: CameraStats[];
  recentEvents: CameraEvent[];
  detectionsByCamera: Record<string, WsDetection[]>;
  frameByCamera: Record<string, { w: number; h: number; at: number }>;
  flowEvents: LiveFlowEvent[];
  lastAlert: LiveAlert | null;
  /** Bumps on every `alert` and `event`; lists can refetch on it. */
  revision: number;
}

const EMPTY: LiveState = {
  isConnected: false,
  forOrgId: null,
  cameras: [],
  recentEvents: [],
  detectionsByCamera: {},
  frameByCamera: {},
  flowEvents: [],
  lastAlert: null,
  revision: 0,
};

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 60_000;
const KEEPALIVE_MS = 25_000;
const KEEP_EVENTS = 50;

/** Same host as the REST base, on the socket scheme. */
function wsBase(): string | null {
  const http = process.env.EXPO_PUBLIC_DASHBOARD_URL;
  if (!http) return null;
  return http.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:').replace(/\/+$/, '');
}

const LiveContext = createContext<LiveState>(EMPTY);

export function LiveProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, getToken } = useAuth();
  const { can, status: consoleStatus, orgId } = useConsole();
  const [state, setState] = useState<LiveState>(EMPTY);

  const socket = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepalive = useRef<ReturnType<typeof setInterval> | null>(null);
  const retries = useRef(0);
  const wanted = useRef(false);

  // Only once the console has loaded do we know whether this login may watch live at
  // all. Opening a socket the server will close with 4003 is noise, not a retry case.
  const allowed = authStatus === 'signedIn' && consoleStatus === 'ready' && can('live.view');

  const clearTimers = useCallback(() => {
    if (keepalive.current) {
      clearInterval(keepalive.current);
      keepalive.current = null;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimers();
    const ws = socket.current;
    socket.current = null;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close();
    }
    setState((prev) => (prev.isConnected ? { ...prev, isConnected: false } : prev));
  }, [clearTimers]);

  const connect = useCallback(async () => {
    if (!wanted.current) return;
    if (socket.current && socket.current.readyState === WebSocket.OPEN) return;
    const base = wsBase();
    if (!base) return;

    const token = await getToken();
    if (!token || !wanted.current) return;

    const org = orgId ? `&org_id=${encodeURIComponent(orgId)}` : '';
    const ws = new WebSocket(`${base}/vms/ws/live?token=${encodeURIComponent(token)}${org}`);
    socket.current = ws;

    ws.onopen = () => {
      retries.current = 0;
      setState((prev) => ({ ...prev, isConnected: true, forOrgId: orgId }));
      keepalive.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, KEEPALIVE_MS);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      let data: { type?: string; payload?: unknown; cameras?: unknown; recent_events?: unknown };
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      // Pushed payloads name their organisation. That is the one authoritative answer
      // to "which centre is this socket streaming" — verified against production, where
      // detections and events arrived tagged with the account's default org.
      const orgOfPayload = (data.payload as { org_id?: unknown } | undefined)?.org_id;
      if (typeof orgOfPayload === 'string') {
        setState((prev) => (prev.forOrgId === orgOfPayload ? prev : { ...prev, forOrgId: orgOfPayload }));
      }
      switch (data.type) {
        case 'init':
          setState((prev) => ({
            ...prev,
            cameras: Array.isArray(data.cameras) ? (data.cameras as CameraStats[]) : prev.cameras,
            recentEvents: Array.isArray(data.recent_events)
              ? (data.recent_events as CameraEvent[]).slice(0, KEEP_EVENTS)
              : prev.recentEvents,
          }));
          break;
        case 'cameras':
          if (Array.isArray(data.payload)) {
            setState((prev) => ({ ...prev, cameras: data.payload as CameraStats[] }));
          }
          break;
        case 'detections': {
          const payload = data.payload as DetectionsPayload | undefined;
          if (!payload || typeof payload.camera_id !== 'string') break;
          const frame =
            payload.frame_w && payload.frame_h
              ? { w: payload.frame_w, h: payload.frame_h, at: Date.now() }
              : null;
          setState((prev) => ({
            ...prev,
            detectionsByCamera: {
              ...prev.detectionsByCamera,
              [payload.camera_id]: Array.isArray(payload.detections) ? payload.detections : [],
            },
            frameByCamera: frame
              ? { ...prev.frameByCamera, [payload.camera_id]: frame }
              : prev.frameByCamera,
          }));
          break;
        }
        case 'event': {
          const next = data.payload as CameraEvent | undefined;
          if (!next?.camera_id) break;
          setState((prev) => ({
            ...prev,
            cameras: prev.cameras.map((cam) =>
              cam.camera_id === next.camera_id
                ? {
                    ...cam,
                    last_event: next.timestamp,
                    total_in: next.counts?.IN ?? cam.total_in,
                    total_out: next.counts?.OUT ?? cam.total_out,
                  }
                : cam,
            ),
            recentEvents: [next, ...prev.recentEvents].slice(0, KEEP_EVENTS),
            revision: prev.revision + 1,
          }));
          break;
        }
        case 'flow_event': {
          const payload = data.payload as Omit<LiveFlowEvent, 'received_at'> | undefined;
          if (!payload?.id) break;
          setState((prev) => ({
            ...prev,
            flowEvents: [{ ...payload, received_at: Date.now() }, ...prev.flowEvents].slice(0, KEEP_EVENTS),
          }));
          break;
        }
        case 'alert': {
          const payload = (data.payload ?? {}) as Omit<LiveAlert, 'received_at'>;
          setState((prev) => ({
            ...prev,
            lastAlert: { ...payload, received_at: Date.now() },
            revision: prev.revision + 1,
          }));
          break;
        }
        default:
          break;
      }
    };

    ws.onclose = (event) => {
      if (socket.current === ws) socket.current = null;
      clearTimers();
      setState((prev) => ({ ...prev, isConnected: false }));
      if (!wanted.current) return;
      // 4003: the token was refused or the login lacks live.view. A retry with the
      // same credentials would be refused the same way.
      if (event.code === 4001 || event.code === 4003) return;
      const delay = Math.min(INITIAL_RECONNECT_MS * 2 ** retries.current, MAX_RECONNECT_MS);
      retries.current += 1;
      reconnectTimer.current = setTimeout(() => void connect(), delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [getToken, clearTimers, orgId]);

  // Open while allowed; close (and forget the state) when not. `orgId` is in the
  // dependency list through `connect`: a centre switch is a new socket, and the old
  // one's cameras and events must not linger under the new centre's name.
  useEffect(() => {
    wanted.current = allowed;
    setState(EMPTY);
    if (allowed) {
      retries.current = 0;
      void connect();
    } else {
      close();
    }
    return () => {
      wanted.current = false;
      close();
    };
  }, [allowed, connect, close]);

  // Foreground / background.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (!wanted.current) return;
      if (next === 'active') {
        retries.current = 0;
        void connect();
      } else if (next === 'background') {
        clearTimers();
        const ws = socket.current;
        socket.current = null;
        if (ws) {
          ws.onclose = null;
          ws.close();
        }
        setState((prev) => ({ ...prev, isConnected: false }));
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [connect, clearTimers]);

  const value = useMemo(() => state, [state]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/** Shared live state from the single socket. Empty (and never connected) outside the provider. */
export function useLive(): LiveState {
  return useContext(LiveContext);
}
