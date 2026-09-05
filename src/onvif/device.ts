import { attributeOf, Credentials, OnvifError, readElements, readTag, soapCall } from './soap';

/** Ports ONVIF devices commonly serve their device service on. */
export const ONVIF_PORTS = [80, 8000, 8080, 8899, 2020] as const;

/**
 * Subset used for the subnet sweep. Every extra port multiplies the number of
 * in-flight requests across 254 hosts, and iOS caps concurrent connections:
 * past that cap probes queue and time out, missing cameras that are present.
 */
export const SCAN_PORTS = [80, 8000, 8080] as const;

export type OnvifDevice = {
  id: string;
  ip: string;
  port: number;
  serviceUrl: string;
  /** Where the media service actually lives, per GetCapabilities. */
  mediaUrl: string;
  manufacturer: string | null;
  model: string | null;
  firmware: string | null;
  serialNumber: string | null;
};

export type OnvifProfile = {
  token: string;
  name: string | null;
  resolution: string | null;
  encoding: string | null;
  fps: string | null;
  pixels: number;
};

export const serviceUrl = (ip: string, port: number) =>
  `http://${ip}${port === 80 ? '' : `:${port}`}/onvif/device_service`;

/**
 * ONVIF requires GetSystemDateAndTime to be answerable *without* credentials,
 * which makes it the reliable way to tell a camera from any other host.
 */
export async function isOnvifDevice(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  try {
    const xml = await soapCall(
      serviceUrl(ip, port),
      '<tds:GetSystemDateAndTime/>',
      undefined,
      timeoutMs,
    );
    return xml.includes('GetSystemDateAndTimeResponse') || xml.includes('SystemDateAndTime');
  } catch (error) {
    // An auth fault still proves something ONVIF is listening.
    return error instanceof OnvifError && error.code === 'UNAUTHORIZED';
  }
}

export async function getDeviceInformation(
  ip: string,
  port: number,
  credentials: Credentials,
  timeoutMs = 8000,
): Promise<OnvifDevice> {
  const url = serviceUrl(ip, port);
  const xml = await soapCall(url, '<tds:GetDeviceInformation/>', credentials, timeoutMs);
  return {
    id: `${ip}:${port}`,
    ip,
    port,
    serviceUrl: url,
    mediaUrl: await resolveMediaUrl(url, credentials, timeoutMs),
    manufacturer: readTag(xml, 'Manufacturer'),
    model: readTag(xml, 'Model'),
    firmware: readTag(xml, 'FirmwareVersion'),
    serialNumber: readTag(xml, 'SerialNumber'),
  };
}

/**
 * Asks the device where its media service is instead of guessing the path.
 * Most cameras use /onvif/media_service, but not all, and a wrong guess fails
 * every profile call with a 404.
 */
async function resolveMediaUrl(
  deviceUrl: string,
  credentials: Credentials,
  timeoutMs: number,
): Promise<string> {
  const fallback = deviceUrl.replace('/device_service', '/media_service');
  try {
    const xml = await soapCall(
      deviceUrl,
      '<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>',
      credentials,
      timeoutMs,
    );
    const media = readTag(xml, 'Media');
    return (media && readTag(media, 'XAddr')) || fallback;
  } catch {
    return fallback;
  }
}

export async function getProfiles(
  device: OnvifDevice,
  credentials: Credentials,
  timeoutMs = 8000,
): Promise<OnvifProfile[]> {
  const xml = await soapCall(device.mediaUrl, '<trt:GetProfiles/>', credentials, timeoutMs);

  const profiles = readElements(xml, 'Profiles').map(({ attrs, inner }) => {
    // Scope to the video encoder: a profile block holds several Resolution
    // elements, and the audio and analytics ones must not win.
    const encoder = readTag(inner, 'VideoEncoderConfiguration') ?? inner;
    const resolution = readTag(encoder, 'Resolution') ?? '';
    const width = Number(readTag(resolution, 'Width'));
    const height = Number(readTag(resolution, 'Height'));
    const sized = width > 0 && height > 0;

    return {
      // The token is an attribute on the opening tag, not inner content.
      token: attributeOf(attrs, 'token') ?? '',
      name: readTag(inner, 'Name'),
      resolution: sized ? `${width}x${height}` : null,
      encoding: readTag(encoder, 'Encoding'),
      fps: readTag(encoder, 'FrameRateLimit'),
      pixels: sized ? width * height : 0,
    };
  });

  const usable = profiles.filter((profile) => profile.token);
  if (!usable.length) throw new OnvifError('NO_PROFILES');

  // Highest resolution first: that is the main stream on every device we've seen.
  return usable.sort((a, b) => b.pixels - a.pixels);
}

export async function getStreamUri(
  device: OnvifDevice,
  profileToken: string,
  credentials: Credentials,
  timeoutMs = 8000,
): Promise<string> {
  const body =
    '<trt:GetStreamUri><trt:StreamSetup>' +
    '<tt:Stream>RTP-Unicast</tt:Stream>' +
    '<tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>' +
    `</trt:StreamSetup><trt:ProfileToken>${profileToken}</trt:ProfileToken></trt:GetStreamUri>`;
  const xml = await soapCall(device.mediaUrl, body, credentials, timeoutMs);
  const uri = readTag(xml, 'Uri');
  if (!uri) throw new OnvifError('NO_STREAM_URI');
  return uri;
}
