/**
 * @status scaffold - not production ready, see `.slim/deepwork/outline-improvements.md` Phase 3 #11.
 *
 * Planned UI surface:
 * - Page header: title + description
 * - Filter bar: actor (user picker), action namespace (documents/users/...), date range, "show system events" toggle
 * - Table: timestamp, actor, action, target, changes summary, link to detail
 * - Pagination: standard `<Pagination>` from app/components
 * - Detail drawer: full event payload (raw JSON) + actor + IP + auth type
 *
 * Data source: `events` table via the existing `Event` model + the existing `EventsStore`
 * (currently exposes `RPCAction.List`; the scaffold assumes the `Info` action for a single
 * event detail and the filter-by-actor/namespace/date-range query methods will be added
 * as part of the implementation).
 *
 * @remarks SCAFFOLD: replace the throw bodies with real implementation. See `.slim/deepwork/outline-improvements.md` Phase 3 #11.
 */
import * as React from "react";
import { observer } from "mobx-react";
import useStores from "~/hooks/useStores";

export interface AuditLogProps {
  // Empty for now; the route will be added in a follow-up.
}

/**
 * Audit log scene — paginated, filterable list of `Event` rows from the `events` table.
 *
 * Auditors want to see: who did what, when, with what payload diff.
 *
 * @remarks SCAFFOLD: real implementation will (1) read filters from URL params, (2) call a
 * paginated fetch on the `EventsStore`, (3) render the filter bar + table + pagination, and
 * (4) open a detail drawer on row click. The throw body must be removed before this scene is
 * wired into the settings route. See `.slim/deepwork/outline-improvements.md` Phase 3 #11.
 */
export const AuditLog: React.FC<AuditLogProps> = observer((_props) => {
  // SCAFFOLD: real implementation will:
  // 1. Read filters from URL params
  // 2. Call the existing `EventsStore.fetchPage({ actor, namespace, since, until, includeSystem })`
  //    (this method is not yet added to EventsStore — the follow-up adds the API verb + scope)
  // 3. Render the filter bar + table + pagination
  // 4. Open a detail drawer on row click, fetching the single event via `events.info`
  throw new Error("Not implemented: AuditLog component");
});

export default AuditLog;
