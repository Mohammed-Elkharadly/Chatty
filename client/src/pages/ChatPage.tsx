import { useState, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkAsReadMutation,
} from '../features/messages/api/messageApi';
import { clearUnRead } from '../features/users/slices/usersSlice';
import { setMessages } from '../features/messages/slices/messageSlice';
import ChatHeader from './chat/ChatHeader';
import ChatMessages from './chat/ChatMessages';
import ChatInput from './chat/ChatInput';

const ChatPage = () => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastReadRef = useRef<string | null>(null);
  const dispatch = useAppDispatch();

  const messages = useAppSelector((state) => state.messages.messages);
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

  const { data } = useGetMessagesQuery(selectedContact?._id ?? skipToken, {
    skip: !selectedContact,
  });

  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [markAsRead] = useMarkAsReadMutation();

  // sync message from api to redux store
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
      lastMessage.senderId === selectedContact._id &&
      lastMessage._id !== lastReadRef.current
    ) {
      lastReadRef.current = lastMessage._id;
      markAsRead(selectedContact?._id);
      dispatch(clearUnRead(selectedContact?._id));
    }
  }, [messages, selectedContact?._id, markAsRead, clearUnRead, dispatch]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedContact]);

  const handleSend = async () => {
    if ((!content.trim() && !image) || !selectedContact) return;
    try {
      await sendMessage({
        receiverId: selectedContact._id,
        content,
        image: image ?? undefined,
        timestamp: Date.now(),
      }).unwrap();
      setContent('');
      setImage(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  if (!selectedContact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-base-content/50">
        <span className="text-6xl">💬</span>
        <p className="text-lg">Select a contact to start chatting</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen flex-1 flex-col">
        <ChatHeader />
        {/** Message*/}
        <ChatMessages />
        {/** Input */}
        <ChatInput
          content={content}
          image={image}
          isSending={isSending}
          setContent={setContent}
          setImage={setImage}
          onSend={handleSend}
          inputRef={inputRef}
        />
      </div>
    </>
  );
};

export default ChatPage;
