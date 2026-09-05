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

const AGENT_KEY = 'zeroforg.agent_url';

type AgentValue = {
  /** Null when no agent is on the network; the app then does the work itself. */
  api: AgentApi | null;
  info: AgentInfo | null;
  /** False while the first search is still running. */
  ready: boolean;
  searching: boolean;
  /** Looks again, e.g. after the agent is started on the network. */
  refresh: () => Promise<void>;
};

const AgentContext = createContext<AgentValue | null>(null);

/**
 * Looks for a local agent once at start-up.
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

  const refresh = useCallback(async () => {
    setSearching(true);
    try {
      const known = await SecureStore.getItemAsync(AGENT_KEY);
      const found = await findAgent(known);
      setInfo(found);
      if (found) await SecureStore.setItemAsync(AGENT_KEY, found.agent_url);
    } finally {
      setSearching(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AgentValue>(
    () => ({
      api: info ? agentApi(info.agent_url) : null,
      info,
      ready,
      searching,
      refresh,
    }),
    [info, ready, searching, refresh],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentValue {
  const value = useContext(AgentContext);
  if (!value) throw new Error('useAgent must be used inside AgentProvider.');
  return value;
}
