import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { agentApi, AgentApi, AgentInfo } from '@/agent/client';
import { findAgent } from '@/agent/locate';
import { resolveRelayUrl, setRelayUrl } from '@/onvif/relay';

const AGENT_KEY = 'zeroforg.agent_url';

type AgentValue = {
  /** Null when no agent is on the network; the app then does the work itself. */
  api: AgentApi | null;
  info: AgentInfo | null;
  /**
   * The go2rtc relay on this agent's box, as reachable from this phone, or ''
   * when there is none. Screens that offer LAN video gate on it being set.
   */
  relayUrl: string;
  /** False while the first search is still running. */
  ready: boolean;
  searching: boolean;
  /** Re-checks the address the agent was last seen on. Cheap; no sweep. */
  refresh: () => Promise<void>;
  /**
   * Walks the whole subnet looking for a box. Seconds, not milliseconds, so
   * only call it from a screen that cannot work without an agent and can show
   * that it is searching.
   */
  discover: () => Promise<void>;
};

const AgentContext = createContext<AgentValue | null>(null);

/**
 * Keeps track of the local agent, if there is one.
 *
 * At launch it only re-checks the address the agent was last seen on. Finding
 * one that has moved means sweeping the subnet, which is slow enough to be
 * worth asking for explicitly — see `discover`.
 *
 * When one is found the app delegates discovery, connecting and pan/tilt to it:
 * the agent finds cameras by multicast rather than sweeping addresses, checks
 * the video actually decodes, and keeps camera passwords off the phone. With no
 * agent the app does all of it directly, which needs nothing installed.
 */
export function AgentProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [searching, setSearching] = useState(false);

  const look = useCallback(async (sweep: boolean) => {
    setSearching(true);
    try {
      const known = await SecureStore.getItemAsync(AGENT_KEY);
      const found = await findAgent(known, { sweep });
      setInfo(found);
      if (found) await SecureStore.setItemAsync(AGENT_KEY, found.agent_url);
    } finally {
      setSearching(false);
      setReady(true);
    }
  }, []);

  const refresh = useCallback(() => look(false), [look]);
  const discover = useCallback(() => look(true), [look]);

  /**
   * At launch, only re-check where the agent was last seen. That is one request
   * that usually succeeds on the network the box lives on, and fails in about a
   * second anywhere else. The full sweep waits until a screen asks for it.
   */
  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * The relay travels two ways on purpose: through the context for screens that
   * decide whether to offer LAN video at all, and into the relay module itself,
   * whose publish/unpublish calls happen outside React during onboarding.
   */
  const relayUrl = useMemo(() => resolveRelayUrl(info), [info]);

  useEffect(() => {
    setRelayUrl(relayUrl);
  }, [relayUrl]);

  const value = useMemo<AgentValue>(
    () => ({
      api: info ? agentApi(info.agent_url) : null,
      info,
      relayUrl,
      ready,
      searching,
      refresh,
      discover,
    }),
    [info, relayUrl, ready, searching, refresh, discover],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentValue {
  const value = useContext(AgentContext);
  if (!value) throw new Error('useAgent must be used inside AgentProvider.');
  return value;
}
