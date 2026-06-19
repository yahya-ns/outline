import { observer } from "mobx-react";
import { TrashIcon } from "outline-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { ChatMessageValidation } from "@shared/validations";
import { s } from "@shared/styles";
import { toError } from "@shared/utils/error";
import type Collection from "~/models/Collection";
import type ChatMessage from "~/models/ChatMessage";
import { Avatar, AvatarSize } from "~/components/Avatar";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "~/components/primitives/Drawer";
import Scrollable from "~/components/Scrollable";
import Text from "~/components/Text";
import Time from "~/components/Time";
import useCurrentUser from "~/hooks/useCurrentUser";
import usePolicy from "~/hooks/usePolicy";
import useStores from "~/hooks/useStores";
import Logger from "~/utils/Logger";

type Props = {
  /** The collection whose chat to show */
  collection: Collection;
  /** Whether the panel is open */
  open: boolean;
  /** Called when the panel should be closed */
  onClose: () => void;
};

function ChatPanel({ collection, open, onClose }: Props) {
  const { chatMessages, policies } = useStores();
  const { t } = useTranslation();
  const user = useCurrentUser({ rejectOnEmpty: false });
  const can = usePolicy(collection);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canPost = !!can?.updateDocument && !!user;

  useEffect(() => {
    if (!open) {
      return;
    }
    void chatMessages
      .fetchPage({ collectionId: collection.id })
      .catch((err: unknown) => {
        toast.error(t("Could not load chat"));
        Logger.error("Failed to fetch chat messages", toError(err));
      });
  }, [open, collection.id, chatMessages, t]);

  const messages = chatMessages.inCollection(collection.id);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || !canPost || isSending) {
      return;
    }

    setIsSending(true);
    try {
      const message = await chatMessages.create({
        collectionId: collection.id,
        body,
      });
      setDraft("");
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
      policies.remove(message.id);
    } catch (err) {
      toast.error(t("Could not send message"));
      Logger.error("Failed to send chat message", toError(err));
    } finally {
      setIsSending(false);
    }
  }, [draft, canPost, isSending, chatMessages, collection.id, policies, t]);

  const handleDelete = useCallback(
    async (message: ChatMessage) => {
      try {
        await message.delete();
      } catch (err) {
        toast.error(t("Could not delete message"));
        Logger.error("Failed to delete chat message", toError(err));
      }
    },
    [t]
  );

  const handleKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  return (
    <Drawer
      open={open}
      onOpenChange={(next: boolean) => !next && onClose()}
      dismissible
    >
      <DrawerContent aria-label={t("Chat")} aria-describedby={undefined}>
        <DrawerTitle hidden>{t("Chat")}</DrawerTitle>
        <Container column>
          <Header>
            <Text size="medium" weight="bold">
              {t("Chat")}
            </Text>
          </Header>
          <Messages
            ref={listRef}
            $isEmpty={messages.length === 0}
            hiddenScrollbars
          >
            {messages.length === 0 ? (
              <EmptyState>
                {t("No messages yet. Start the conversation.")}
              </EmptyState>
            ) : (
              messages.map((message) => {
                const isOwn = !!user && message.userId === user.id;
                const canDelete = !!user && (user.isAdmin || isOwn);
                return (
                  <MessageRow key={message.id}>
                    <StyledAvatar
                      model={message.user}
                      size={AvatarSize.Small}
                      alt={message.user?.name}
                    />
                    <Body column>
                      <Meta>
                        <Author type="secondary" size="xsmall" weight="bold">
                          {message.user?.name ?? t("Unknown")}
                        </Author>
                        <Text type="tertiary" size="xsmall">
                          <Time
                            dateTime={message.createdAt}
                            addSuffix
                            shorten
                          />
                        </Text>
                      </Meta>
                      <BodyText size="small">{message.body}</BodyText>
                    </Body>
                    {canDelete && (
                      <DeleteButton
                        aria-label={t("Delete message")}
                        disabled={message.isSaving}
                        onClick={() => void handleDelete(message)}
                      >
                        <TrashIcon size={16} />
                      </DeleteButton>
                    )}
                  </MessageRow>
                );
              })
            )}
          </Messages>
          {canPost ? (
            <Composer>
              <StyledInput
                type="textarea"
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("Write a message…")}
                maxLength={ChatMessageValidation.maxLength}
                rows={2}
                autoSize
                minHeight="2lh"
                maxHeight="8lh"
                disabled={isSending}
                margin={0}
              />
              <SendButton
                onClick={() => void handleSend()}
                disabled={!draft.trim() || isSending}
              >
                {t("Send")}
              </SendButton>
            </Composer>
          ) : (
            <ReadOnlyNotice>
              <Text type="tertiary" size="xsmall">
                {t("You do not have permission to post in this collection.")}
              </Text>
            </ReadOnlyNotice>
          )}
        </Container>
      </DrawerContent>
    </Drawer>
  );
}

const Container = styled(Flex)`
  flex: 1;
  min-height: 0;
  width: 100%;
`;

const Header = styled.div`
  flex-shrink: 0;
  padding: 8px 12px;
  border-bottom: 1px solid ${s("divider")};
  display: flex;
  align-items: center;
`;

const Messages = styled(Scrollable)<{ $isEmpty: boolean }>`
  flex: 1;
  min-height: 0;
  padding: 8px 12px;

  ${(props) =>
    props.$isEmpty &&
    `
    display: flex;
    align-items: center;
    justify-content: center;
  `}
`;

const EmptyState = styled(Text).attrs({ type: "tertiary" })`
  text-align: center;
  padding: 0 16px;
`;

const MessageRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid ${s("divider")};

  &:last-child {
    border-bottom: 0;
  }
`;

const StyledAvatar = styled(Avatar)`
  margin-top: 2px;
`;

const Body = styled(Flex)`
  flex: 1;
  min-width: 0;
`;

const Meta = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const Author = styled(Text)`
  display: inline;
`;

const BodyText = styled(Text)`
  white-space: pre-wrap;
  word-break: break-word;
`;

const DeleteButton = styled(Button).attrs({ neutral: true, borderOnHover: true })`
  flex-shrink: 0;
  margin-top: 2px;
  padding: 4px;
  min-height: 0;
  height: 28px;
  width: 28px;
`;

const Composer = styled(Flex)`
  flex-shrink: 0;
  border-top: 1px solid ${s("divider")};
  padding: 8px;
  gap: 8px;
  align-items: flex-end;
`;

const StyledInput = styled(Input)`
  flex: 1;
`;

const SendButton = styled(Button)`
  flex-shrink: 0;
`;

const ReadOnlyNotice = styled.div`
  padding: 8px 12px;
  border-top: 1px solid ${s("divider")};
`;

export default observer(ChatPanel);
