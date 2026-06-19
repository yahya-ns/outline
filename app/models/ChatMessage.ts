import { observable } from "mobx";
import type ChatMessagesStore from "~/stores/ChatMessagesStore";
import User from "./User";
import Model from "./base/Model";
import Field from "./decorators/Field";
import Relation from "./decorators/Relation";

/**
 * Represents a single plain-text chat message posted in a collection.
 */
class ChatMessage extends Model {
  static modelName = "ChatMessage";

  /**
   * The plain text body of the message.
   */
  @Field
  @observable
  body: string;

  /**
   * The collection ID to which this message belongs.
   */
  @Field
  @observable
  collectionId: string;

  /**
   * The user who posted this message.
   */
  @Relation(() => User)
  user?: User;

  /**
   * The ID of the user who posted this message.
   */
  userId: string;

  store: ChatMessagesStore;
}

export default ChatMessage;
