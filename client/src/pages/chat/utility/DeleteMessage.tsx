import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useDeleteMessageMutation } from '../../../features/messages/api/messageApi';
import type { Message } from '../../../features/messages/types/message.types';

interface DeleteMessageProps {
  message: Message;
  setOpenMenuId: React.Dispatch<React.SetStateAction<string | null>>;
}

const DeleteMessage = ({ message, setOpenMenuId }: DeleteMessageProps) => {
  const [deleteMessage] = useDeleteMessageMutation();

  const handleDelete = async () => {
    try {
      await deleteMessage(message._id).unwrap();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Failed to delete message', error);
    }
  };

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 text-gray-100 hover:text-red-600 w-full cursor-pointer"
        onClick={handleDelete}
        aria-label="delete"
      >
        <span className="text-sm">Delete</span>
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </>
  );
};

export default DeleteMessage;
