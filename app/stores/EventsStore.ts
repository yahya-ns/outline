import { isUUID } from "validator";
import { Pagination } from "@shared/constants";
import Event from "~/models/Event";
import type RootStore from "./RootStore";
import Store, { RPCAction, type FetchPageParams, type PaginatedResponse } from "./base/Store";

// oxlint-disable no-explicit-any -- Event generic must be `any` because the store holds events for all model types
export default class EventsStore extends Store<Event<any>> {
  actions = [RPCAction.List];

  constructor(rootStore: RootStore) {
    super(rootStore, Event);
  }

  /**
   * Retrieves all events for a given document ID
   *
   * @param documentId - The ID of the document to retrieve events for
   * @returns An array of events for the specified document ID
   */
  getByDocumentId = (documentId: string): Event<any>[] =>
    this.orderedData.filter((event) => event.documentId === documentId);

  /**
   * Fetches a paginated, filterable list of audit log events from the
   * `events.list` endpoint. The server-side query is restricted to events
   * belonging to the `EventHelper.AUDIT_EVENTS` namespace, which requires
   * the current user to hold the `audit` ability on the team (currently
   * granted only to team admins on cloud-hosted instances).
   *
   * Non-UUID values for `actorId`, `documentId`, and `collectionId` are
   * stripped before the request so that partially-typed input in the UI
   * does not trigger a 400 from the server-side Zod schema.
   *
   * @param opts - Filter, sort, and pagination options.
   * @returns A paginated response of `Event` rows with the pagination
   * metadata attached via `PAGINATION_SYMBOL`.
   */
  fetchAuditLog = async (
    opts: {
      actorId?: string;
      name?: string;
      documentId?: string;
      collectionId?: string;
      sort?: string;
      direction?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaginatedResponse<Event<any>>> => {
    const params: FetchPageParams = {
      auditLog: true,
      name: opts.name,
      events: opts.name ? [opts.name] : undefined,
      sort: opts.sort ?? "createdAt",
      direction: opts.direction ?? "DESC",
      limit: opts.limit ?? Pagination.defaultLimit,
      offset: opts.offset ?? 0,
    };

    if (opts.actorId && isUUID(opts.actorId)) {
      params.actorId = opts.actorId;
    }

    if (opts.documentId && isUUID(opts.documentId)) {
      params.documentId = opts.documentId;
    }

    if (opts.collectionId && isUUID(opts.collectionId)) {
      params.collectionId = opts.collectionId;
    }

    return this.fetchPage(params);
  };
}