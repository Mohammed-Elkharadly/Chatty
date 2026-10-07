import { useState } from "react";
import ChatHeader from "./components/ChatHeader";
import ChatMessages from "./components/ChatMessages";
import ChatInput from "./components/ChatInput";
import { useAppSelector } from "../app/hooks";

const ChatPage = () => {
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );
  // shared between ChatMessages (sets it via the Update button) and
  // ChatInput (reads it to prefill the input + show the edit banner)
  const [editingId, setEditingId] = useState<string | null>(null);

  const [prevContactId, setPrevContactId] = useState(selectedContact?._id);
  if (selectedContact?._id !== prevContactId) {
    setPrevContactId(selectedContact?._id);
    setEditingId(null); // contact changed → cancel any in-progress edit
  }

  if (!selectedContact) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-4 text-base-content/50'>
        <span className='text-6xl mt-5'>💬</span>
        <p className='text-lg'>Select a contact to start chatting</p>
      </div>
    );
  }

  return (
    <div className='flex h-screen flex-1 flex-col'>
      <ChatHeader />
      <ChatMessages onEdit={setEditingId} />
      <ChatInput
        key={editingId ?? "new"}
        editingId={editingId}
        setEditingId={setEditingId}
      />
    </div>
  );
};

export default ChatPage;
