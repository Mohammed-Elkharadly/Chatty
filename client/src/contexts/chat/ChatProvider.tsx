import { useState, useRef, useEffect, type ReactNode } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useUpdateMessageMutation,
} from "../../features/messages/messageEndpoints";
import { clearUnRead } from "../../features/users/usersSlice";
import { setMessages } from "../../features/messages/messageSlice";
import type { Message } from "../../features/messages/message.types";
import { ChatContext } from "./ChatContext";
import type { ChatContextValue } from "./ChatContext";

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attachmentRemoved, setAttachmentRemoved] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastReadRef = useRef<string | null>(null);
  const dispatch = useAppDispatch();

  const messages = useAppSelector((state) => state.messages.messages);
  const user = useAppSelector((state) => state.auth.user);
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );
  const onlineUsers = useAppSelector((state) => state.users.onlineUsers);

  const editingMessage = messages.find((msg) => msg._id === editingId) ?? null;

  const { data } = useGetMessagesQuery(selectedContact?._id ?? skipToken, {
    skip: !selectedContact?._id,
  });

  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [updateMessage, { isLoading: isUpdating }] = useUpdateMessageMutation();
  const [markAsRead] = useMarkAsReadMutation();

  const resetInput = () => {
    setContent("");
    setFile(null);
    setAttachmentRemoved(false);
    inputRef.current?.focus();
  };

  // sync messages from api to redux store
  useEffect(() => {
    if (data?.messages) {
      dispatch(setMessages(data.messages));
    }
  }, [data, dispatch]);

  // mark as read when contact is selected or new message arrives
  useEffect(() => {
    if (!selectedContact || messages?.length === 0) return;
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage?.senderId === selectedContact._id &&
      lastMessage._id !== lastReadRef.current
    ) {
      lastReadRef.current = lastMessage._id;
      markAsRead(selectedContact._id);
      dispatch(clearUnRead(selectedContact._id));
    }
  }, [dispatch, messages, selectedContact, markAsRead]);

  // focus on selected contact
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedContact]);

  const handleSend = async () => {
    if ((!content.trim() && !file) || !selectedContact) return;
    const formData = new FormData();
    if (content.trim()) formData.append("content", content);
    if (file) formData.append("attachment", file);
    try {
      await sendMessage({ receiverId: selectedContact._id, formData }).unwrap();
      setEditingId(null);
      resetInput();
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  // text-only, attachment-only, or both -> all return to the main input
  const handleStartEdit = (msg: Message) => {
    setEditingId(msg._id);
    setContent(msg.content ?? "");
    setFile(null);
    setAttachmentRemoved(false);
    inputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetInput();
  };

  const handleUpdate = async () => {
    if (!editingMessage) return;
    const trimmed = content.trim();
    const contentChanged = trimmed !== (editingMessage.content ?? "");
    const hasNewAttachment = !!file;
    const hasAttachmentChange =
      hasNewAttachment || (attachmentRemoved && !!editingMessage.attachment);

    // nothing changed
    if (!contentChanged && !hasAttachmentChange) {
      handleCancelEdit();
      return;
    }
    const formData = new FormData();
    if (contentChanged) formData.append("content", trimmed);
    if (hasNewAttachment) formData.append("attachment", file);
    if (attachmentRemoved) formData.append("removeAttachment", "true");

    try {
      await updateMessage({
        _id: editingMessage._id,
        body: formData,
      }).unwrap();
      resetInput();
      setEditingId(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error("failed to update message", error);
    }
  };

  const value: ChatContextValue = {
    messages,
    selectedContact,
    user,
    onlineUsers,
    content,
    file,
    isPending: isSending || isUpdating,
    inputRef,
    editingMessage,
    attachmentRemoved,
    openMenuId,
    setOpenMenuId,
    setContent,
    setFile,
    handleSend,
    handleStartEdit,
    handleCancelEdit,
    handleUpdate,
    removeEditingAttachment: () => setAttachmentRemoved(true),
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
