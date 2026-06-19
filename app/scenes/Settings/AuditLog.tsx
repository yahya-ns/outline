import type { ColumnSort } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { HistoryIcon } from "outline-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "sonner";
import type Event from "~/models/Event";
import { Avatar, AvatarSize } from "~/components/Avatar";
import Button from "~/components/Button";
import { HEADER_HEIGHT } from "~/components/Header";
import Heading from "~/components/Heading";
import Input from "~/components/Input";
import Scene from "~/components/Scene";
import { SortableTable } from "~/components/SortableTable";
import { type Column as TableColumn } from "~/components/Table";
import Text from "~/components/Text";
import Time from "~/components/Time";
import { useTableRequest } from "~/hooks/useTableRequest";
import useQuery from "~/hooks/useQuery";
import useStores from "~/hooks/useStores";
import { HStack } from "~/components/primitives/HStack";
import { FILTER_HEIGHT, StickyFilters } from "./components/StickyFilters";

const ROW_HEIGHT = 45;
const STICKY_OFFSET = HEADER_HEIGHT + FILTER_HEIGHT;
const DEBOUNCE_MS = 250;

function AuditLog() {
  const { events } = useStores();
  const { t } = useTranslation();
  const params = useQuery();
  const history = useHistory();
  const location = useLocation();

  const [actorIdInput, setActorIdInput] = useState(params.get("actorId") || "");
  const [nameInput, setNameInput] = useState(params.get("name") || "");
  const [documentIdInput, setDocumentIdInput] = useState(
    params.get("documentId") || ""
  );

  const updateParam = useCallback(
    (name: string, value: string) => {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      history.replace({
        pathname: location.pathname,
        search: params.toString(),
      });
    },
    [params, history, location.pathname]
  );

  useEffect(() => {
    const timeout = setTimeout(
      () => updateParam("actorId", actorIdInput),
      DEBOUNCE_MS
    );
    return () => clearTimeout(timeout);
  }, [actorIdInput, updateParam]);

  useEffect(() => {
    const timeout = setTimeout(() => updateParam("name", nameInput), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [nameInput, updateParam]);

  useEffect(() => {
    const timeout = setTimeout(
      () => updateParam("documentId", documentIdInput),
      DEBOUNCE_MS
    );
    return () => clearTimeout(timeout);
  }, [documentIdInput, updateParam]);

  const reqParams = useMemo(
    () => ({
      actorId: params.get("actorId") || undefined,
      name: params.get("name") || undefined,
      documentId: params.get("documentId") || undefined,
      collectionId: params.get("collectionId") || undefined,
      sort: params.get("sort") || "createdAt",
      direction: (params.get("direction") || "DESC").toUpperCase() as
        | "ASC"
        | "DESC",
    }),
    [params]
  );

  const sort: ColumnSort = useMemo(
    () => ({
      id: reqParams.sort,
      desc: reqParams.direction === "DESC",
    }),
    [reqParams.sort, reqParams.direction]
  );

  const { data, error, loading, next } = useTableRequest({
    data: events.orderedData,
    sort,
    reqFn: events.fetchAuditLog,
    reqParams,
  });

  useEffect(() => {
    if (error) {
      toast.error(t("Could not load audit log"));
    }
  }, [t, error]);

  const handleClearFilters = useCallback(() => {
    setActorIdInput("");
    setNameInput("");
    setDocumentIdInput("");
    params.delete("actorId");
    params.delete("name");
    params.delete("documentId");
    history.replace({
      pathname: location.pathname,
      search: params.toString(),
    });
  }, [params, history, location.pathname]);

  // oxlint-disable no-explicit-any -- Event generic must be `any` because the store holds events for all model types
  const columns = useMemo<TableColumn<Event<any>>[]>(
    () => [
      {
        type: "data",
        id: "createdAt",
        header: t("Timestamp"),
        accessor: (event) => event.createdAt,
        component: (event) => (
          <Time dateTime={event.createdAt} addSuffix shorten />
        ),
        width: "1.5fr",
      },
      {
        type: "data",
        id: "actor",
        header: t("Actor"),
        accessor: (event) => event.actor?.name ?? event.actorId ?? "",
        component: (event) =>
          event.actor ? (
            <HStack>
              <Avatar model={event.actor} size={AvatarSize.Small} />
              <Text selectable>{event.actor.name}</Text>
            </HStack>
          ) : (
            <Text type="tertiary">{event.actorId || t("System")}</Text>
          ),
        width: "2fr",
      },
      {
        type: "data",
        id: "name",
        header: t("Action"),
        accessor: (event) => event.name,
        component: (event) => <Text selectable>{event.name}</Text>,
        width: "2fr",
      },
      {
        type: "data",
        id: "target",
        header: t("Target"),
        accessor: (event) =>
          event.document?.title ??
          event.collection?.name ??
          event.documentId ??
          event.collectionId ??
          "",
        component: (event) => {
          if (event.document?.title) {
            return <Text>{event.document.title}</Text>;
          }
          if (event.collection?.name) {
            return <Text>{event.collection.name}</Text>;
          }
          if (event.documentId) {
            return (
              <Text type="tertiary" ellipsis>
                {event.documentId}
              </Text>
            );
          }
          if (event.collectionId) {
            return (
              <Text type="tertiary" ellipsis>
                {event.collectionId}
              </Text>
            );
          }
          return <Text type="tertiary">-</Text>;
        },
        width: "2.5fr",
      },
      {
        type: "data",
        id: "changes",
        header: t("Changes"),
        sortable: false,
        accessor: (event) =>
          event.changes ? Object.keys(event.changes.attributes ?? {}).length : 0,
        component: (event) => {
          if (!event.changes) {
            return <Text type="tertiary">-</Text>;
          }
          const count = Object.keys(event.changes.attributes ?? {}).length;
          return (
            <Text type="tertiary">
              {t("{{ count }} modified", { count })}
            </Text>
          );
        },
        width: "1fr",
      },
    ],
    [t]
  );

  return (
    <Scene title={t("Audit Log")} icon={<HistoryIcon />} wide>
      <Heading>{t("Audit Log")}</Heading>
      <Text as="p" type="secondary">
        {t(
          "A complete record of significant actions performed in this workspace, including who performed them and when."
        )}
      </Text>
      <StickyFilters>
        <Input
          label={t("Filter by actor ID")}
          labelHidden
          value={actorIdInput}
          placeholder={`${t("Filter by actor ID")}…`}
          onChange={(event) => setActorIdInput(event.target.value)}
        />
        <Input
          label={t("Filter by action")}
          labelHidden
          value={nameInput}
          placeholder={`${t("Filter by action")}…`}
          onChange={(event) => setNameInput(event.target.value)}
        />
        <Input
          label={t("Filter by document ID")}
          labelHidden
          value={documentIdInput}
          placeholder={`${t("Filter by document ID")}…`}
          onChange={(event) => setDocumentIdInput(event.target.value)}
        />
        <Button onClick={handleClearFilters} neutral>
          {t("Clear")}
        </Button>
      </StickyFilters>
      <SortableTable
        data={data ?? []}
        columns={columns}
        sort={sort}
        loading={loading}
        page={{
          hasNext: !!next,
          fetchNext: next,
        }}
        rowHeight={ROW_HEIGHT}
        stickyOffset={STICKY_OFFSET}
      />
    </Scene>
  );
}

export default observer(AuditLog);
