import { useRef, useState } from 'react';
import { useAppSelector } from '../../app/hooks';
import DeleteMessage from './utility/DeleteMessage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faCheckDouble,
  faEllipsisVertical,
  faArrowDown,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons';
import EditMessage from '../chat/utility/EditMessage';

const formatTime = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});

const ChatMessages = () => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const user = useAppSelector((state) => state.auth.user);
  const { selectedContact, onlineUsers } = useAppSelector(
    (state) => state.users,
  );
  const messages = useAppSelector((state) => state.messages.messages);

  const handleScrollDown = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!selectedContact) return null;

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 bg-[linear-gradient(68deg,#ff0081,black)]">
        {messages.length === 0 ? (
          <p className="mt-4 text-center text-sm text-base-content/50">
            No message yet. Say hello! 👋
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?._id;
            const isMenuOpen = openMenuId === msg._id;
            const isEditing = editingId === msg._id;
            return (
              <div
                key={msg._id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md p-3 rounded-md text-sm relative wrap-anywhere
                    ${
                      isMe
                        ? 'bg-fuchsia-900 text-primary-content rounded-br-none'
                        : 'bg-base-300 text-base-content rounded-bl-none'
                    }`}
                >
                  {isMe && (
                    <div className="absolute top-2 right-1">
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() =>
                          setOpenMenuId(isMenuOpen ? null : msg._id)
                        }
                        aria-label="options"
                      >
                        <FontAwesomeIcon icon={faEllipsisVertical} />
                      </button>
                      {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 p-2 flex flex-col gap-3">
                          <button
                            type="button"
                            aria-label="update message"
                            onClick={() => {
                              setEditingId(msg._id);
                              setOpenMenuId(null);
                            }}
                            className="flex items-center gap-2 text-gray-100 hover:text-yellow-300 w-full cursor-pointer"
                          >
                            <span className="text-sm">Update</span>
                            <FontAwesomeIcon icon={faPenToSquare} />
                          </button>

                          <DeleteMessage
                            message={msg}
                            setOpenMenuId={setOpenMenuId}
                          />
                        </div>
                      )}
                      <EditMessage
                        message={msg}
                        setEditingId={setEditingId}
                        isEditing={isEditing}
                      />
                    </div>
                  )}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="attachment"
                      className="max-w-full rounded-md mb-2 cursor-pointer pr-2"
                      onClick={() => window.open(msg.image!, '_blank')}
                    />
                  )}
                  {msg.content && <p className="pr-4">{msg.content}</p>}
                  <p
                    className={`text-xs ${isMe ? 'text-primary-content/70 pr-3' : 'text-base-content/50'}`}
                  >
                    {formatTime.format(new Date(msg.createdAt))}
                  </p>
                  {isMe && (
                    <div className="absolute bottom-0 right-1 text-sm">
                      {msg.status === 'seen' ? (
                        <span className="text-blue-500">
                          <FontAwesomeIcon icon={faCheckDouble} />
                        </span>
                      ) : msg.status === 'delivered' ||
                        onlineUsers.includes(selectedContact._id) ? (
                        <span className="text-gray-400">
                          <FontAwesomeIcon icon={faCheckDouble} />
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          <FontAwesomeIcon icon={faCheck} />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef}></div>
        <div
          onClick={handleScrollDown}
          className="absolute btn w-10 top-25 left-1/2 translate-1/2 bg-fuchsia-900 border-none hover:bg-fuchsia-500"
        >
          <FontAwesomeIcon icon={faArrowDown} />
        </div>
      </div>
    </>
  );
};

export default ChatMessages;
