/**
 * SHA-1 over raw bytes, for the ONVIF WS-Security password digest.
 *
 * Written out rather than pulled from a crypto library because the digest is
 * taken over a byte concatenation (nonce + created + password), and the Expo
 * crypto module only digests strings.
 */
export function sha1(bytes: Uint8Array): Uint8Array {
  const length = bytes.length;
  const withPadding = new Uint8Array((((length + 8) >> 6) + 1) << 6);
  withPadding.set(bytes);
  withPadding[length] = 0x80;

  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 4, length << 3, false);
  view.setUint32(withPadding.length - 8, Math.floor((length * 8) / 0x100000000), false);

  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const words = new Int32Array(80);

  for (let block = 0; block < withPadding.length; block += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getInt32(block + i * 4, false);
    for (let i = 16; i < 80; i += 1) {
      words[i] = rotate(words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16], 1);
    }

    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let i = 0; i < 80; i += 1) {
      const [f, k] =
        i < 20
          ? [(b & c) | (~b & d), 0x5a827999]
          : i < 40
            ? [b ^ c ^ d, 0x6ed9eba1]
            : i < 60
              ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
              : [b ^ c ^ d, 0xca62c1d6];
      const next = (rotate(a, 5) + f + e + k + words[i]) | 0;
      [e, d, c, b, a] = [d, c, rotate(b, 30), a, next];
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const digest = new Uint8Array(20);
  new DataView(digest.buffer).setInt32(0, h0, false);
  new DataView(digest.buffer).setInt32(4, h1, false);
  new DataView(digest.buffer).setInt32(8, h2, false);
  new DataView(digest.buffer).setInt32(12, h3, false);
  new DataView(digest.buffer).setInt32(16, h4, false);
  return digest;
}

function rotate(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const remaining = bytes.length - i;
    out += BASE64[(chunk >> 18) & 63] + BASE64[(chunk >> 12) & 63];
    out += remaining > 1 ? BASE64[(chunk >> 6) & 63] : '=';
    out += remaining > 2 ? BASE64[chunk & 63] : '=';
  }
  return out;
}

export function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
