import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Op } from "sequelize";
import type { WhereOptions } from "sequelize";
import { Collection, Template } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { authorize } from "@server/policies";
import { parser } from "@server/editor";
import AuthenticationHelper from "@shared/helpers/AuthenticationHelper";
import { ValidationError } from "@server/errors";
import {
  error,
  success,
  buildAPIContext,
  getActorFromContext,
  optionalString,
  pathToUrl,
  withTracing,
} from "./util";

/**
 * Presents a template's metadata and rendered markdown body for a tool
 * response. Including the body lets a caller list templates and create a
 * document from one — verbatim or adapted — without a separate fetch call.
 *
 * @param template - the template to present.
 * @returns the presented template with its body as markdown.
 */
export async function presentTemplate(template: Template) {
  return {
    id: template.id,
    url: template.path,
    title: template.title,
    collectionId: template.collectionId ?? null,
    updatedAt: template.updatedAt,
    text: template.content
      ? await DocumentHelper.toMarkdown(template.content, {
          includeTitle: false,
        })
      : "",
  };
}

/**
 * Registers template-related MCP tools on the given server, filtered by the
 * OAuth scopes granted to the current token.
 *
 * @param server - the MCP server instance to register on.
 * @param scopes - the OAuth scopes granted to the access token.
 */
export function templateTools(server: McpServer, scopes: string[]) {
  if (AuthenticationHelper.canAccess("templates.list", scopes)) {
    server.registerTool(
      "list_templates",
      {
        title: "List templates",
        description:
          "Lists document templates the user has access to, including workspace-wide templates and templates within accessible collections. Each result includes the template body as markdown. To create a document from a template unchanged, pass its ID as templateId to create_document. To adapt it first, modify the returned text and pass it as the text parameter to create_document — no separate fetch is needed.",
        annotations: {
          idempotentHint: true,
          readOnlyHint: true,
        },
        inputSchema: {
          collectionId: optionalString().describe(
            "A collection ID to filter templates by. Omit to include workspace-wide templates and templates from all accessible collections."
          ),
          offset: z.coerce
            .number()
            .int()
            .min(0)
            .optional()
            .describe("The pagination offset. Defaults to 0."),
          limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe(
              "The maximum number of results to return. Defaults to 25, max 100."
            ),
        },
      },
      withTracing(
        "list_templates",
        async ({ collectionId, offset, limit }, extra) => {
          try {
            const user = getActorFromContext(extra);
            const effectiveOffset = offset ?? 0;
            const effectiveLimit = limit ?? 25;

            const where: WhereOptions<Template> & {
              [Op.and]: WhereOptions<Template>[];
            } = {
              teamId: user.teamId,
              [Op.and]: [{ deletedAt: { [Op.eq]: null } }],
            };

            if (collectionId) {
              const collection = await Collection.findByPk(collectionId, {
                userId: user.id,
              });
              authorize(user, "read", collection);
              where[Op.and].push({ collectionId });
            } else {
              where[Op.and].push({
                [Op.or]: [
                  { collectionId: { [Op.eq]: null } },
                  { collectionId: await user.collectionIds() },
                ],
              });
            }

            const templates = await Template.scope([
              "defaultScope",
              { method: ["withMembership", user.id] },
            ]).findAll({
              where,
              order: [["updatedAt", "DESC"]],
              offset: effectiveOffset,
              limit: effectiveLimit,
            });

            const presented = await Promise.all(
              templates.map(async (template) =>
                pathToUrl(user.team, await presentTemplate(template))
              )
            );
            return success(presented);
          } catch (message) {
            return error(message);
          }
        }
      )
    );
  }

  if (AuthenticationHelper.canAccess("templates.info", scopes)) {
    server.registerTool(
      "get_template",
      {
        title: "Get template",
        description:
          "Returns a single template by its ID, including the template body as markdown. Use this to fetch the full contents of a template discovered via list_templates when you need it without re-listing.",
        annotations: {
          idempotentHint: true,
          readOnlyHint: true,
        },
        inputSchema: {
          id: z
            .string()
            .describe(
              "The unique identifier (UUID or urlId slug) of the template to fetch."
            ),
        },
      },
      withTracing("get_template", async ({ id }, extra) => {
        try {
          const user = getActorFromContext(extra);

          const template = await Template.findByPk(id, {
            userId: user.id,
            rejectOnEmpty: true,
          });
          authorize(user, "read", template);

          const presented = pathToUrl(
            user.team,
            await presentTemplate(template)
          );
          return success(presented);
        } catch (err) {
          return error(err);
        }
      })
    );
  }

  if (AuthenticationHelper.canAccess("templates.create", scopes)) {
    server.registerTool(
      "create_template",
      {
        title: "Create template",
        description:
          "Creates a new document template. Admin-only. Provide a name and the template content as markdown. Pass collectionId to scope the template to a specific collection; omit to create a workspace-wide template.",
        annotations: {
          idempotentHint: false,
          readOnlyHint: false,
        },
        inputSchema: {
          name: z.string().describe("The name (title) of the template."),
          content: z
            .string()
            .describe(
              "The markdown body of the template. Stored as document content."
            ),
          collectionId: optionalString().describe(
            "The collection to scope this template to. Omit for a workspace-wide template."
          ),
        },
      },
      withTracing(
        "create_template",
        async ({ name, content, collectionId }, context) => {
          try {
            const ctx = buildAPIContext(context);
            const { user } = ctx.state.auth;

            if (collectionId) {
              const collection = await Collection.findByPk(collectionId, {
                userId: user.id,
              });
              if (!collection) {
                throw ValidationError("Collection does not exist");
              }
              authorize(user, "createTemplate", collection);
            } else {
              authorize(user, "createTemplate", user.team);
            }

            let template = await Template.createWithCtx(ctx, {
              title: name,
              content: parser.parse(content).toJSON(),
              collectionId: collectionId ?? null,
              publishedAt: new Date(),
              createdById: user.id,
              lastModifiedById: user.id,
              teamId: user.teamId,
            });

            template = await Template.findByPk(template.id, {
              userId: user.id,
              rejectOnEmpty: true,
            });

            const presented = pathToUrl(
              user.team,
              await presentTemplate(template!)
            );
            return {
              content: [
                { type: "text" as const, text: JSON.stringify(presented) },
              ],
            } satisfies CallToolResult;
          } catch (err) {
            return error(err);
          }
        }
      )
    );
  }

  if (AuthenticationHelper.canAccess("templates.update", scopes)) {
    server.registerTool(
      "update_template",
      {
        title: "Update template",
        description:
          "Updates an existing template by its ID. Only the fields provided will be updated. To change the markdown body, pass content; the existing body is replaced in full.",
        annotations: {
          idempotentHint: true,
          readOnlyHint: false,
        },
        inputSchema: {
          id: z
            .string()
            .describe("The unique identifier of the template to update."),
          name: z
            .string()
            .optional()
            .describe("The new name (title) of the template."),
          content: z
            .string()
            .optional()
            .describe(
              "The new markdown body of the template. Replaces the existing body in full."
            ),
          collectionId: optionalString().describe(
            "Move the template to a different collection. Pass an empty string or omit to leave unchanged; pass a collection ID to move into that collection, or pass null explicitly to convert to a workspace-wide template."
          ),
        },
      },
      withTracing(
        "update_template",
        async ({ id, name, content, collectionId }, context) => {
          try {
            const ctx = buildAPIContext(context);
            const { user } = ctx.state.auth;

            const template = await Template.findByPk(id, {
              userId: user.id,
              rejectOnEmpty: true,
            });
            authorize(user, "update", template);

            if (collectionId !== undefined && collectionId !== null) {
              const collection = await Collection.findByPk(collectionId, {
                userId: user.id,
              });
              if (!collection) {
                throw ValidationError("Collection does not exist");
              }
              authorize(user, "createTemplate", collection);
              template.collectionId = collectionId;
            }

            if (name !== undefined) {
              template.title = name;
            }
            if (content !== undefined) {
              template.content = parser.parse(content).toJSON();
            }

            await template.saveWithCtx(ctx);

            const presented = pathToUrl(
              user.team,
              await presentTemplate(template)
            );
            return {
              content: [
                { type: "text" as const, text: JSON.stringify(presented) },
              ],
            } satisfies CallToolResult;
          } catch (err) {
            return error(err);
          }
        }
      )
    );
  }

  if (AuthenticationHelper.canAccess("templates.delete", scopes)) {
    server.registerTool(
      "delete_template",
      {
        title: "Delete template",
        description:
          "Deletes a template by its ID. The template is moved to the trash and can be restored later. Admin-only.",
        annotations: {
          idempotentHint: false,
          readOnlyHint: false,
        },
        inputSchema: {
          id: z
            .string()
            .describe("The unique identifier of the template to delete."),
        },
      },
      withTracing("delete_template", async ({ id }, context) => {
        try {
          const ctx = buildAPIContext(context);
          const { user } = ctx.state.auth;

          const template = await Template.findByPk(id, {
            userId: user.id,
            rejectOnEmpty: true,
          });
          authorize(user, "delete", template);

          await template.destroyWithCtx(ctx);

          return success({ success: true });
        } catch (err) {
          return error(err);
        }
      })
    );
  }
}
