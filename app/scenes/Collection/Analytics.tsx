/**
 * @status scaffold - not production ready, see `.slim/deepwork/outline-improvements.md` Phase 3 #12.
 *
 * Planned UI surface:
 * - Header: collection name + date-range selector (last 7d / 30d / 90d)
 * - Top row (3 stat cards): total views, unique viewers, edits in range
 * - Middle row: per-document table sortable by views/reads/edits with sparklines
 * - Bottom row: weekly rollup chart (uses `RollupWeeklyDocumentInsightsTask` output)
 *
 * Data source: existing `DocumentInsight` model. The store and API surface for the analytics queries
 * do not exist yet; this scaffold assumes they will be added as part of a follow-up.
 *
 * @remarks SCAFFOLD: replace the throw bodies with real implementation. See `.slim/deepwork/outline-improvements.md` Phase 3 #12.
 */
import * as React from "react";
import { observer } from "mobx-react";
import useStores from "~/hooks/useStores";

export interface AnalyticsProps {
  collectionId: string;
}

/**
 * Per-collection document analytics view.
 *
 * @param props.collectionId The id of the collection whose analytics are rendered.
 * @remarks SCAFFOLD: real implementation will (1) read the date range from URL params or local
 * state, (2) fetch `DocumentInsight` rows for the collection + range via a new `analytics.list`
 * RPC + matching `AnalyticsStore`, (3) render the stat cards + sortable per-document table +
 * weekly rollup chart. The throw body must be removed before this scene is wired into
 * `CollectionScene`'s tab navigation.
 */
export const Analytics: React.FC<AnalyticsProps> = observer(
  ({ collectionId: _collectionId }) => {
    // SCAFFOLD: real implementation will:
    // 1. Read the date range from URL params or local state
    // 2. Fetch DocumentInsight rows for the collection + range
    // 3. Render the stat cards + table + chart
    //
    // `useStores` is referenced here so the import stays meaningful for the planned real
    // implementation; the throw below prevents the hook from being observed at runtime.
    void useStores;
    throw new Error("Not implemented: Analytics component");
  }
);

export default Analytics;
