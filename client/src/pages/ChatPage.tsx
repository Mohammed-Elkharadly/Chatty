import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import ChatHeader from "./components/ChatHeader";
import ChatMessages from "./components/ChatMessages";
import ChatInput from "./components/ChatInput";
import { useAppSelector } from "../app/hooks";
import type { ChatLayoutContext } from "../components/ChatLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleRight } from "@fortawesome/free-solid-svg-icons";

const ChatPage = () => {
  const { isHidden, setIsHidden } = useOutletContext<ChatLayoutContext>();

  const [editingId, setEditingId] = useState<string | null>(null);
  // id of the search result the user clicked
  const [jumpToId, setJumpToId] = useState<string | null>(null);

  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

  const [prevContactId, setPrevContactId] = useState(selectedContact?._id);

  if (selectedContact?._id !== prevContactId) {
    setPrevContactId(selectedContact?._id);
    setEditingId(null); // contact changed → cancel any in-progress edit
    setJumpToId(null);
  }

  if (!selectedContact) {
    localStorage.removeItem("selectedContactId");
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-4 text-base-content/50'>
        <span className='text-6xl mt-5'>💬</span>
        <p className='text-lg'>Select a contact to start chatting</p>
        {isHidden && (
          <button
            type='button'
            title='show sidebar contact'
            className='btn btn-square bg-[#1e1584] w-50 text-xl'
            onClick={() => setIsHidden((prev) => !prev)}
            aria-label='Show sidebar'
          >
            <FontAwesomeIcon icon={faAngleRight} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-1 flex-col'>
      {/** The key resets the search box when you switch contacts */}
      <ChatHeader key={selectedContact._id} onJump={setJumpToId} />
      <ChatMessages
        onEdit={setEditingId}
        jumpToId={jumpToId}
        setJumpToId={setJumpToId}
      />
      <ChatInput
        key={editingId ?? "new"}
        editingId={editingId}
        setEditingId={setEditingId}
      />
    </div>
  );
};

export default ChatPage;
