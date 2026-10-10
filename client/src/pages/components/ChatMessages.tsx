import { useRef, useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../../app/hooks";
import DeleteMessage from "./DeleteMessage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetMessagesQuery } from "../../features/messages/messageEndpoints";
import { clearUnRead } from "../../features/users/usersSlice";
import { useMarkAsReadMutation } from "../../features/messages/messageEndpoints";
import {
  faCheck,
  faCheckDouble,
  faEllipsisVertical,
  faPenToSquare,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
// import EditMessage from "./EditMessage";
import AttachmentView from "./AttachmentView";
import { setMessages } from "../../features/messages/messageSlice";
import ReactionPicker from "../../components/ReactionPicker";
import ReactionBar from "../../components/ReactionBar";

interface ChatMessagesProps {
  onEdit: (id: string) => void; // tells ChatPage which message to load into ChatInput
}

const formatTime = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const ChatMessages = ({ onEdit }: ChatMessagesProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const lastReadRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const elementHeightRef = useRef<HTMLDivElement | null>(null);

  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const messages = useAppSelector((state) => state.messages.messages);
  const onlineUsers = useAppSelector((state) => state.users.onlineUsers);
  const unReadCounts = useAppSelector((state) => state.users.unReadCounts);
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

  const unreadCount = selectedContact
    ? (unReadCounts[selectedContact._id] ?? 0)
    : 0;

  const [markAsRead] = useMarkAsReadMutation();

  const { data } = useGetMessagesQuery(selectedContact?._id ?? skipToken, {
    skip: !selectedContact?._id,
  });

  useEffect(() => {
    if (data?.messages) {
      dispatch(setMessages(data.messages));
    }
  }, [dispatch, data]);

  useEffect(() => {
    const element = elementHeightRef.current;
    if (!element) return;
    const onScroll = () => {
      const distance =
        element.scrollHeight - element.scrollTop - element.clientHeight;

      setAtBottom(distance <= 100);
    };
    element.addEventListener("scroll", onScroll);
    onScroll();
    return () => {
      element.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!selectedContact || !atBottom || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.senderId === selectedContact._id) {
      lastReadRef.current = lastMessage._id;
      markAsRead(selectedContact._id);
      dispatch(clearUnRead(selectedContact._id));
    }
  }, [dispatch, messages, selectedContact, markAsRead, atBottom]);

  useEffect(() => {
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [atBottom, selectedContact?._id, messages]);

  // Click outside handler to close the active dropdown
  useEffect(() => {
    const handleClickOutSide = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current?.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutSide);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutSide);
    };
  }, [openMenuId]);

  if (!selectedContact) return null;

  return (
    <div
      ref={elementHeightRef}
      className='flex relative min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-slate-900 no-scrollbar'
    >
      {messages.length === 0 ? (
        <p className='mt-4 text-center text-sm text-gray-400'>
          No message yet. Say hello! 👋
        </p>
      ) : (
        messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          const isMenuOpen = openMenuId === msg._id;
          const isEdited =
            !!msg.updatedAt &&
            new Date(msg.updatedAt) > new Date(msg.createdAt);

          return (
            <div
              key={msg._id}
              className={`relative flex items-center gap-2 ${
                isMe ? "justify-end" : "justify-start"
              }`}
            >
              {/* Show ReactionPicker on the side */}
              {!isMe && <ReactionPicker messageId={msg._id} isMe={isMe} />}

              <div
                className={`relative max-w-xs rounded-xl p-2 text-sm wrap-break-word shadow-sm lg:max-w-md ${
                  isMe
                    ? "bg-blue-900 text-white rounded-br-none"
                    : "bg-gray-800 text-gray-100 rounded-bl-none"
                }`}
              >
                {/* Options Menu Button for User Messages */}
                {isMe && (
                  <div
                    className='absolute top-2 right-2'
                    ref={isMenuOpen ? menuRef : null}
                  >
                    <button
                      type='button'
                      className='cursor-pointer text-blue-200 hover:text-white transition-colors'
                      aria-label='options'
                      onClick={() => setOpenMenuId(isMenuOpen ? null : msg._id)}
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>
                    {isMenuOpen && (
                      <div className='absolute -top-2 right-5 z-50 flex w-28 flex-col gap-1.5 rounded border border-gray-700 bg-gray-800 p-1.5 shadow-md'>
                        <button
                          type='button'
                          aria-label='update message'
                          className='flex w-full cursor-pointer items-center justify-evenly gap-2 text-gray-100 hover:text-yellow-600'
                          onClick={() => {
                            setOpenMenuId(null);
                            onEdit(msg._id);
                          }}
                        >
                          <span>Update</span>
                          <FontAwesomeIcon icon={faPenToSquare} />
                        </button>
                        <DeleteMessage isOpen={isMenuOpen} message={msg} />
                      </div>
                    )}
                  </div>
                )}

                {/* Message Content & Media */}
                {msg.attachment && (
                  <AttachmentView attachment={msg.attachment} />
                )}
                {msg.content && <p className='pr-5'>{msg.content}</p>}

                {/* Footer Metadata (Timestamp & Read Status) */}
                <div className='mt-1.5 flex items-center justify-end gap-1 text-[11px] opacity-75'>
                  <span>
                    {formatTime.format(
                      new Date(isEdited ? msg.updatedAt : msg.createdAt),
                    )}
                  </span>
                  {isEdited && (
                    <span className='italic text-[10px] text-yellow-400'>
                      (edited)
                    </span>
                  )}

                  {isMe && (
                    <span className='ml-1 text-xs'>
                      {msg.status === "seen" ? (
                        <span className='text-green-400'>
                          <FontAwesomeIcon icon={faCheckDouble} />
                        </span>
                      ) : msg.status === "delivered" ||
                        onlineUsers.includes(selectedContact._id) ? (
                        <span className='text-gray-300'>
                          <FontAwesomeIcon icon={faCheckDouble} />
                        </span>
                      ) : (
                        <span className='text-gray-300'>
                          <FontAwesomeIcon icon={faCheck} />
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Reactions Badge */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
                    className={`absolute -bottom-3 ${isMe ? "right-2" : "left-2"}`}
                  >
                    <ReactionBar reactions={msg.reactions} />
                  </div>
                )}
              </div>

              {/* Show ReactionPicker on the right for current user */}
              {isMe && <ReactionPicker messageId={msg._id} isMe={isMe} />}
            </div>
          );
        })
      )}
      {(!atBottom || unreadCount > 0) && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            dispatch(clearUnRead(selectedContact._id));
          }}
          className='fixed bottom-20 left-[50%] z-30  h-10 w-10 flex items-center justify-center p-1 rounded-full bg-blue-900 text-white  hover:bg-blue-800 cursor-pointer shadow-lg shadow-blue-600/50 '
        >
          {unreadCount > 0 && (
            <span className='absolute -top-2 -right-1 flex w-5 h-5 items-center justify-center p-1 rounded-full bg-red-600 text-white text-xs'>
              {unreadCount}
            </span>
          )}
          <FontAwesomeIcon icon={faChevronDown} />
        </button>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatMessages;
