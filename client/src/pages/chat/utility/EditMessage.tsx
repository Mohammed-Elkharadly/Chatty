import { useState, useRef, type ChangeEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmarkCircle, faUpload } from '@fortawesome/free-solid-svg-icons';
import { useUpdateMessageMutation } from '../../../features/messages/api/messageApi';
import type { Message } from '../../../features/messages/types/message.types';

interface UpdateMessageProps {
  message: Message;
  isEditing: boolean;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
}
const EditMessage = ({
  message,
  isEditing,
  setEditingId,
}: UpdateMessageProps) => {
  const hasContent = !!message.content;
  const hasImage = !!message.image;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newContent, setNewContent] = useState(message?.content || '');
  const [newImage, setNewImage] = useState(message?.image || '');

  const [updateMessage] = useUpdateMessageMutation();

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setNewImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpdate = async () => {
    const hasChanges =
      newContent !== message.content || newImage !== message.image;
    if (!hasChanges || (!newContent?.trim() && !newImage)) {
      setEditingId(null);
      return;
    }
    try {
      await updateMessage({
        _id: message._id,
        content: newContent,
        image: newImage,
      }).unwrap();
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update message', error);
    }
  };

  return (
    <>
      {isEditing && (
        <div
          className="absolute -top-2.5 right-3 w-70 bg-gray-800 border
          border-gray-700 rounded-md shadow-lg
           z-50 p-2"
        >
          <button
            type="button"
            className="cursor-pointer absolute top-1 right-1"
            aria-label="cancel"
            onClick={() => setEditingId(null)}
          >
            <FontAwesomeIcon icon={faXmarkCircle} />
          </button>
          {hasContent && hasImage ? (
            <div className="flex flex-col gap-3 pt-5 pb-3">
              <img
                src={newImage}
                alt="new image"
                className="w-full max-h-60 object-contain rounded-lg bg-black/20"
              />
              <label htmlFor="update-file" aria-label="update-file"></label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                name="update-file"
                id="update-file"
                className="hidden"
                onChange={handleImageChange}
              />
              <button
                type="button"
                aria-label="upload"
                className="btn btn-ghost btn-sm btn-square bg-gray-500"
                onClick={() => fileInputRef.current?.click()}
              >
                <FontAwesomeIcon icon={faUpload} />
              </button>

              <label htmlFor="update-content">Update</label>
              <input
                id="update-content"
                name="update-content"
                className="w-full px-2 py-2 rounded-md bg-gray-700 text-white outline-none focus:ring-2 focus:ring-yellow-500"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
              <button
                type="button"
                onClick={handleUpdate}
                className="cursor-pointer p-2 w-full bg-yellow-500 hover:bg-yellow-300 border-none rounded-md"
              >
                Update
              </button>
            </div>
          ) : hasImage ? (
            <div className="flex flex-col gap-3 pt-5 pb-3">
              <img
                src={newImage}
                alt={newImage}
                className="w-full max-h-60 object-contain rounded-lg bg-black/20"
              />
              <label htmlFor="update-file" aria-label="update-file"></label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                name="update-file"
                id="update-file"
                className="hidden"
                onChange={handleImageChange}
              />
              <button
                type="button"
                aria-label="upload"
                className="btn btn-ghost btn-sm btn-square bg-gray-500"
                onClick={() => fileInputRef.current?.click()}
              >
                <FontAwesomeIcon icon={faUpload} />
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className="cursor-pointer p-2 w-full bg-yellow-500 hover:bg-yellow-300 border-none rounded-md"
              >
                Update
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-5 pb-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="update-content" className="text-center">
                  Update
                </label>
                <input
                  id="update-content"
                  name="update-content"
                  className="w-full px-2 py-2 rounded-md bg-gray-700 text-white outline-none focus:ring-2 focus:ring-yellow-500"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={handleUpdate}
                className="cursor-pointer p-2 w-full bg-yellow-500 hover:bg-yellow-300 border-none rounded-md"
              >
                Update
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
export default EditMessage;
