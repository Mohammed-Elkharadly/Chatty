import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { useDeleteMessageMutation } from "../../features/messages/messageEndpoints";
import type { Message } from "../../features/messages/message.types";

interface DeleteMessageProps {
  isOpen: boolean;
  message: Message;
}
const DeleteMessage = ({ isOpen, message }: DeleteMessageProps) => {
  const [deleteMessage] = useDeleteMessageMutation();

  const handleDelete = async () => {
    try {
      await deleteMessage(message._id).unwrap();
    } catch (error) {
      console.error("Failed to delete message", error);
    }
  };

  return (
    <>
      {isOpen && (
        <button
          type='button'
          className='flex items-center justify-evenly gap-2 text-gray-100 hover:text-red-600 w-full cursor-pointer'
          onClick={handleDelete}
          aria-label='delete'
        >
          <span className='text-sm'>Delete</span>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      )}
    </>
  );
};

export default DeleteMessage;
