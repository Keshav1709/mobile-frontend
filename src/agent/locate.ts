import { agentApi, AgentInfo } from './client';
import { localSubnet } from '@/onvif/scan';

/**
 * Finds an agent on the network, cheapest check first.
 *
 * Most installations run the agent on the same machine as the video relay, so
 * that host is tried before falling back to a sweep of the subnet.
 */

const AGENT_PORT = 8765;
const PROBE_TIMEOUT_MS = 1200;
const SWEEP_CONCURRENCY = 24;

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').split(':')[0];

async function probe(host: string): Promise<AgentInfo | null> {
  try {
    const info = await agentApi(`http://${host}:${AGENT_PORT}`).info();
    return info.service === 'zeroforg-agent' ? info : null;
  } catch {
    return null;
  }
}

export async function findAgent(known?: string | null): Promise<AgentInfo | null> {
  const candidates: string[] = [];
  if (known) candidates.push(hostOf(known));

  const relay = process.env.EXPO_PUBLIC_GO2RTC_URL;
  if (relay) candidates.push(hostOf(relay));

  for (const host of candidates) {
    const info = await probe(host);
    if (info) return info;
  }

  // Nothing obvious: walk the subnet. One port, so it stays quick.
  const subnet = await localSubnet();
  if (!subnet) return null;

  let cursor = 0;
  let found: AgentInfo | null = null;

  const worker = async () => {
    while (cursor < subnet.hosts.length && !found) {
      const host = subnet.hosts[cursor];
      cursor += 1;
      const info = await withTimeout(probe(host));
      if (info) found = info;
    }
  };

  await Promise.all(Array.from({ length: SWEEP_CONCURRENCY }, worker));
  return found;
}

function withTimeout(promise: Promise<AgentInfo | null>): Promise<AgentInfo | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PROBE_TIMEOUT_MS)),
  ]);
}
