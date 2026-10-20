import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import superjson from "superjson";

/** Keep interactive reads from waiting for unrelated work in an HTTP batch.
 * This only changes transport. Every operation still passes the server guards.
 * No permission/result cache is introduced, and mutations retain their transport.
 */
export const independentReadOptions = { trpc: { context: { independentRead: true } } } as const;

export function createReadTransport(url = "/api/trpc", fetcher: typeof fetch = globalThis.fetch) {
  const options = { url, transformer: superjson, fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetcher(input, { ...init, credentials: "include" }) };
  return splitLink({
    condition: operation => operation.type === "query" && operation.context.independentRead === true,
    true: httpLink(options),
    false: httpBatchLink(options),
  });
}
