import { useEffect, useRef } from 'react';
import { usersApi } from '../../features/users/api/usersApi';
import {
  normalizeMessage,
  type RawMessage,
} from '../../features/messages/api/messageApi';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  setOnlineUsers,
  unReadMessage,
} from '../../features/users/slices/usersSlice';
import {
  addMessage,
  markMessagesAsRead,
  removeMessage,
  editMessage,
} from '../../features/messages/slices/messageSlice';
import socket from '../socket';
import type { Message } from '../../features/messages/types/message.types';

const useSocket = () => {
  const dispatch = useAppDispatch();
  const isMuted = useAppSelector((state) => state.users.isMuted);
  const userId = useAppSelector((state) => state.auth.user?._id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSetup = useRef(false);

  const isMutedRef = useRef(isMuted);
  const userIdRef = useRef(userId);

  useEffect(() => {
    isMutedRef.current = isMuted;
    userIdRef.current = userId;
  }, [isMuted, userId]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      if (socket.connected || isSetup.current) {
        socket.off('users:online');
        socket.off('message:new');
        socket.off('messages:read');
        socket.off('message:delete');
        socket.off('message:update');
        if (socket.connected) {
          socket.disconnect();
        }
        isSetup.current = false;
      }
      return;
    }

    if (!socket.connected) {
      socket.connect();
      socket.emit('users:online', userId);
    }

    if (!isSetup.current) {
      socket.on('users:online', (userIds: string[]) => {
        dispatch(setOnlineUsers(userIds));
      });

      socket.on('message:new', (message: RawMessage) => {
        const normalizedMessage = normalizeMessage(message);
        dispatch(addMessage(normalizedMessage));

        if (message.senderId && typeof message.senderId === 'object') {
          const senderIdString = message.senderId._id;

          if (senderIdString !== userId?.toString()) {
            dispatch(usersApi.util.invalidateTags(['Contacts']));
            dispatch(unReadMessage(senderIdString));
          }
        }
        if (
          !isMutedRef.current &&
          normalizedMessage.senderId !== userIdRef.current
        ) {
          if (!audioRef.current) {
            audioRef.current = new Audio('/notification.wav');
          }
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            console.log('Audio play blocked until user interacts');
          });
        }
      });

      socket.on('messages:read', () => {
        dispatch(markMessagesAsRead());
      });

      socket.on('message:update', (data: Message) => {
        dispatch(editMessage(data));
      });

      socket.on('message:delete', ({ messageId }: { messageId: string }) => {
        dispatch(removeMessage(messageId));
      });

      isSetup.current = true;
    }

    return () => {};
  }, [isAuthenticated, userId]);

  useEffect(() => {
    return () => {
      if (isSetup.current) {
        socket.off('users:online');
        socket.off('message:new');
        socket.off('messages:read');
        socket.off('message:delete');
        socket.off('message:update');
        isSetup.current = false;
      }
      if (socket.connected) {
        socket.disconnect();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  return null;
};

export default useSocket;
