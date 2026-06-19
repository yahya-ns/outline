import type { Context, Next } from "koa";
import { describe, expect, it, vi } from "vitest";
import type { AppState } from "@server/types";
import { apiVersion } from "./apiVersion";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

describe("apiVersion middleware", () => {
  function makeCtx(headers: Record<string, string> = {}) {
    const setCalls: Record<string, string> = {};
    return {
      request: { headers },
      state: {} as Mutable<AppState>,
      set: (name: string, value: string) => {
        setCalls[name] = value;
      },
      setCalls,
    };
  }

  async function run(headers: Record<string, string>) {
    const ctx = makeCtx(headers);
    const next = vi.fn();
    await apiVersion()(ctx as unknown as Context<AppState>, next as Next);
    return ctx;
  }

  it('parses "4" to 4', async () => {
    const ctx = await run({ "x-api-version": "4" });
    expect(ctx.state.apiVersion).toBe(4);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls).toEqual({});
  });

  it('parses "3" to 3', async () => {
    const ctx = await run({ "x-api-version": "3" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
  });

  it('parses "v3" to 3', async () => {
    const ctx = await run({ "x-api-version": "v3" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
  });

  it('parses "v4" to 4', async () => {
    const ctx = await run({ "x-api-version": "v4" });
    expect(ctx.state.apiVersion).toBe(4);
    expect(ctx.state.deprecatedVersion).toBe(false);
  });

  it('marks "2" as deprecated, defaults apiVersion to current, and sets Deprecation header', async () => {
    const ctx = await run({ "x-api-version": "2" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(true);
    expect(ctx.setCalls.Deprecation).toBe("true");
  });

  it("defaults to 3 when header is missing", async () => {
    const ctx = await run({});
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
  });

  it("defaults to 3 when header is malformed", async () => {
    const ctx = await run({ "x-api-version": "abc" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls).toEqual({});
  });

  it('parses uppercase "V3" to 3 (case-insensitive)', async () => {
    const ctx = await run({ "x-api-version": "V3" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls).toEqual({});
  });

  it('marks lowercase "v2" as deprecated, defaults to 3, and sets Deprecation header', async () => {
    const ctx = await run({ "x-api-version": "v2" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(true);
    expect(ctx.setCalls.Deprecation).toBe("true");
  });

  it("parses the first value of an array header to 4", async () => {
    const ctx = await run({ "x-api-version": ["4"] });
    expect(ctx.state.apiVersion).toBe(4);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls).toEqual({});
  });

  it('trims whitespace and parses " 4 " to 4', async () => {
    const ctx = await run({ "x-api-version": " 4 " });
    expect(ctx.state.apiVersion).toBe(4);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls).toEqual({});
  });

  it('treats decimal "3.5" as malformed and falls back silently', async () => {
    const ctx = await run({ "x-api-version": "3.5" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls).toEqual({});
  });

  it('treats negative "-1" as malformed and falls back silently', async () => {
    const ctx = await run({ "x-api-version": "-1" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls).toEqual({});
  });

  it('treats "abc" as malformed and falls back silently (no Deprecation header)', async () => {
    const ctx = await run({ "x-api-version": "abc" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(false);
    expect(ctx.setCalls.Deprecation).toBeUndefined();
  });

  it('marks large integer "9999" as deprecated (recognised but unsupported) and sets Deprecation header', async () => {
    const ctx = await run({ "x-api-version": "9999" });
    expect(ctx.state.apiVersion).toBe(3);
    expect(ctx.state.deprecatedVersion).toBe(true);
    expect(ctx.setCalls.Deprecation).toBe("true");
  });
});
