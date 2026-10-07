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
  const lastReadRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const messages = useAppSelector((state) => state.messages.messages);
  const onlineUsers = useAppSelector((state) => state.users.onlineUsers);
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages, selectedContact?._id])

  if (!selectedContact) return null;

  return (
    <div className='flex flex-1 flex-col gap-4 overflow-y-auto bg-slate-900 min-h-0'>
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
              className={`flex items-center gap-2 relative ${
                isMe ? "justify-end" : "justify-start"
              }`}
            >
              {/* Show ReactionPicker on the side */}
              {!isMe && <ReactionPicker messageId={msg._id} isMe={isMe} />}

              <div
                className={`max-w-xs lg:max-w-md p-3 rounded-xl text-sm relative wrap-break-word shadow-sm ${
                  isMe
                    ? "bg-blue-600 text-white rounded-br-none pr-7"
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
                      <div className='absolute top-6 right-0 w-28 bg-gray-800 border border-gray-700 shadow-lg rounded-md z-50 p-1 flex flex-col gap-1'>
                        <button
                          type='button'
                          aria-label='update message'
                          className='flex items-center justify-between px-2 py-1.5 text-xs text-gray-200 hover:bg-gray-700 rounded cursor-pointer w-full'
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
                {msg.content && <p>{msg.content}</p>}

                {/* Footer Metadata (Timestamp & Read Status) */}
                <div className='flex items-center justify-end gap-1 mt-1.5 text-[11px] opacity-75'>
                  <span>
                    {formatTime.format(
                      new Date(isEdited ? msg.updatedAt : msg.createdAt),
                    )}
                  </span>
                  {isEdited && (
                    <span className='italic text-[10px]'>(edited)</span>
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
      <div ref={bottomRef}/>
    </div>
  );
};

export default ChatMessages;
