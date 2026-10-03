import { useChat } from "../contexts/chat/useChat";
import ChatHeader from "./components/ChatHeader";
import ChatMessages from "./components/ChatMessages";
import ChatInput from "./components/ChatInput";


const ChatPage = () => {
  const { selectedContact } = useChat();
  if (!selectedContact) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-4 text-base-content/50'>
        <span className='text-6xl mt-5'>💬</span>
        <p className='text-lg'>Select a contact to start chatting</p>
      </div>
    );
  }

  return (
    <>
      <div className='flex h-screen flex-1 flex-col'>
        <ChatHeader />
        <ChatMessages />
        <ChatInput />
      </div>
    </>
  );
};

export default ChatPage;
