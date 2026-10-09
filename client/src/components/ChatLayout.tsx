import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import useSocket from "../hooks/useSocket";

export type ChatLayoutContext = {
  isHidden: boolean;
  setIsHidden: React.Dispatch<React.SetStateAction<boolean>>;
};

const ChatLayout = () => {
  // connect socket when autheticated
  useSocket();
  const [isHidden, setIsHidden] = useState(() => {
    return localStorage.getItem("sidebarHidden") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebarHidden", String(isHidden));
  }, [isHidden]);

  return (
    <div className='flex h-screen'>
      <Sidebar isHidden={isHidden} setIsHidden={setIsHidden} />
      <main className='flex-1 bg-slate-900'>
        <Outlet context={{ isHidden, setIsHidden }} />
      </main>
    </div>
  );
};

export default ChatLayout;
