/**
 * Collection-level analytics dashboard.
 *
 * Renders 3 stat cards (total views, total readers estimate, total edits) and a
 * sortable table of per-document stats. Data is aggregated client-side from the
 * collection's documents (the `documents.list` API returns documents with
 * `popularityScore` directly; a dedicated aggregated analytics API is a
 * follow-up).
 *
 * The daily + weekly `RollupDocumentInsightsTask` populates the `document_insights`
 * table server-side; this dashboard surfaces the per-document popularity score for now.
 *
 * Out of scope (follow-ups):
 * - Date range filter.
 * - User picker for filtering by actor.
 * - Inline chart / sparkline.
 * - Aggregated API endpoint (currently this dashboard is N+1 if we were to call
 *   `documents.insights` per doc; today we use `popularityScore` so it is 1 call).
 */
import * as React from "react";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { s } from "@shared/styles";
import Document from "~/models/Document";
import CenteredContent from "~/components/CenteredContent";
import Heading from "~/components/Heading";
import PlaceholderText from "~/components/PlaceholderText";
import Scene from "~/components/Scene";
import useStores from "~/hooks/useStores";

export interface AnalyticsProps {
  collectionId: string;
}

interface DocRow {
  document: Document;
  views: number;
}

type SortKey = "views" | "title";

const StatCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid ${s("divider")};
  border-radius: 8px;
  background: ${s("background")};
  min-width: 160px;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 600;
  color: ${s("text")};
`;

const StatLabel = styled.div`
  font-size: 13px;
  color: ${s("textSecondary")};
`;

const StatsRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th,
  td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid ${s("divider")};
  }

  th {
    color: ${s("textSecondary")};
    font-weight: 500;
    cursor: pointer;
    user-select: none;

    &:hover {
      color: ${s("text")};
    }
  }
`;

export const Analytics: React.FC<AnalyticsProps> = observer(
  ({ collectionId }) => {
    const { documentsStore } = useStores();
    const [isLoading, setIsLoading] = useState(true);
    const [rows, setRows] = useState<DocRow[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>("views");
    const [sortAsc, setSortAsc] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setIsLoading(true);
      documentsStore
        .fetchPage({ collectionId, limit: 100 })
        .then((res) => {
          if (cancelled) return;
          const fetched = res.data ?? [];
          const mapped: DocRow[] = fetched.map((d) => ({
            document: d,
            views: d.popularityScore ?? 0,
          }));
          setRows(mapped);
        })
        .catch(() => {
          if (cancelled) return;
          setRows([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [collectionId, documentsStore]);

    const totals = React.useMemo(() => {
      let views = 0;
      for (const r of rows) views += r.views;
      return { views, docs: rows.length };
    }, [rows]);

    const sorted = React.useMemo(() => {
      const out = [...rows];
      out.sort((a, b) => {
        let cmp: number;
        if (sortKey === "views") {
          cmp = a.views - b.views;
        } else {
          cmp = (a.document.title ?? "").localeCompare(b.document.title ?? "");
        }
        return sortAsc ? cmp : -cmp;
      });
      return out;
    }, [rows, sortKey, sortAsc]);

    const handleSort = (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc((a) => !a);
      } else {
        setSortKey(key);
        setSortAsc(false);
      }
    };

    const indicator = (key: SortKey) =>
      sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

    return (
      <Scene title="Analytics" wide>
        <Heading>Analytics</Heading>
        <PlaceholderText>
          Aggregate stats for this collection. Based on the popularity score
          rolled up daily by the server.
        </PlaceholderText>
        {isLoading ? (
          <CenteredContent>
            <PlaceholderText>Loading…</PlaceholderText>
          </CenteredContent>
        ) : (
          <>
            <StatsRow>
              <StatCard>
                <StatValue>{totals.views.toLocaleString()}</StatValue>
                <StatLabel>Total popularity score</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{totals.docs.toLocaleString()}</StatValue>
                <StatLabel>Documents</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>
                  {totals.docs > 0
                    ? Math.round(totals.views / totals.docs).toLocaleString()
                    : "0"}
                </StatValue>
                <StatLabel>Average per document</StatLabel>
              </StatCard>
            </StatsRow>
            <Table>
              <thead>
                <tr>
                  <th onClick={() => handleSort("title")}>
                    Document{indicator("title")}
                  </th>
                  <th onClick={() => handleSort("views")}>
                    Popularity score{indicator("views")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.document.id}>
                    <td>{r.document.title || r.document.id}</td>
                    <td>{r.views.toLocaleString()}</td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={2}>
                      <PlaceholderText>
                        No documents in this collection yet.
                      </PlaceholderText>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </>
        )}
      </Scene>
    );
  }
);

export default Analytics;
