import { describe, expect, it } from 'vitest';
import { matchesDeclaredImageType } from './route';

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

describe('matchesDeclaredImageType', () => {
  it('accepts a real JPEG buffer declared as image/jpeg', () => {
    expect(matchesDeclaredImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0), 'image/jpeg')).toBe(true);
  });

  it('accepts a real PNG buffer declared as image/png', () => {
    expect(
      matchesDeclaredImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/png')
    ).toBe(true);
  });

  it('accepts a real GIF87a/GIF89a buffer declared as image/gif', () => {
    const gif89a = new TextEncoder().encode('GIF89a').buffer;
    expect(matchesDeclaredImageType(gif89a, 'image/gif')).toBe(true);
  });

  it('accepts a real WEBP buffer declared as image/webp', () => {
    const riffWebp = new Uint8Array([
      ...new TextEncoder().encode('RIFF'),
      0, 0, 0, 0,
      ...new TextEncoder().encode('WEBP'),
    ]).buffer;
    expect(matchesDeclaredImageType(riffWebp, 'image/webp')).toBe(true);
  });

  // Security regression: a file whose bytes are actually HTML/SVG (e.g. with
  // an embedded <script>) but whose Content-Type the client set to
  // 'image/png' must be rejected — the declared MIME type alone must never
  // be trusted for a file that gets served back from public storage.
  it('rejects a non-image payload spoofed as image/png', () => {
    const fakeHtml = new TextEncoder().encode('<html><script>alert(1)</script></html>').buffer;
    expect(matchesDeclaredImageType(fakeHtml, 'image/png')).toBe(false);
  });

  it('rejects a JPEG payload spoofed as a different declared type', () => {
    const jpegBytes = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0);
    expect(matchesDeclaredImageType(jpegBytes, 'image/png')).toBe(false);
  });

  it('rejects an unsupported or empty declared type', () => {
    expect(matchesDeclaredImageType(bytes(0xff, 0xd8, 0xff), 'image/svg+xml')).toBe(false);
    expect(matchesDeclaredImageType(new ArrayBuffer(0), 'image/png')).toBe(false);
  });
});
