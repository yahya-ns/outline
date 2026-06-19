import type { Context, Next } from "koa";
import Logger from "@server/logging/Logger";
import type { AppState } from "@server/types";

export const CURRENT_API_VERSION = 3;
export const SUPPORTED_API_VERSIONS = [3, 4] as const;

/**
 * Parse the `x-api-version` request header into an integer version number.
 *
 * Accepts the following formats: `"3"`, `"4"`, `"v3"`, `"v4"`, `"V3"`.
 * Surrounding whitespace is trimmed. Returns `null` for missing, malformed,
 * or non-positive values — callers should treat `null` as "no usable version
 * provided" and fall back to {@link CURRENT_API_VERSION} without marking the
 * request as deprecated.
 *
 * @param header The raw header value (string, array of strings, or undefined).
 * @returns The parsed positive integer, or `null` if the header is absent or malformed.
 */
function parseApiVersion(header: string | string[] | undefined): number | null {
  if (!header) {
    return null;
  }
  const raw = (Array.isArray(header) ? header[0] : header).trim();
  const match = /^v?(\d+)$/i.exec(raw);
  if (!match) {
    return null;
  }
  const n = parseInt(match[1], 10);
  if (n < 1) {
    return null;
  }
  return n;
}

/**
 * Middleware that negotiates the API version for every request based on the
 * `x-api-version` header. Populates `ctx.state.apiVersion` (the negotiated
 * integer, always one of the supported versions) and `ctx.state.deprecatedVersion`
 * (true when the header was a recognisable but unsupported version). When the
 * client has requested an unsupported version, a `Deprecation: true` response
 * header is added and a warning is logged. Missing or malformed headers fall
 * back to {@link CURRENT_API_VERSION} silently — they are not treated as
 * deprecation signals, per RFC 8594.
 *
 * @returns The middleware function.
 */
export function apiVersion() {
  return async function apiVersionMiddleware(
    ctx: Context<AppState>,
    next: Next
  ): Promise<void> {
    const parsed = parseApiVersion(ctx.request.headers["x-api-version"]);
    const isSupported =
      parsed !== null &&
      (SUPPORTED_API_VERSIONS as readonly number[]).includes(parsed);
    const version = isSupported ? parsed : CURRENT_API_VERSION;

    ctx.state.apiVersion = version;
    ctx.state.deprecatedVersion = isSupported === false && parsed !== null;

    if (ctx.state.deprecatedVersion) {
      ctx.set("Deprecation", "true");
      Logger.warn(`Client sent deprecated x-api-version: ${parsed}`);
    }

    await next();
  };
}
