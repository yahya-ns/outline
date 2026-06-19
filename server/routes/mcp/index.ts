import Koa from "koa";
import bodyParser from "koa-body";
import Router from "koa-router";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { RateLimiterRes } from "rate-limiter-flexible";
import { toError } from "@shared/utils/error";
import { TeamPreference } from "@shared/types";
import env from "@server/env";
import { NotFoundError } from "@server/errors";
import Logger from "@server/logging/Logger";
import auth from "@server/middlewares/authentication";
import requestTracer from "@server/middlewares/requestTracer";
import { UserFlag } from "@server/models/User";
import { AuthenticationType } from "@server/types";
import { getMcpRateLimiter } from "@server/utils/RateLimiter";
import { attachmentTools } from "@server/tools/attachments";
import { collectionTools } from "@server/tools/collections";
import { commentTools } from "@server/tools/comments";
import { documentTools } from "@server/tools/documents";
import { fetchTool } from "@server/tools/fetch";
import { templateTools } from "@server/tools/templates";
import { userTools } from "@server/tools/users";
import { version } from "../../../package.json";

const app = new Koa();
const router = new Router();

const defaultInstructions = `Document markdown content must not begin with a top-level heading (H1) — the title is stored as a separate field, so set it via the title parameter and start the content with body text or a lower-level heading instead.

Document and collection markdown support @mentions using the syntax: @[Display Name](mention://user/userId). For example: @[John Doe](mention://user/c9a1b2e3-...). Use the "list_users" tool to find user IDs.

Read images and attachments with the "fetch" tool by setting resource to "attachment" and passing either the attachment ID or an /api/attachments.redirect?id=... URL; the tool will return a signed URL for download.

When asked to create a document that follows a template, use the "list_templates" tool to find a matching template; each result already includes the template body as markdown. To use it unchanged, pass its ID as templateId to "create_document" and the new document is pre-filled from it. To adapt it first, modify the returned body and pass the result as the text parameter to "create_document". Either way no separate fetch is needed.`;

/**
 * Creates a fresh MCP server instance with tools filtered by the OAuth
 * scopes granted to the current token.
 *
 * @param scopes - the OAuth scopes granted to the access token.
 * @param guidance - optional workspace guidance to append to default instructions.
 * @returns a configured McpServer ready to be connected to a transport.
 */
function createMcpServer(scopes: string[], guidance?: string): McpServer {
  const instructions = guidance
    ? `${defaultInstructions}\n\n${guidance}`
    : defaultInstructions;

  const server = new McpServer(
    {
      name: "outline",
      version,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions,
    }
  );

  attachmentTools(server, scopes);
  collectionTools(server, scopes);
  commentTools(server, scopes);
  documentTools(server, scopes);
  fetchTool(server, scopes);
  templateTools(server, scopes);
  userTools(server, scopes);

  return server;
}

router.post(
  "/",
  auth({
    type: [
      AuthenticationType.MCP,
      AuthenticationType.OAUTH,
      AuthenticationType.API,
    ],
  }),
  async (ctx) => {
    const { user, token, scope } = ctx.state.auth;

    if (!user.team.getPreference(TeamPreference.MCP)) {
      throw NotFoundError();
    }

    // Consume from the per-team MCP rate limiter directly. The team's
    // preference (TeamPreference.McpRateLimitMultiplier) is preferred; the
    // operator-tunable env default (env.MCP_RATE_LIMIT_DEFAULT) is the
    // fallback for teams without a custom override. The global default
    // rate limiter is configured to skip /mcp/ so this consume is the
    // only place that counts against the team's MCP budget.
    const mcpRateLimitMultiplier =
      user.team.getPreference(TeamPreference.McpRateLimitMultiplier) ??
      env.MCP_RATE_LIMIT_DEFAULT;

    try {
      await getMcpRateLimiter(mcpRateLimitMultiplier).consume(
        `mcp:${user.teamId}`
      );
    } catch (rateLimiterRes) {
      if (rateLimiterRes instanceof RateLimiterRes) {
        ctx.res.setHeader(
          "Retry-After",
          `${Math.ceil(rateLimiterRes.msBeforeNext / 1000)}`
        );
        ctx.res.writeHead(429, { "Content-Type": "application/json" });
        ctx.res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: ErrorCode.InternalError,
              message: "Rate limit exceeded",
            },
            id: null,
          })
        );
        return;
      }

      Logger.error("MCP rate limiter error", toError(rateLimiterRes));
    }

    user.setFlag(UserFlag.MCP);
    await user.save({ hooks: false });

    const server = createMcpServer(
      scope ?? [],
      user.team.guidanceMCP ?? undefined
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // onerror fires for client-side 4xx conditions (bad Accept header, etc)
    // which the transport already answers with an HTTP error — warn keeps
    // visibility without reporting client mistakes to Sentry.
    transport.onerror = (error) => {
      Logger.warn("MCP transport error", error);
    };

    await server.connect(transport);

    // Attach auth info to the raw request so the MCP transport
    // passes it through as `extra.authInfo` to tool handlers.
    (ctx.req as typeof ctx.req & { auth: AuthInfo }).auth = {
      token,
      clientId: "",
      scopes: scope ?? [],
      extra: { user, scope: scope ?? [], ip: ctx.request.ip },
    };

    ctx.respond = false;

    // The SDK's handleRequest answers known protocol failures itself (4xx with a
    // JSON-RPC body) via the transport. Anything that escapes here is unexpected.
    try {
      await transport.handleRequest(ctx.req, ctx.res, ctx.request.body);
    } catch (error) {
      Logger.error(
        "MCP request handling failed",
        toError(error),
        undefined,
        ctx.req
      );

      if (!ctx.res.headersSent) {
        ctx.res.writeHead(500, { "Content-Type": "application/json" });
        ctx.res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: ErrorCode.InternalError,
              message: "Internal server error",
            },
            id: null,
          })
        );
      } else {
        ctx.res.end();
      }
    }
  }
);

router.get("/", async (ctx) => {
  ctx.status = 405;
  ctx.set("Allow", "POST");
  ctx.body = { error: "Method not allowed. Use POST for MCP requests." };
});

router.delete("/", async (ctx) => {
  ctx.status = 405;
  ctx.set("Allow", "POST");
  ctx.body = { error: "Method not allowed. Use POST for MCP requests." };
});

app.use(requestTracer());
app.use(bodyParser());
app.use(router.routes());

export default app;
