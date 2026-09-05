import { readTag, soapCall } from './soap';
import type { Credentials } from './soap';

/**
 * ONVIF PTZ. Movement is continuous: a press starts panning, the release stops
 * it, which is how a physical joystick behaves and what cameras expect.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Pan/tilt velocity per direction, in ONVIF's normalised -1..1 space. */
const VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const ptzUrl = (deviceUrl: string) => deviceUrl.replace('/device_service', '/ptz_service');

export async function isPtzSupported(
  deviceUrl: string,
  credentials: Credentials,
  timeoutMs = 6000,
): Promise<boolean> {
  try {
    const xml = await soapCall(
      deviceUrl,
      '<tds:GetCapabilities><tds:Category>PTZ</tds:Category></tds:GetCapabilities>',
      credentials,
      timeoutMs,
    );
    const ptz = readTag(xml, 'PTZ');
    return !!(ptz && readTag(ptz, 'XAddr'));
  } catch {
    return false;
  }
}

export async function move(
  deviceUrl: string,
  profileToken: string,
  direction: Direction,
  credentials: Credentials,
  speed = 0.6,
): Promise<void> {
  const { x, y } = VECTORS[direction];
  const body =
    '<tptz:ContinuousMove xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">' +
    `<tptz:ProfileToken>${profileToken}</tptz:ProfileToken>` +
    '<tptz:Velocity>' +
    `<tt:PanTilt x="${x * speed}" y="${y * speed}" ` +
    'xmlns:tt="http://www.onvif.org/ver10/schema"/>' +
    '</tptz:Velocity></tptz:ContinuousMove>';
  await soapCall(ptzUrl(deviceUrl), body, credentials, 6000);
}

export async function stop(
  deviceUrl: string,
  profileToken: string,
  credentials: Credentials,
): Promise<void> {
  const body =
    '<tptz:Stop xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">' +
    `<tptz:ProfileToken>${profileToken}</tptz:ProfileToken>` +
    '<tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom></tptz:Stop>';
  await soapCall(ptzUrl(deviceUrl), body, credentials, 6000);
}
