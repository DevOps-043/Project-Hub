import type { CSSProperties } from 'react';

type ThemeVariables = CSSProperties & Record<`--${string}`, string>;

const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

function expandHex(color: string): string {
  if (color.length !== 4) return color.toUpperCase();
  const [, red, green, blue] = color;
  return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase();
}

function toRgb(color: string) {
  const normalized = expandHex(color).slice(1);
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function linearize(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string) {
  const { red, green, blue } = toRgb(color);
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

export function chooseReadableTextColor(background: string) {
  const luminance = relativeLuminance(background);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? '#F8FAFC' : '#071512';
}

function isBrandingEnabled(settings: Record<string, unknown>) {
  return settings.brandingEnabled === true || settings.branding_enabled === true;
}

export function resolveOrganizationTheme(
  brandColor: string | null | undefined,
  settings: Record<string, unknown> = {},
): ThemeVariables {
  if (!brandColor || !HEX_COLOR.test(brandColor) || !isBrandingEnabled(settings)) return {};

  const primary = expandHex(brandColor);
  const onPrimary = chooseReadableTextColor(primary);

  return {
    '--org-primary-color': primary,
    '--org-action-color': primary,
    '--org-on-primary-color': onPrimary,
    '--org-on-action-color': onPrimary,
  };
}
