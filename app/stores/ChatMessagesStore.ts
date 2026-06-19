import { computed } from "mobx";
import { orderBy } from "es-toolkit/compat";
import ChatMessage from "~/models/ChatMessage";
import type RootStore from "./RootStore";
import Store, { RPCAction } from "./base/Store";

/**
 * Store for collection chat messages.
 *
 * Messages are created via the `chat.create` API, listed via `chat.list`, and
 * deleted via `chat.delete`. Live updates are received through the websocket
 * provider as `chat.create` and `chat.delete` events.
 */
export default class ChatMessagesStore extends Store<ChatMessage> {
  actions = [RPCAction.List, RPCAction.Create, RPCAction.Delete];

  constructor(rootStore: RootStore) {
    super(rootStore, ChatMessage);
    this.apiEndpoint = "chat";
  }

  /**
   * Chat messages are shown oldest-first in the panel, override the default
   * descending order provided by the base store.
   */
  @computed
  get orderedData(): ChatMessage[] {
    return orderBy(Array.from(this.data.values()), "createdAt", "asc");
  }

  /**
   * Returns chat messages belonging to the given collection, ordered oldest
   * first.
   *
   * @param collectionId ID of the collection to get messages for
   * @returns Array of chat messages
   */
  inCollection(collectionId: string): ChatMessage[] {
    return this.orderedData.filter(
      (message) => message.collectionId === collectionId
    );
  }
}
