/**
 * Per-document WebSocket rooms.
 *
 * Goal: when a user is viewing a single document, presence and live-event
 * broadcasts for that document only reach clients currently viewing it, not
 * every team member.
 *
 * Today the WebsocketsProcessor broadcasts document events to `team-${id}` for
 * every connected team member, regardless of which doc they're viewing. This
 * module adds the per-doc room; the processor calls `broadcastToDocument` for
 * events that carry a `documentId` (with the team broadcast kept as a fallback
 * for clients that haven't joined the per-doc room yet).
 *
 * Usage:
 *   joinDocumentRoom(socket, documentId)  // when a client opens a doc
 *   leaveDocumentRoom(socket, documentId) // when a client closes a doc
 *   broadcastToDocument(io, documentId, event, payload)
 */
import type { Server, Socket } from "socket.io";

/**
 * Canonical room name for a document.
 */
export function documentRoom(documentId: string): string {
  return `document-${documentId}`;
}

/**
 * Add a socket to the per-document room. Idempotent.
 */
export function joinDocumentRoom(socket: Socket, documentId: string): void {
  socket.join(documentRoom(documentId));
}

/**
 * Remove a socket from the per-document room. Idempotent.
 */
export function leaveDocumentRoom(socket: Socket, documentId: string): void {
  socket.leave(documentRoom(documentId));
}

/**
 * Broadcast an event payload to a single document's room.
 */
export async function broadcastToDocument(
  io: Server,
  documentId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  io.to(documentRoom(documentId)).emit(event, payload);
}
