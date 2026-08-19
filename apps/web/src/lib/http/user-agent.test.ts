import { describe, expect, it } from 'vitest';
import { detectBrowser, detectDeviceType } from './user-agent';

describe('detectDeviceType', () => {
  it('detects mobile', () => {
    expect(detectDeviceType('Mozilla/5.0 (iPhone; Mobile)')).toBe('mobile');
  });

  it('detects tablet', () => {
    expect(detectDeviceType('Mozilla/5.0 (iPad; Tablet)')).toBe('tablet');
  });

  it('defaults to desktop', () => {
    expect(detectDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });
});

describe('detectBrowser', () => {
  it('detects Chrome (not Edge, which also contains "Chrome" in its UA)', () => {
    expect(detectBrowser('Mozilla/5.0 Chrome/120.0 Safari/537.36')).toBe('Chrome');
  });

  it('detects Edge even though its UA string also contains "Chrome"', () => {
    expect(detectBrowser('Mozilla/5.0 Chrome/120.0 Safari/537.36 Edge/120.0')).toBe('Edge');
  });

  it('detects Firefox', () => {
    expect(detectBrowser('Mozilla/5.0 Firefox/121.0')).toBe('Firefox');
  });

  it('detects Safari (not Chrome, which also contains "Safari" in its UA)', () => {
    expect(detectBrowser('Mozilla/5.0 Version/17.0 Safari/605.1.15')).toBe('Safari');
  });

  it('falls back to Unknown for an unrecognized user agent', () => {
    expect(detectBrowser('SomeBot/1.0')).toBe('Unknown');
  });
});
