import { useEffect, useRef } from "react";
import { usersApi } from "../features/users/usersEndpoints";
import {
  normalizeMessage,
  type RawMessage,
} from "../features/messages/messageEndpoints";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setOnlineUsers, unReadMessage } from "../features/users/usersSlice";
import {
  addMessage,
  readMessage,
  removeMessage,
  editMessage,
  setReactions,
  deliverMessage,
} from "../features/messages/messageSlice";
import socket from "../lib/socket";
import type { Message } from "../features/messages/message.types";

const useSocket = () => {
  const dispatch = useAppDispatch();
  const isMuted = useAppSelector((state) => state.users.isMuted);
  const userId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSetup = useRef(false);

  const selectedContactId = useAppSelector(
    (state) => state.users.selectedContact?._id,
  );
  const selectedIdRef = useRef(selectedContactId);

  const isMutedRef = useRef(isMuted);
  const userIdRef = useRef(userId);

  useEffect(() => {
    isMutedRef.current = isMuted;
    userIdRef.current = userId;
    selectedIdRef.current = selectedContactId;
  }, [isMuted, userId, selectedContactId]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      if (socket.connected || isSetup.current) {
        socket.off("users:online");
        socket.off("message:new");
        socket.off("messages:read");
        socket.off("message:delete");
        socket.off("message:update");
        socket.off("message:reaction");
        socket.off("messages:delivered");
        if (socket.connected) socket.disconnect();
        isSetup.current = false;
      }
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const announceOnline = () => socket.emit("users:online", userId);

    socket.on("connect", announceOnline);

    if (!isSetup.current) {
      socket.on("users:online", (userIds: string[]) => {
        dispatch(setOnlineUsers(userIds));
      });

      socket.on("message:new", (message: RawMessage) => {
        const normalizedMessage = normalizeMessage(message);

        // the other person in this message (not me)
        const otherId =
          normalizedMessage.senderId === userIdRef.current
            ? normalizedMessage.receiverId
            : normalizedMessage.senderId;

        // only show the message if its chat is open
        if (otherId === selectedIdRef.current) {
          dispatch(addMessage(normalizedMessage));
        }

        dispatch(usersApi.util.invalidateTags(["Contacts"])); // always refresh order

        if (normalizedMessage.senderId !== userIdRef.current) {
          dispatch(unReadMessage(normalizedMessage.senderId));
        }
        if (
          !isMutedRef.current &&
          normalizedMessage.senderId !== userIdRef.current
        ) {
          if (!audioRef.current) {
            audioRef.current = new Audio("/notification.wav");
          }
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            console.log("Audio play blocked until user interacts");
          });
        }
      });

      socket.on("messages:read", ({ by }: { by: string }) => {
        dispatch(readMessage(by));
      });

      socket.on("message:update", (data: Message) => {
        dispatch(editMessage(data));
      });

      socket.on("message:delete", ({ messageId }: { messageId: string }) => {
        dispatch(removeMessage(messageId));
      });

      socket.on("message:reaction", ({ messageId, reactions }) => {
        dispatch(setReactions({ messageId, reactions }));
      });

      socket.on("messages:delivered", ({ by }: { by: string }) => {
        dispatch(deliverMessage(by));
      });

      isSetup.current = true;
    }

    return () => {
      socket.off("connect", announceOnline);
    };
  }, [isAuthenticated, userId, dispatch]);

  useEffect(() => {
    return () => {
      if (isSetup.current) {
        socket.off("users:online");
        socket.off("message:new");
        socket.off("messages:read");
        socket.off("message:delete");
        socket.off("message:update");
        socket.off("message:reaction");
        socket.off("messages:delivered");
        isSetup.current = false;
      }
      if (socket.connected) socket.disconnect();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  return null;
};

export default useSocket;
