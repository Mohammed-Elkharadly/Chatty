import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { useLazySearchUsersQuery } from "../features/users/usersEndpoints";
import { setSelectedContact } from "../features/users/usersSlice";
import type { Contact } from "../features/users/users.types";
import { useGetChatHistoryQuery } from "../features/users/usersEndpoints";
import { setContacts } from "../features/users/usersSlice";
interface SidebarContentProps {
  isOpen: boolean;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
}
const SidebarContent = ({ isOpen, search, setSearch }: SidebarContentProps) => {
  const contacts = useAppSelector((state) => state.users.contacts);
  const onlineUsers = useAppSelector((state) => state.users.onlineUsers);
  const unReadCounts = useAppSelector((state) => state.users.unReadCounts);
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

  const { data: newContact } = useGetChatHistoryQuery();

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // lazy search query
  const [triggerSearch, { data: searchData, isFetching }] =
    useLazySearchUsersQuery();

  useEffect(() => {
    if (newContact) {
      dispatch(setContacts(newContact));
    }
  }, [dispatch, newContact]);

  // Restore the last selected contact after refresh
  useEffect(() => {
    if (!contacts.length) return;

    const savedId = localStorage.getItem("selectedContactId");

    if (!savedId) return;

    const contact = contacts.find((c) => c._id === savedId);

    if (contact) {
      dispatch(setSelectedContact(contact));
    }
  }, [contacts, dispatch]);

  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) return;

    const delayDebounceFn = setTimeout(() => {
      triggerSearch(query);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, triggerSearch, setSearch]);

  const displayContacts: Contact[] = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query.length >= 3) {
      return searchData?.contacts ?? [];
    }

    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query),
    );
  }, [search, searchData, contacts]);

  const sortedContacts = useMemo(() => {
    if (!selectedContact) return displayContacts;
    const selected = displayContacts.find(
      (contact) => contact._id === selectedContact._id,
    );
    if (!selected) return displayContacts;
    return [
      selected,
      ...displayContacts.filter((c) => c._id !== selectedContact._id),
    ];
  }, [displayContacts, selectedContact]);

  return (
    <>
      <div className='flex-1 overflow-y-auto p-2 no-scrollbar'>
        {isFetching && isOpen && (
          <span className='text-xs text-base-content/50 px-4 py-2'>
            Searching...
          </span>
        )}
        {displayContacts?.length === 0 ? (
          isOpen ? (
            <span className='text-xs text-base-content/50 px-4 py-2'>
              No contacts found
            </span>
          ) : null
        ) : (
          sortedContacts.map((contact: Contact) => (
            <button
              key={contact._id}
              type='button'
              className={`flex items-center w-full px-2 py-1 hover:bg-blue-900 transition-colors cursor-pointer mb-2 rounded-sm bg-[#191e24] shadow-sm shadow-black ring-2'
                ${isOpen ? "gap-3" : "justify-center"}
                ${selectedContact?._id === contact._id ? " bg-blue-950" : ""}`}
              onClick={() => {
                dispatch(setSelectedContact(contact));
                localStorage.setItem("selectedContactId", contact._id);
                navigate("/");
              }}
            >
              <div className='flex items-center gap-3 relative'>
                <div className='avatar placeholder shrink-0'>
                  <div
                    className='bg-neutral text-neutral-content
                    rounded-full w-10 flex items-center justify-center
                    border border-gray-200'
                  >
                    {contact.avatar ? (
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className='rounded-full'
                      />
                    ) : (
                      <span className='text-xs'>
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                {/** online indicator */}
                <span
                  className={`absolute z-50 top-0 left-0 w-3 h-3 rounded-full border-2 border-base-100
                  ${onlineUsers.includes(contact._id) ? "bg-success" : "bg-gray-400"}`}
                ></span>
                {isOpen && (
                  <span className='truncate text-sm'>{contact.name}</span>
                )}
                {/** unread counts */}
                {unReadCounts[contact._id] > 0 && (
                  <span
                    className='flex items-center justify-center
                        absolute w-5 h-5 rounded-full bg-red-600
                        text-white text-xs -top-2 left-6 '
                  >
                    {unReadCounts[contact._id]}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
};

export default SidebarContent;
