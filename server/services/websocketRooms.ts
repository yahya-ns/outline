/**
 * Per-document WebSocket rooms for the realtime service.
 *
 * @status scaffold - not production ready, see `.slim/deepwork/outline-improvements.md` Phase 3 #13.
 *
 * Adds a `document-${id}` room on top of the existing `team-${id}`,
 * `user-${id}`, `collection-${id}` and `group-${id}` rooms joined by
 * `server/services/websockets.ts`. Goal: presence and live-event broadcasts
 * for a single document only go to clients currently viewing that document,
 * not every team member connected to the realtime service.
 *
 * Planned surface:
 *
 * - `documentRoom(documentId)` — canonical room name.
 * - `joinDocumentRoom(socket, documentId)` — join on document open.
 * - `leaveDocumentRoom(socket, documentId)` — leave on document close / disconnect.
 * - `broadcastToDocument(io, documentId, event, payload)` — emit to a single room.
 *
 * Currently `server/queues/processors/WebsocketsProcessor.ts` calls
 * `socketio.to(channels).emit(...)` with channels derived from
 * `getDocumentEventChannels`, which includes the entire team (or collection)
 * for any document event — every team member receives every event regardless
 * of which document they are actually viewing. The follow-up updates the
 * processor so events carrying a `documentId` also include the new room.
 *
 * @remarks SCAFFOLD: replace the throw bodies with the real implementation.
 * See `.slim/deepwork/outline-improvements.md` Phase 3 #13.
 */

/**
 * Build the canonical room name for a single document.
 *
 * @param documentId the document id.
 * @returns the room name in the form `document-${documentId}`.
 * @throws Error always — SCAFFOLD: not implemented.
 *
 * @remarks SCAFFOLD: real impl returns `document-${documentId}`.
 */
export function documentRoom(_documentId: string): string {
  // SCAFFOLD: real impl returns `document-${_documentId}`.
  throw new Error("Not implemented: documentRoom");
}

/**
 * Join the per-document room for a connected socket.
 *
 * Intended to be called from the websocket service when the client signals it
 * is opening a document, or from the realtime message handler in the web
 * client when navigating into a document.
 *
 * @param socket the connected socket (`Socket` from `socket.io`).
 * @param documentId the document id being opened.
 * @throws Error always — SCAFFOLD: not implemented.
 *
 * @remarks SCAFFOLD: real impl casts the `unknown` placeholder to a socket
 * and calls `socket.join(documentRoom(documentId))` after a `can(user,
 * "read", document)` authorization check.
 */
export function joinDocumentRoom(_socket: unknown, _documentId: string): void {
  // SCAFFOLD: real impl calls socket.join(documentRoom(documentId)).
  throw new Error("Not implemented: joinDocumentRoom");
}

/**
 * Leave the per-document room for a connected socket.
 *
 * Intended to be called from the websocket service on `disconnect`, or from
 * the client when navigating away from a document.
 *
 * @param socket the connected socket (`Socket` from `socket.io`).
 * @param documentId the document id being closed.
 * @throws Error always — SCAFFOLD: not implemented.
 *
 * @remarks SCAFFOLD: real impl calls `socket.leave(documentRoom(documentId))`.
 */
export function leaveDocumentRoom(_socket: unknown, _documentId: string): void {
  // SCAFFOLD: real impl calls socket.leave(documentRoom(documentId)).
  throw new Error("Not implemented: leaveDocumentRoom");
}

/**
 * Broadcast an event to every socket currently in the room for a single
 * document. Intended to be called from `WebsocketsProcessor` for events that
 * carry a `documentId` and should only reach clients viewing that document.
 *
 * @param io the socket.io server instance (`Server` from `socket.io`).
 * @param documentId the document id whose room should receive the event.
 * @param event the event name to emit.
 * @param payload the payload to send to subscribers.
 * @returns a promise that resolves when the broadcast has been dispatched.
 * @throws Error always — SCAFFOLD: not implemented.
 *
 * @remarks SCAFFOLD: real impl does
 * `io.to(documentRoom(documentId)).emit(event, payload)`. Processors should
 * include the document room in their channel set in addition to the existing
 * team / collection / user / group channels so clients not currently viewing
 * the document still receive authoritative state updates.
 */
export async function broadcastToDocument(
  _io: unknown,
  _documentId: string,
  _event: string,
  _payload: unknown,
): Promise<void> {
  // SCAFFOLD: real impl does io.to(documentRoom(documentId)).emit(event, payload).
  throw new Error("Not implemented: broadcastToDocument");
}