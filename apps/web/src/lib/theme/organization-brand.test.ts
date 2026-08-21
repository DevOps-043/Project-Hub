import { describe, expect, it } from 'vitest';
import { chooseReadableTextColor, relativeLuminance, resolveOrganizationTheme } from './organization-brand';

describe('organization brand tokens', () => {
  it('selects readable foregrounds for light and dark brand colors', () => {
    expect(chooseReadableTextColor('#F7E27C')).toBe('#071512');
    expect(chooseReadableTextColor('#0A2540')).toBe('#F8FAFC');
  });

  it('only exposes organization colors when branding is explicitly enabled', () => {
    expect(resolveOrganizationTheme('#ffcc00', {})).toEqual({});
    expect(resolveOrganizationTheme('not-a-color', { brandingEnabled: true })).toEqual({});
    expect(resolveOrganizationTheme('#0A2540', { brandingEnabled: true })).toMatchObject({
      '--org-primary-color': '#0A2540',
      '--org-on-primary-color': '#F8FAFC',
    });
  });

  it('computes ordered relative luminance', () => {
    expect(relativeLuminance('#FFFFFF')).toBeGreaterThan(relativeLuminance('#000000'));
  });
});
