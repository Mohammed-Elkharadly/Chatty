import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { useLazySearchUsersQuery } from "../features/users/usersEndpoints";
import { setSelectedContact } from "../features/users/usersSlice";
import type { Contact } from "../features/users/users.types";

interface SidebarContentProps {
  isOpen: boolean;
  contacts: Contact[];
  selectedContact: Contact | null;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  onlineUsers: string[];
}
const SidebarContent = ({
  isOpen,
  contacts,
  selectedContact,
  search,
  setSearch,
  onlineUsers,
}: SidebarContentProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const unReadCounts = useAppSelector((state) => state.users.unReadCounts);

  // lazy search query
  const [triggerSearch, { data: searchData, isFetching }] =
    useLazySearchUsersQuery();

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
      <div className='flex-1 overflow-y-auto p-2'>
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
              className={`flex items-center w-full px-2 py-1 hover:bg-blue-700 transition-colors cursor-pointer mb-2 rounded-xl
                ${isOpen ? "gap-3" : "justify-center"}
                ${selectedContact?._id === contact._id ? " bg-blue-900" : ""}`}
              onClick={() => {
                dispatch(setSelectedContact(contact));
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
                  className={`absolute z-50 top-0 left-0 w-2 h-2 rounded-full 
                  ${onlineUsers.includes(contact._id) ? "bg-success" : "bg-gray-400"}`}
                ></span>
                {isOpen && (
                  <span className='truncate text-sm'>{contact.name}</span>
                )}
                {/** unread counts */}
                {unReadCounts[contact._id] > 0 && (
                  <span
                    className='flex items-center justify-center
                        absolute w-4 h-4 rounded-full bg-red-600
                        text-white text-[5px] -top-2 left-6 '
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
