import { Op } from "sequelize";
import Logger from "@server/logging/Logger";
import { Share } from "@server/models";
import { TaskPriority } from "./base/BaseTask";
import type { Props } from "./base/CronTask";
import { CronTask, TaskInterval } from "./base/CronTask";

/**
 * A task that auto-revokes shares whose `expiresAt` is in the past.
 *
 * For every share where `expiresAt < NOW` and `revokedAt IS NULL`, the
 * task sets `revokedAt = NOW`. `revokedById` is left `null` so the share
 * is treated as system-revoked (there is no human actor). The task is
 * idempotent: rows already revoked are skipped, and re-running the same
 * invocation is a no-op.
 *
 * The query is wrapped in a try/catch so that, during a rolling deploy
 * where the new code runs against an old schema (or vice versa), a
 * missing `expiresAt` column does not throw. In that case the task logs
 * a warning and exits cleanly so the worker can keep ticking.
 */
export default class CleanupExpiredSharesTask extends CronTask {
  public async perform({ limit }: Props) {
    let totalRevoked = 0;
    try {
      const [affectedCount] = await Share.update(
        {
          revokedAt: new Date(),
        },
        {
          where: {
            expiresAt: {
              [Op.lt]: new Date(),
            },
            revokedAt: {
              [Op.is]: null,
            },
          },
          limit,
          fields: ["revokedAt"],
        }
      );
      totalRevoked = affectedCount;
    } catch (err) {
      if (
        err instanceof Error &&
        (/column .* does not exist/i.test(err.message) ||
          err.name === "SequelizeUnknownColumnError")
      ) {
        Logger.warn(
          "CleanupExpiredSharesTask: shares.expiresAt column is missing, skipping"
        );
        return;
      }
      throw err;
    }

    if (totalRevoked > 0) {
      Logger.info("task", `Auto-revoked expired shares`, {
        totalRevoked,
      });
    }
  }

  public get cron() {
    return {
      interval: TaskInterval.Day,
    };
  }

  public get options() {
    return {
      attempts: 1,
      priority: TaskPriority.Background,
    };
  }
}
