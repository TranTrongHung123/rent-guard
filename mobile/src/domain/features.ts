// Expo replaces these exact static references at bundle time.
export const REQUIRE_HTTPS = process.env.EXPO_PUBLIC_REQUIRE_HTTPS === 'true';
export const SAMPLE_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO !== 'false';
