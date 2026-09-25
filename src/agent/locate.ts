import { agentApi, AgentInfo } from './client';
import { localSubnet } from '@/onvif/scan';

/**
 * Finds an agent on the network, cheapest check first.
 *
 * Most installations run the agent on the same machine as the video relay, so
 * that host is tried before anything else.
 *
 * The subnet sweep is deliberately **not** the default. It probes 253 addresses
 * and, on a network with no box on it, every one of them fails slowly: about
 * thirteen seconds during which the phone is holding dozens of dead sockets and
 * every other request in the app is queued behind them. Most sessions never go
 * near a screen that needs the agent, so that cost was being paid at launch for
 * nothing. `sweep` is opt-in, and only the screens that genuinely need a box —
 * adding a camera, checking the box itself — ask for it.
 */

const AGENT_PORT = 8765;
/**
 * How long one address gets. Also the fetch's own timeout, so the socket is
 * actually closed when we stop waiting: racing a timer against a fetch that
 * keeps running just means three times as many sockets open at once.
 */
const PROBE_TIMEOUT_MS = 1200;
const SWEEP_CONCURRENCY = 24;

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').split(':')[0];

async function probe(host: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<AgentInfo | null> {
  try {
    const info = await agentApi(`http://${host}:${AGENT_PORT}`).info(timeoutMs);
    return info.service === 'zeroforg-agent' ? info : null;
  } catch {
    return null;
  }
}

/**
 * @param known   The agent's address last time it was seen, if any.
 * @param options `sweep` walks the whole subnet when the known host misses.
 */
export async function findAgent(
  known?: string | null,
  { sweep = false }: { sweep?: boolean } = {},
): Promise<AgentInfo | null> {
  const candidates: string[] = [];
  if (known) candidates.push(hostOf(known));

  const relay = process.env.EXPO_PUBLIC_GO2RTC_URL;
  if (relay) candidates.push(hostOf(relay));

  for (const host of candidates) {
    // A known host is worth a little more patience than one of 253 guesses.
    const info = await probe(host, 3000);
    if (info) return info;
  }

  if (!sweep) return null;

  const subnet = await localSubnet();
  if (!subnet) return null;

  let cursor = 0;
  let found: AgentInfo | null = null;

  const worker = async () => {
    while (cursor < subnet.hosts.length && !found) {
      const host = subnet.hosts[cursor];
      cursor += 1;
      const info = await probe(host);
      if (info) found = info;
    }
  };

  await Promise.all(Array.from({ length: SWEEP_CONCURRENCY }, worker));
  return found;
}
