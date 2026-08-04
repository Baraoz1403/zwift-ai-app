/**
 * Internal helpers shared between client.ts and callback screens.
 * Kept separate to avoid circular imports.
 */

export function apiBase(): string {
  if (typeof window !== 'undefined') return '';          // web: relative
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8082';
}
