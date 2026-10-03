import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import useSocket from "../hooks/useSocket";
import { SidebarProvider } from "../contexts/sidebar/SidebarProvider";
const ChatLayout = () => {
  // connect socket when autheticated
  useSocket();
  return (
    <div className='flex h-screen'>
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>
      <main className='flex-1  bg-slate-900'>
        <Outlet />
      </main>
    </div>
  );
};

export default ChatLayout;
