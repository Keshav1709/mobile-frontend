import { concatBytes, sha1, toBase64, utf8Bytes } from './sha1';

/** ONVIF SOAP over plain HTTP. No native modules: `fetch` is enough. */

export type Credentials = { username: string; password: string };

const ENVELOPE_NS = [
  'xmlns:s="http://www.w3.org/2003/05/soap-envelope"',
  'xmlns:tds="http://www.onvif.org/ver10/device/wsdl"',
  'xmlns:trt="http://www.onvif.org/ver10/media/wsdl"',
  'xmlns:tt="http://www.onvif.org/ver10/schema"',
].join(' ');

/**
 * WS-Security UsernameToken with a password digest:
 * Base64(SHA1(nonce + created + password)).
 */
function securityHeader({ username, password }: Credentials): string {
  const nonce = new Uint8Array(16);
  for (let i = 0; i < nonce.length; i += 1) nonce[i] = Math.floor(Math.random() * 256);
  const created = new Date().toISOString();
  const digest = sha1(concatBytes(nonce, utf8Bytes(created), utf8Bytes(password)));

  return (
    '<s:Header><Security s:mustUnderstand="1" ' +
    'xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    `<UsernameToken><Username>${escapeXml(username)}</Username>` +
    '<Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' +
    `${toBase64(digest)}</Password>` +
    '<Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' +
    `${toBase64(nonce)}</Nonce>` +
    `<Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>` +
    '</UsernameToken></Security></s:Header>'
  );
}

function envelope(body: string, credentials?: Credentials): string {
  const header = credentials ? securityHeader(credentials) : '';
  return `<?xml version="1.0" encoding="UTF-8"?><s:Envelope ${ENVELOPE_NS}>${header}<s:Body>${body}</s:Body></s:Envelope>`;
}

export type OnvifErrorCode =
  | 'UNREACHABLE'
  | 'UNAUTHORIZED'
  | 'FAULT'
  | 'NOT_ONVIF'
  | 'NO_PROFILES'
  | 'NO_STREAM_URI';

export class OnvifError extends Error {
  constructor(readonly code: OnvifErrorCode) {
    super(code);
  }
}

/** POSTs one SOAP body and returns the raw XML response. */
export async function soapCall(
  serviceUrl: string,
  body: string,
  credentials: Credentials | undefined,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(serviceUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      body: envelope(body, credentials),
    });
  } catch {
    throw new OnvifError('UNREACHABLE');
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (response.status === 401) throw new OnvifError('UNAUTHORIZED');
  if (!text.includes('Envelope')) throw new OnvifError('NOT_ONVIF');
  if (text.includes('Fault')) {
    const unauthorized = /NotAuthorized|auth|Sender not/i.test(text);
    throw new OnvifError(unauthorized ? 'UNAUTHORIZED' : 'FAULT');
  }
  return text;
}

/** Reads the first occurrence of an element, ignoring namespace prefix. */
export function readTag(xml: string, name: string): string | null {
  const match = xml.match(
    new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${name}>`),
  );
  return match ? match[1].trim() : null;
}

/**
 * Every occurrence of an element, with its opening-tag attributes kept.
 * ONVIF puts profile tokens in attributes, so inner content alone is not enough.
 */
export function readElements(xml: string, name: string): { attrs: string; inner: string }[] {
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${name}\\b([^>]*)>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${name}>`,
    'g',
  );
  return [...xml.matchAll(pattern)].map((match) => ({ attrs: match[1], inner: match[2] }));
}

export function attributeOf(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
