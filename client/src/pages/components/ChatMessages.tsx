import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  startTransition,
} from "react";
import { useAppSelector, useAppDispatch } from "../../app/hooks";
import DeleteMessage from "./DeleteMessage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
} from "../../features/messages/messageEndpoints";
import { clearUnRead } from "../../features/users/usersSlice";
import { resetMessages } from "../../features/messages/messageSlice";
import { useMarkAsReadMutation } from "../../features/messages/messageEndpoints";
import {
  faCheck,
  faCheckDouble,
  faEllipsisVertical,
  faPenToSquare,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
// import EditMessage from "./EditMessage";
import AttachmentView from "../../utils/components/AttachmentView";
import ReactionPicker from "../../utils/components/ReactionPicker";
import ReactionBar from "../../utils/components/ReactionBar";

interface ChatMessagesProps {
  onEdit: (id: string) => void;
  jumpToId: string | null; // message picked in search
  setJumpToId: React.Dispatch<React.SetStateAction<string | null>>;
}

const formatTime = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const ChatMessages = ({ onEdit, jumpToId, setJumpToId }: ChatMessagesProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const lastReadRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const elementHeightRef = useRef<HTMLDivElement | null>(null);
  const prevHeightRef = useRef<number | null>(null);
  // last scrollTop, used to tell scroll direction
  const lastScrollTopRef = useRef(0);
  // message shown with a ring for a moment after a jump
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [olderLoadError, setOlderLoadError] = useState(false);

  const dispatch = useAppDispatch();

  const hasMore = useAppSelector((state) => state.messages.hasMore);
  const user = useAppSelector((state) => state.auth.user);
  const messages = useAppSelector((state) => state.messages.messages);
  const unReadCounts = useAppSelector((state) => state.users.unReadCounts);
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

  const unreadCount = selectedContact
    ? (unReadCounts[selectedContact._id] ?? 0)
    : 0;

  const [markAsRead] = useMarkAsReadMutation();

  const [loadOlder, { isFetching: isLoadingOlder }] = useLazyGetMessagesQuery();

  // first page (arg is now an object)
  useGetMessagesQuery(
    selectedContact ? { userId: selectedContact._id } : skipToken,
    { refetchOnMountOrArgChange: true },
  );

  const loadOlderMessages = useCallback(() => {
    const element = elementHeightRef.current;

    if (
      !element ||
      !selectedContact ||
      !hasMore ||
      isLoadingOlder ||
      olderLoadError ||
      !messages.length
    )
      return;

    prevHeightRef.current = element.scrollHeight;

    loadOlder({
      userId: selectedContact._id,
      oldestMessagesId: messages[0]._id,
    })
      .unwrap()
      .then(() => setOlderLoadError(false))
      .catch(() => {
        prevHeightRef.current = null;
        setOlderLoadError(true);
      });
  }, [
    selectedContact,
    hasMore,
    isLoadingOlder,
    olderLoadError,
    messages,
    loadOlder,
  ]);

  // after older messages are added, move scroll down by the added height
  useLayoutEffect(() => {
    const element = elementHeightRef.current;
    if (element && prevHeightRef.current !== null) {
      element.scrollTop += element.scrollHeight - prevHeightRef.current;
      prevHeightRef.current = null;
    }
  }, [messages]);

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

  // new chat opened → forget the last read message
  useEffect(() => {
    lastReadRef.current = null;
  }, [selectedContact?._id]);

  useEffect(() => {
    if (!selectedContact || !atBottom || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    // skip if it's not from the contact or was already marked as read
    if (
      lastMessage?.senderId !== selectedContact._id ||
      lastReadRef.current === lastMessage._id
    )
      return;
    lastReadRef.current = lastMessage._id;
    markAsRead(selectedContact._id);
    dispatch(clearUnRead(selectedContact._id));
  }, [dispatch, messages, selectedContact, markAsRead, atBottom]);

  useEffect(() => {
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [atBottom, messages]);

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
    dispatch(resetMessages());
  }, [dispatch, selectedContact?._id]);

  // scrolls to the searched message; loads older pages until it exists
  useEffect(() => {
    if (!jumpToId) return;
    const element = document.getElementById(`msg-${jumpToId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      startTransition(() => {
        setHighlightId(jumpToId);
        setJumpToId(null);
      });
    } else if (hasMore) {
      loadOlderMessages(); // effect re-runs when the new page arrives
    } else {
      setJumpToId(null); // no more pages and still missing → give up
    }
  }, [jumpToId, messages, hasMore, loadOlderMessages, setJumpToId]);

  // removes the highlight after 2 seconds
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightId]);

  if (!selectedContact) return null;

  return (
    <div
      ref={elementHeightRef}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        const scrollingUp = top < lastScrollTopRef.current; // true only when moving up
        lastScrollTopRef.current = top;
        if (scrollingUp && top < 80) loadOlderMessages();
      }}
      className='flex relative min-h-0 flex-1 flex-col gap-4 py-4 overflow-y-auto bg-slate-900 no-scrollbar'
    >
      {isLoadingOlder && (
        <span className='loading loading-spinner loading-sm mx-auto' />
      )}
      {olderLoadError && (
        <button
          type='button'
          onClick={() => setOlderLoadError(false)}
          className='btn btn-sm mx-auto'
        >
          Retry loading older messages
        </button>
      )}
      {messages.length === 0 ? (
        <p className='mt-4 text-center text-sm text-gray-400'>
          No message yet. Say hello! 👋
        </p>
      ) : (
        messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          const isMenuOpen = openMenuId === msg._id;
          const isEdited = !!msg.editedAt;

          return (
            <div
              key={msg._id}
              id={`msg-${msg._id}`}
              className={`relative flex items-center ${
                isMe ? "justify-end" : "justify-start"
              } ${highlightId === msg._id ? "ring-2 ring-yellow-400" : ""}`}
            >
              {/* Show ReactionPicker on the side */}
              {!isMe && <ReactionPicker messageId={msg._id} isMe={isMe} />}

              <div
                className={`relative max-w-xs mt-3 rounded-md p-2 text-sm shadow-sm lg:max-w-md ${
                  isMe
                    ? "bg-[#1e1584] text-white rounded-br-none"
                    : "bg-gray-800 text-gray-100 rounded-bl-none"
                }`}
              >
                <div className='flex items-start justify-between'>
                  {/* Message Content & Media */}
                  <div className='flex flex-col'>
                    {msg.attachment && (
                      <AttachmentView attachment={msg.attachment} />
                    )}
                    {msg.content && (
                      <p className='wrap-anywhere'>{msg.content}</p>
                    )}
                  </div>

                  {/* Options Menu Button for User Messages */}
                  {isMe && (
                    <div className='' ref={isMenuOpen ? menuRef : null}>
                      <button
                        type='button'
                        className='cursor-pointer text-blue-200 hover:text-white transition-colors'
                        aria-label='options'
                        onClick={() =>
                          setOpenMenuId(isMenuOpen ? null : msg._id)
                        }
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
                </div>

                {/* Footer Metadata (Timestamp & Read Status) */}
                <div
                  className={`mt-1.5 -mb-1 flex items-center ${isMe ? "justify-start" : "justify-end"} gap-1 text-[11px] opacity-75`}
                >
                  {isMe && (
                    <span className='text-xs'>
                      {msg.status === "seen" ? (
                        <span className='text-green-400'>
                          <FontAwesomeIcon icon={faCheckDouble} />
                        </span>
                      ) : msg.status === "delivered" ? (
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

                  {isEdited && (
                    <span className='italic text-[10px] text-yellow-400 mr-1'>
                      updated
                    </span>
                  )}

                  <span>
                    {formatTime.format(
                      new Date(isEdited ? msg.updatedAt : msg.createdAt),
                    )}
                  </span>
                </div>

                {/* Reactions Badge */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
                    className={`absolute -bottom-4.5 ${isMe ? "left-0" : "right-0"}`}
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
          className='fixed bottom-20 left-[50%] z-30  h-10 w-10 flex items-center justify-center p-1 rounded-full
                     bg-blue-900 text-white  hover:bg-blue-800 cursor-pointer shadow-lg shadow-blue-600/50 '
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            dispatch(clearUnRead(selectedContact._id));
          }}
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
