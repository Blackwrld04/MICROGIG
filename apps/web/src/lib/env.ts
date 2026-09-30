/**
 * Typed access to environment variables. All values come from the root .env locally
 * (see /.env.example) or from the hosting dashboard in production.
 */

/** Safe for the browser (NEXT_PUBLIC_*). */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS !== "false",
};

/** Server-only: base URL of the backend (apps/api). Empty in demo mode. */
export function apiBaseUrl(): string {
  return (process.env.API_URL ?? "").replace(/\/+$/, "");
}
