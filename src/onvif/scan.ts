import * as Network from 'expo-network';

import { SCAN_PORTS, isOnvifDevice, serviceUrl } from './device';

export type FoundCamera = {
  id: string;
  ip: string;
  port: number;
  serviceUrl: string;
};

export type ScanProgress = {
  checked: number;
  total: number;
  found: FoundCamera[];
};

// 10 hosts x 3 ports = 30 requests in flight, which iOS handles without
// queueing. A slow camera answering in 2s still gets seen.
const CONCURRENCY = 10;
const PROBE_TIMEOUT_MS = 2500;

/** The phone's own /24. Cameras have to be on it for the app to reach them. */
export async function localSubnet(): Promise<{ ip: string; hosts: string[] } | null> {
  const ip = await Network.getIpAddressAsync();
  if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || ip.startsWith('127.')) return null;
  const prefix = ip.split('.').slice(0, 3).join('.');
  const hosts = Array.from({ length: 254 }, (_, index) => `${prefix}.${index + 1}`).filter(
    (host) => host !== ip,
  );
  return { ip, hosts };
}

/**
 * Sweeps the phone's subnet for ONVIF devices.
 *
 * Unicast rather than WS-Discovery multicast: multicast needs a native socket
 * module, while this is plain HTTP and runs anywhere `fetch` does. Results are
 * reported as they arrive so the list fills in while the scan continues.
 */
export async function scanForCameras(
  onProgress: (progress: ScanProgress) => void,
  signal?: { cancelled: boolean },
): Promise<FoundCamera[]> {
  const subnet = await localSubnet();
  if (!subnet) return [];

  const found: FoundCamera[] = [];
  let checked = 0;
  let cursor = 0;

  const report = () => onProgress({ checked, total: subnet.hosts.length, found: [...found] });

  const worker = async () => {
    while (cursor < subnet.hosts.length) {
      if (signal?.cancelled) return;
      const host = subnet.hosts[cursor];
      cursor += 1;

      // All ports at once: probing them in sequence makes every dead address
      // cost the timeout five times over, which is most of the subnet.
      const answered = await Promise.all(
        SCAN_PORTS.map(async (port): Promise<number | null> =>
          (await isOnvifDevice(host, port, PROBE_TIMEOUT_MS)) ? port : null,
        ),
      );
      if (signal?.cancelled) return;

      const port = answered.find((value) => value !== null) ?? undefined;
      if (port !== undefined) {
        found.push({ id: `${host}:${port}`, ip: host, port, serviceUrl: serviceUrl(host, port) });
      }

      checked += 1;
      report();
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return found;
}
