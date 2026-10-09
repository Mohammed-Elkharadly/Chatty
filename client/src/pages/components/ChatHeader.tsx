import { useAppSelector } from "../../app/hooks";
import { useOutletContext } from "react-router-dom";
import type { ChatLayoutContext } from "../../components/ChatLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleRight } from "@fortawesome/free-solid-svg-icons";

const ChatHeader = () => {
  const { isHidden, setIsHidden } = useOutletContext<ChatLayoutContext>();

  const { selectedContact, onlineUsers } = useAppSelector(
    (state) => state.users,
  );

  if (!selectedContact) return null;

  const isOnline = onlineUsers.includes(selectedContact?._id);

  if (!selectedContact) return null;

  return (
    <div className='flex items-center gap-3 border-b border-base-300 bg-base-100 px-4 py-3'>
      {/* Show sidebar button */}
      {isHidden && (
        <button
          type='button'
          title='show sidebar contact'
          className='btn btn-square hover:bg-blue-900'
          onClick={() => setIsHidden((prev) => !prev)}
          aria-label='Show sidebar'
        >
          <FontAwesomeIcon icon={faAngleRight} />
        </button>
      )}

      {/* Avatar */}
      <div className='relative avatar'>
        <div className='flex w-10 items-center justify-center rounded-full border border-gray-200 bg-neutral text-neutral-content'>
          {selectedContact.avatar ? (
            <img src={selectedContact.avatar} alt={selectedContact.name} />
          ) : (
            <span>{selectedContact.name.charAt(0).toUpperCase() || "?"}</span>
          )}
        </div>

        {/* Online mark */}
        <span
          className={`absolute -top-1 -left-0.5 h-3 w-3 rounded-full border-2 border-base-100 ${
            isOnline ? "bg-success" : "bg-gray-400"
          }`}
        />
      </div>

      {/* Contact info */}
      <div>
        <p className='font-semibold'>{selectedContact.name}</p>

        <p className='text-xs text-base-content/50'>{selectedContact.email}</p>
      </div>
    </div>
  );
};

export default ChatHeader;
