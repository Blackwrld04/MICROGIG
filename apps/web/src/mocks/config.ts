import { publicEnv } from "@/lib/env";

/**
 * Demo mode: serve fixture data and simulate mutations in the browser until the
 * backend APIs exist. Set NEXT_PUBLIC_USE_MOCKS=false (and API_URL) to use the real backend.
 */
export const USE_MOCKS = publicEnv.useMocks;
