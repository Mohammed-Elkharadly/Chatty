import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import useSocket from '../hooks/useSocket';

const ChatLayout = () => {
  // connect socket when autheticated
  useSocket();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1  bg-slate-900">
        <Outlet />
      </main>
    </div>
  );
};

export default ChatLayout;
