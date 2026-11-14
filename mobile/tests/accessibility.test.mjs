import assert from 'node:assert/strict';
import test from 'node:test';

import { colors } from '../src/ui/palette.ts';

// WCAG relative luminance for opaque sRGB text/surface colors. This checks the
// actual palette used by the app; native layout and screen-reader use still
// require device verification.
function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, 'Contrast pairs must use opaque sRGB colors');
  const channels = hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const normalTextPairs = [
  ['ink', 'background'],
  ['ink', 'surface'],
  ['muted', 'background'],
  ['muted', 'surfaceAlt'],
  ['primary', 'surface'],
  ['primary', 'primarySoft'],
  ['primaryDeep', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['onPrimaryMuted', 'primaryDeep'],
  ['accent', 'surface'],
];

for (const [foreground, background] of normalTextPairs) {
  test(`normal text palette ${foreground} on ${background} meets WCAG AA contrast`, () => {
    const ratio = contrast(colors[foreground], colors[background]);
    assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1, expected at least 4.5:1`);
  });
}

for (const [foreground, background] of [['high', 'highSoft'], ['medium', 'mediumSoft'], ['low', 'lowSoft']]) {
  test(`severity notice ${foreground} on ${background} meets WCAG AA text contrast`, () => {
    const ratio = contrast(colors[foreground], colors[background]);
    assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1, expected at least 4.5:1`);
  });
}
