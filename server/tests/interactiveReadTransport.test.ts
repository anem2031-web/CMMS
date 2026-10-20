import { describe, expect, it } from "vitest";
import { createTRPCUntypedClient } from "@trpc/client";
import superjson from "superjson";
import { createReadTransport } from "../../client/src/lib/read-transport";

describe("interactive read transport with a disposable HTTP fixture", () => {
  it("delivers an opted-in read while an unrelated read remains blocked", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const calls: { url: string; credentials: unknown }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input)); calls.push({ url: String(input), credentials: init?.credentials });
      if (url.pathname.includes("slow")) await gate;
      const payload = { result: { data: superjson.serialize({ ready: true }) } };
      return new Response(JSON.stringify(url.searchParams.has("batch") ? [payload] : payload), { headers: { "content-type": "application/json" } });
    };
    const client = createTRPCUntypedClient({ links: [createReadTransport("https://fixture.test/trpc", fetcher)] });
    let slowCompleted = false;
    const slow = client.query("slow").then(() => { slowCompleted = true; });
    try {
      expect(await client.query("catalog.items.list", undefined, { context: { independentRead: true } })).toEqual({ ready: true });
      expect(slowCompleted).toBe(false);
    } finally { release(); await slow; }
    expect(calls).toHaveLength(2);
    expect(calls.every(call => call.credentials === "include")).toBe(true);
    expect(calls.find(call => call.url.includes("catalog"))?.url).not.toContain("batch=1");
    expect(calls.find(call => call.url.includes("slow"))?.url).toContain("batch=1");
  });

  it("leaves ordinary reads batched and never opts mutations into the read link", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async input => {
      const url = new URL(String(input)); calls.push(String(input));
      const paths = url.pathname.split("/").pop()!.split(",");
      return new Response(JSON.stringify(paths.map(() => ({ result: { data: superjson.serialize("ok") } }))), { headers: { "content-type": "application/json" } });
    };
    const client = createTRPCUntypedClient({ links: [createReadTransport("https://fixture.test/trpc", fetcher)] });
    expect(await Promise.all([client.query("one"), client.query("two")])).toEqual(["ok", "ok"]);
    expect(calls).toHaveLength(1);
    await client.mutation("save", {}, { context: { independentRead: true } });
    expect(calls).toHaveLength(2);
    expect(calls.every(url => url.includes("batch=1"))).toBe(true);
  });

  it("propagates unauthorized reads rather than returning usable data", async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ error: superjson.serialize({ message: "No session", code: -32001, data: { code: "UNAUTHORIZED", httpStatus: 401 } }) }), { status: 401, headers: { "content-type": "application/json" } });
    const client = createTRPCUntypedClient({ links: [createReadTransport("https://fixture.test/trpc", fetcher)] });
    await expect(client.query("catalog.items.list", undefined, { context: { independentRead: true } })).rejects.toThrow("No session");
  });
});
