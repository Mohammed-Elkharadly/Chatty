import { useState, useEffect } from 'react';
import { setContacts } from '../features/users/slices/usersSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { useGetChatHistoryQuery } from '../features/users/api/usersApi';
import { useLogoutUserMutation } from '../features/auth/api/authApi';
import SidebarHeader from './sidebar utilities/SidebarHeader';
import SidebarContent from './sidebar utilities/SidebarContent';
import SidebarFooter from './sidebar utilities/SidebarFooter';
import toast from 'react-hot-toast';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

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
  }, [Newcontacts]);

  const handleLogout = async () => {
    try {
      const data = await logoutUser().unwrap();
      toast.success(data.message);
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  return (
    <nav
      className={`flex flex-col h-screen bg-base-200
        transition-all duration-300 bg-[linear-gradient(68deg,#ff0081,black)]
      ${isOpen ? 'w-64 absolute z-40 md:relative md:z-auto' : 'w-16'}`}
    >
      {/* Toggle */}
      <div className="p-3">
        <button
          type="button"
          className="btn btn-square btn-ghost w-full hover:bg-fuchsia-800"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle sidebar"
        >
          <FontAwesomeIcon icon={faBars} size="lg" />
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
