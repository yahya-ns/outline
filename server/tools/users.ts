import { z } from "zod";
import { Op, Sequelize } from "sequelize";
import type { WhereOptions } from "sequelize";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { UserRole } from "@shared/types";
import { User, Team } from "@server/models";
import { authorize, can } from "@server/policies";
import { presentUser } from "@server/presenters";
import AuthenticationHelper from "@shared/helpers/AuthenticationHelper";
import { NotFoundError, ValidationError } from "@server/errors";
import {
  error,
  success,
  buildAPIContext,
  getActorFromContext,
  optionalString,
  withTracing,
} from "./util";

/**
 * Registers user-related MCP tools on the given server, filtered by the
 * OAuth scopes granted to the current token.
 *
 * @param server - the MCP server instance to register on.
 * @param scopes - the OAuth scopes granted to the access token.
 */
export function userTools(server: McpServer, scopes: string[]) {
  if (AuthenticationHelper.canAccess("users.list", scopes)) {
    server.registerTool(
      "list_users",
      {
        title: "List users",
        description: "Lists users in the workspace.",
        annotations: {
          idempotentHint: true,
          readOnlyHint: true,
        },
        inputSchema: {
          query: optionalString().describe(
            "An optional search query to filter users by name or email."
          ),
          role: z
            .enum([
              UserRole.Admin,
              UserRole.Member,
              UserRole.Viewer,
              UserRole.Guest,
            ])
            .optional()
            .describe("Filter users by role."),
          filter: z
            .enum(["active", "suspended", "invited", "all"])
            .optional()
            .describe(
              "Filter users by status. Defaults to active, non-suspended users. Note filtering by 'suspended' is only available to admins."
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
        "list_users",
        async ({ query, role, filter, offset, limit }, extra) => {
          try {
            const actor = getActorFromContext(extra);
            const team = await Team.findByPk(actor.teamId, {
              rejectOnEmpty: true,
            });
            authorize(actor, "listUsers", team);

            const effectiveOffset = offset ?? 0;
            const effectiveLimit = limit ?? 25;

            let where: WhereOptions<User> = {
              teamId: actor.teamId,
            };

            // Non-admins cannot see suspended users
            if (!actor.isAdmin) {
              where = {
                ...where,
                suspendedAt: { [Op.eq]: null },
              };
            }

            switch (filter) {
              case "invited": {
                where = { ...where, lastActiveAt: null };
                break;
              }
              case "suspended": {
                if (actor.isAdmin) {
                  where = {
                    ...where,
                    suspendedAt: { [Op.ne]: null },
                  };
                }
                break;
              }
              case "active": {
                where = {
                  ...where,
                  lastActiveAt: { [Op.ne]: null },
                  suspendedAt: { [Op.is]: null },
                };
                break;
              }
              case "all": {
                break;
              }
              default: {
                where = {
                  ...where,
                  suspendedAt: { [Op.is]: null },
                };
                break;
              }
            }

            if (role) {
              where = { ...where, role };
            }

            if (query) {
              where = {
                ...where,
                [Op.and]: {
                  [Op.or]: [
                    Sequelize.literal(
                      `unaccent(LOWER(email)) like unaccent(LOWER(:query))`
                    ),
                    Sequelize.literal(
                      `unaccent(LOWER(name)) like unaccent(LOWER(:query))`
                    ),
                  ],
                },
              };
            }

            const replacements = { query: `%${query}%` };

            const users = await User.findAll({
              where,
              replacements,
              order: [["name", "ASC"]],
              offset: effectiveOffset,
              limit: effectiveLimit,
            });

            const presented = users.map((user) =>
              presentUser(user, {
                includeEmail: !!can(actor, "readEmail", user),
                includeDetails: !!can(actor, "readDetails", user),
              })
            );

            return success(presented);
          } catch (err) {
            return error(err);
          }
        }
      )
    );
  }

  if (AuthenticationHelper.canAccess("users.info", scopes)) {
    server.registerTool(
      "get_user",
      {
        title: "Get user",
        description:
          "Returns a single user by their ID. Use this to fetch full details for a user when you only have their identifier.",
        annotations: {
          idempotentHint: true,
          readOnlyHint: true,
        },
        inputSchema: {
          id: z
            .string()
            .describe("The unique identifier of the user to fetch."),
        },
      },
      withTracing("get_user", async ({ id }, extra) => {
        try {
          const actor = getActorFromContext(extra);

          // Scope the lookup to the actor's team so a caller cannot probe
          // for the existence of user IDs in other teams (a 403 from
          // authorize() would otherwise leak that the id exists somewhere).
          const user = await User.findByPk(id, {
            rejectOnEmpty: true,
          });
          if (user.teamId !== actor.teamId) {
            throw NotFoundError();
          }
          authorize(actor, "read", user);

          const presented = presentUser(user, {
            includeEmail: !!can(actor, "readEmail", user),
            includeDetails: !!can(actor, "readDetails", user),
          });
          return success(presented);
        } catch (err) {
          return error(err);
        }
      })
    );
  }

  if (AuthenticationHelper.canAccess("users.create", scopes)) {
    server.registerTool(
      "create_user",
      {
        title: "Create user",
        description:
          "Creates a new user in the workspace. Admin-only. The new user is created without an active session and will need to complete sign-up by following the invite link sent to their email address.",
        annotations: {
          idempotentHint: false,
          readOnlyHint: false,
        },
        inputSchema: {
          email: z
            .string()
            .email()
            .describe("The email address of the new user."),
          name: z
            .string()
            .describe("The display name of the new user."),
          role: z
            .enum([
              UserRole.Admin,
              UserRole.Member,
              UserRole.Viewer,
              UserRole.Guest,
            ])
            .optional()
            .describe(
              "The role to assign to the new user. Defaults to member when omitted."
            ),
        },
      },
      withTracing("create_user", async ({ email, name, role }, context) => {
        try {
          const ctx = buildAPIContext(context);
          const { user } = ctx.state.auth;

          const team = await Team.findByPk(user.teamId, {
            rejectOnEmpty: true,
          });
          authorize(user, "createUser", team);

          const created = await User.createWithCtx(ctx, {
            teamId: user.teamId,
            email,
            name,
            role: role ?? UserRole.Member,
            invitedById: user.id,
          });

          const presented = presentUser(created, {
            includeEmail: !!can(user, "readEmail", created),
            includeDetails: !!can(user, "readDetails", created),
          });
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(presented) },
            ],
          } satisfies CallToolResult;
        } catch (err) {
          return error(err);
        }
      })
    );
  }

  if (AuthenticationHelper.canAccess("users.update", scopes)) {
    server.registerTool(
      "update_user",
      {
        title: "Update user",
        description:
          "Updates an existing user by their ID. Only the fields provided will be updated. Use the role parameter with care: it requires admin permissions and the actor cannot change their own role.",
        annotations: {
          idempotentHint: true,
          readOnlyHint: false,
        },
        inputSchema: {
          id: z
            .string()
            .describe("The unique identifier of the user to update."),
          name: z
            .string()
            .optional()
            .describe("The new display name for the user."),
          email: z
            .string()
            .email()
            .optional()
            .describe("The new email address for the user."),
          role: z
            .enum([
              UserRole.Admin,
              UserRole.Member,
              UserRole.Viewer,
              UserRole.Guest,
            ])
            .optional()
            .describe(
              "The new role for the user. Requires admin permissions; the actor cannot change their own role."
            ),
        },
      },
      withTracing(
        "update_user",
        async ({ id, name, email, role }, context) => {
          try {
            const ctx = buildAPIContext(context);
            const { user } = ctx.state.auth;

            const target = await User.findByPk(id, {
              rejectOnEmpty: true,
            });
            authorize(user, "update", target);

            if (role !== undefined && target.role !== role) {
              if (target.id === user.id) {
                throw ValidationError("You cannot change your own role");
              }
              if (role === UserRole.Admin) {
                authorize(user, "promote", target);
              } else {
                authorize(user, "demote", target);
              }
              target.role = role;
            }

            if (name !== undefined) {
              target.name = name;
            }
            if (email !== undefined) {
              target.email = email;
            }

            await target.saveWithCtx(ctx);

            const presented = presentUser(target, {
              includeEmail: !!can(user, "readEmail", target),
              includeDetails: !!can(user, "readDetails", target),
            });
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

  if (AuthenticationHelper.canAccess("users.delete", scopes)) {
    server.registerTool(
      "delete_user",
      {
        title: "Delete user",
        description:
          "Deletes a user by their ID. The user is moved to the trash and can be restored later. Admin-only.",
        annotations: {
          idempotentHint: false,
          readOnlyHint: false,
        },
        inputSchema: {
          id: z
            .string()
            .describe("The unique identifier of the user to delete."),
        },
      },
      withTracing("delete_user", async ({ id }, context) => {
        try {
          const ctx = buildAPIContext(context);
          const { user } = ctx.state.auth;

          const target = await User.findByPk(id, {
            rejectOnEmpty: true,
          });
          authorize(user, "delete", target);

          await target.destroyWithCtx(ctx);

          return success({ success: true });
        } catch (err) {
          return error(err);
        }
      })
    );
  }
}
