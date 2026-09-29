import { useState, useEffect } from "react";
import { setContacts } from "../features/users/usersSlice";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { useGetChatHistoryQuery } from "../features/users/usersEndpoints";
import { useLogoutUserMutation } from "../features/users/usersEndpoints";
import SidebarHeader from "./SidebarHeader";
import SidebarContent from "./SidebarContent";
import SidebarFooter from "./SidebarFooter";
import toast from "react-hot-toast";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const dispatch = useAppDispatch();

  const { user } = useAppSelector((state) => state.auth);
  const { selectedContact, contacts, onlineUsers } = useAppSelector(
    (state) => state.users,
  );
  const [logoutUser, { isLoading: isLoggingOut }] = useLogoutUserMutation();

  const { data: Newcontacts } = useGetChatHistoryQuery();

  useEffect(() => {
    if (Newcontacts) {
      dispatch(setContacts(Newcontacts));
    }
  }, [Newcontacts, dispatch]);

  const handleLogout = async () => {
    try {
      const data = await logoutUser().unwrap();
      toast.success(data.message);
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  return (
    <nav
      className={`flex flex-col min-h-dvh border-r border-base-300 bg-base-100
    transition-all duration-300 
    ${
      isOpen
        ? "w-60 fixed inset-y-0 left-0 z-40 md:relative md:inset-auto md:z-auto"
        : "w-16"
    }`}
    >
      {/* Toggle */}
      <div className='p-3'>
        <button
          type='button'
          className='btn btn-square btn-ghost w-full hover:bg-blue-900'
          onClick={() => setIsOpen(!isOpen)}
          aria-label='Toggle sidebar'
        >
          <FontAwesomeIcon icon={faBars} size='lg' />
        </button>
      </div>

      {/** Sidebar header section */}
      <SidebarHeader
        isOpen={isOpen}
        user={user}
        search={search}
        setSearch={setSearch}
      />

      {/** siderbar content or contacts list section */}
      <SidebarContent
        isOpen={isOpen}
        contacts={contacts}
        selectedContact={selectedContact}
        search={search}
        setSearch={setSearch}
        onlineUsers={onlineUsers}
      />

      <SidebarFooter
        isOpen={isOpen}
        isLoggingOut={isLoggingOut}
        handleLogout={handleLogout}
      />
    </nav>
  );
};

export default Sidebar;
