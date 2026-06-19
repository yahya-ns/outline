import Router from "koa-router";
import {
  CURRENT_API_VERSION,
  SUPPORTED_API_VERSIONS,
} from "@server/middlewares/apiVersion";
import type { APIContext } from "@server/types";

const router = new Router();

/**
 * Unauthenticated endpoint that exposes the currently negotiated and
 * supported API versions. Used by clients to discover the API version
 * policy without sending a versioned request.
 */
router.get("version.info", async (ctx: APIContext) => {
  ctx.body = {
    current: CURRENT_API_VERSION,
    supported: [...SUPPORTED_API_VERSIONS],
  };
});

// Backwards-compatible alias at /api/version (cleaner URL).
// TODO: remove this when the version.info path is documented as the canonical URL.
router.get("version", async (ctx: APIContext) => {
  ctx.body = {
    current: CURRENT_API_VERSION,
    supported: [...SUPPORTED_API_VERSIONS],
  };
});

export default router;
