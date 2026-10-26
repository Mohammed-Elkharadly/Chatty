import { useState, useEffect } from "react";
import { useAppSelector } from "../../app/hooks";
import { useOutletContext } from "react-router-dom";
import type { ChatLayoutContext } from "../../components/ChatLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAngleRight,
  faMagnifyingGlass,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useLazySearchInMessageQuery } from "../../features/messages/messageEndpoints";
import { RelativeTimeDisplay } from "../../utils/components/RelativeTimeDisplay";

interface ChatHeaderProps {
  onJump: (messageId: string) => void; // tells ChatPage which message to scroll to
}

const ChatHeader = ({ onJump }: ChatHeaderProps) => {
  const { isHidden, setIsHidden } = useOutletContext<ChatLayoutContext>();

  const user = useAppSelector((state) => state.auth.user);
  const { selectedContact, onlineUsers } = useAppSelector(
    (state) => state.users,
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");

  const [triggerSearch, { currentData, originalArgs, isFetching }] =
    useLazySearchInMessageQuery();

  const query = term.trim();
  const contactId = selectedContact?._id;
  // debounced search, only for 2+ characters (the server rejects less)
  useEffect(() => {
    if (!contactId || query.length < 2) return;
    const timer = setTimeout(
      () => triggerSearch({ userId: contactId, queryTerm: query }),
      400,
    );
    return () => clearTimeout(timer);
  }, [contactId, query, triggerSearch]);

  if (!selectedContact) return null;

  const isOnline = onlineUsers.includes(selectedContact?._id);
  const canShowResults =
    searchOpen &&
    query.length >= 2 &&
    !isFetching &&
    originalArgs?.userId === contactId &&
    originalArgs?.queryTerm === query;

  const lastSeen = selectedContact?.lastSeen;

  // closes the search box and clears it
  const closeSearch = () => {
    setSearchOpen(false);
    setTerm("");
  };

  return (
    <div className='relative flex items-center gap-3 border-b border-base-300 bg-base-100 px-4 py-3'>
      {/* Show sidebar button */}
      {isHidden && (
        <button
          type='button'
          title='show sidebar contact'
          className='btn bg-[#191e24] btn-sm border border-[#0000007d] btn-square hover:bg-[#1e1584]'
          onClick={() => setIsHidden((prev) => !prev)}
          aria-label='Show sidebar'
        >
          <FontAwesomeIcon icon={faAngleRight} />
        </button>
      )}

      {/* Avatar */}
      <div className='relative avatar'>
        <div className='flex w-10 items-center justify-center rounded-full border border-gray-200 bg-neutral text-neutral-content'>
          {selectedContact.avatar ? (
            <img src={selectedContact.avatar} alt={selectedContact.name} />
          ) : (
            <span>{selectedContact.name.charAt(0).toUpperCase() || "?"}</span>
          )}
        </div>

        {/* Online mark */}
        <span
          className={`absolute -top-1 -left-0.5 h-3 w-3 rounded-full border-2 border-base-100 ${
            isOnline ? "bg-success" : "bg-gray-400"
          }`}
        />
      </div>

      {/* Contact info */}
      <div className='text-xs text-base-content/50'>
        <p className='font-semibold'>{selectedContact.name}</p>
        <p>{selectedContact.email}</p>
        {!isOnline && (
          <p>
            Last seen:{" "}
            {lastSeen ? (
              <RelativeTimeDisplay lastSeenDate={lastSeen} />
            ) : (
              "Offline"
            )}
          </p>
        )}
      </div>

      {/* Search */}
      <div className='ml-auto flex items-center gap-2'>
        {searchOpen && (
          <input
            type='text'
            autoFocus
            aria-label='search messages'
            className='input input-bordered input-sm w-40 focus:outline-none sm:w-60'
            placeholder='Search messages...'
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoComplete='off'
          />
        )}
        <button
          type='button'
          title='search for a message'
          aria-label={searchOpen ? "close search" : "search messages"}
          className='btn bg-[#191e24] border border-[#0000007d] hover:bg-[#1e1584] btn-sm btn-square'
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        >
          <FontAwesomeIcon icon={searchOpen ? faXmark : faMagnifyingGlass} />
        </button>
      </div>

      {/* Results */}
      {searchOpen && query.length >= 2 && (
        <div className='absolute top-full right-4 z-50 mt-1 max-h-72 w-80 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl no-scrollbar'>
          {isFetching && (
            <p className='p-3 text-xs text-gray-400'>Searching...</p>
          )}
          {canShowResults && currentData?.messages.length === 0 && (
            <p className='p-3 text-xs text-gray-400'>No messages found</p>
          )}
          {canShowResults &&
            currentData?.messages.map((msg) => (
              <button
                key={msg._id}
                type='button'
                className='block w-full border-b border-gray-700 px-3 py-2 text-left hover:bg-blue-900/50 cursor-pointer'
                onClick={() => {
                  onJump(msg._id);
                  closeSearch();
                }}
              >
                <p className='truncate text-sm'>{msg.content}</p>
                <p className='text-[11px] text-gray-400'>
                  {msg.senderId === user?.id ? "You" : selectedContact.name} ·{" "}
                  {new Date(msg.createdAt).toLocaleString()}
                </p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
