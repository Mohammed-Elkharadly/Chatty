import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useLazySearchUsersQuery } from '../../features/users/api/usersApi';
import { setSelectedContact } from '../../features/users/slices/usersSlice';
import type { Contact } from '../../features/users/types/users.types';

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

    const clearSearch = setTimeout(() => {
      setSearch('');
    }, 10000);

    return () => {
      clearTimeout(delayDebounceFn);
      clearTimeout(clearSearch);
    };
  }, [search, triggerSearch, setSearch]);

  const displayContacts: Contact[] = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query.length >= 3) {
      return searchData?.users ?? [];
    }

    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query),
    );
  }, [search, searchData, contacts]);

  const content = (
    <>
      <div className="flex-1 overflow-y-auto py-2">
        {isFetching && isOpen && (
          <span className="text-xs text-base-content/50 px-4 py-2">
            Searching...
          </span>
        )}
        {displayContacts?.length === 0 ? (
          isOpen ? (
            <span className="text-xs text-base-content/50 px-4 py-2">
              No contacts found
            </span>
          ) : null
        ) : (
          displayContacts.map((contact: Contact) => (
            <button
              key={contact._id}
              type="button"
              className={`flex items-center w-full px-4 py-2 hover:bg-fuchsia-900 transition-colors cursor-pointer mb-2 rounded-xl
                ${isOpen ? 'gap-3' : 'justify-center'}
                ${selectedContact?._id === contact._id ? 'bg-fuchsia-900' : ''}`}
              onClick={() => dispatch(setSelectedContact(contact))}
            >
              <div className="flex items-center gap-3 relative">
                <div className="avatar placeholder shrink-0">
                  <div
                    className="bg-neutral text-neutral-content
                    rounded-full w-10 flex items-center justify-center
                    border border-gray-200"
                  >
                    {contact.avatar ? (
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="rounded-full"
                      />
                    ) : (
                      <span className="text-xs">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                {/** online indicator */}
                <span
                  className={`absolute z-50 top-0 left-0 w-2 h-2 rounded-full 
                  ${onlineUsers.includes(contact._id) ? 'bg-success' : 'bg-gray-400'}`}
                ></span>
                {isOpen && (
                  <span className="truncate text-sm">{contact.name}</span>
                )}
                {/** unread counts */}
                {unReadCounts[contact._id] > 0 && (
                  <span
                    className="flex items-center justify-center
                        absolute w-5 h-5 rounded-full bg-red-600
                        text-white text-xs -top-2 left-6 "
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
  return content;
};

export default SidebarContent;
