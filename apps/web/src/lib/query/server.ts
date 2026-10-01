import "server-only";
import { cache } from "react";
import { makeQueryClient } from "./client";

/**
 * One QueryClient per server request (React `cache`), so a layout and its page share
 * prefetched data while users never share a cache.
 */
export const getQueryClient = cache(makeQueryClient);
