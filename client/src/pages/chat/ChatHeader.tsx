import { useAppSelector } from '../../app/hooks';

const ChatHeader = () => {
  const { selectedContact } = useAppSelector((state) => state.users);
  if (!selectedContact) return null;

  return (
    <>
      {/** Header */}
      <div className="flex items-center gap-3 border-b border-gray-400 bg-base-100 px-4 py-3">
        <div className="placeholder avatar">
          <div className="flex w-10 items-center justify-center rounded-full bg-neutral text-neutral-content">
            {selectedContact.avatar ? (
              <img src={selectedContact.avatar} alt={selectedContact.name} />
            ) : (
              <span>{selectedContact.name.charAt(0).toUpperCase() || '?'}</span>
            )}
          </div>
        </div>
        <div>
          <p className="font-semibold">{selectedContact.name}</p>
          <p className="text-xs text-base-content/50">
            {selectedContact.email}
          </p>
        </div>
      </div>
    </>
  );
};

export default ChatHeader;
