import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import useSocket from '../shared/hooks/useSocket';

const ChatLayout = () => {
  // connect socket when autheticated
  useSocket();
  return (
    <div className="flex h-screen ">
      <Sidebar />
      <main
        className="flex-1 overflow-hidden 
        bg-[linear-gradient(-39deg,black,orange-500)]"
      >
        <Outlet />
      </main>
    </div>
  );
};

export default ChatLayout;
