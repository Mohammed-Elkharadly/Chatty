import { useState, useRef, type ChangeEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmarkCircle,
  faUpload,
  faFile,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import { useUpdateMessageMutation } from "../../features/messages/messageEndpoints";
import type { Message } from "../../features/messages/message.types";
import toast from "react-hot-toast";

const MAX_FILE_MB = 10;

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
  const [newContent, setNewContent] = useState(message.content ?? "");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [updateMessage] = useUpdateMessageMutation();

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File is too large (max ${MAX_FILE_MB}MB)`);
      return;
    }
    setNewFile(picked);
  };

  const handleCancel = () => {
    setNewContent(message.content ?? "");
    setNewFile(null);
    setEditingId(null);
  };

  const handleUpdate = async () => {
    const trimmed = newContent.trim();
    const contentChanged = trimmed !== (message.content ?? "");
    const hasAttachmentChange = !!newFile;

    // nothing changed
    if (!contentChanged && !hasAttachmentChange) {
      handleCancel();
      return;
    }

    const formData = new FormData();
    if (contentChanged) formData.append("content", trimmed);
    if (newFile) formData.append("attachment", newFile);

    setIsUpdating(true);
    try {
      await updateMessage({ _id: message._id, body: formData }).unwrap();
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update message", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isEditing) return null;

  const attachmentPreviewUrl =
    newFile && newFile.type.startsWith("image/")
      ? URL.createObjectURL(newFile)
      : !newFile && message.attachment?.type === "image"
        ? message.attachment.url
        : null;

  const attachmentName = newFile?.name ?? message.attachment?.fileName;

  return (
    <div className='absolute -top-2.5 right-3 z-50 w-80 rounded-md border border-gray-700 bg-gray-800 p-2 shadow-lg'>
      {/* Banner */}
      <div className='flex items-center justify-between rounded-md bg-yellow-600/20 px-2 py-1 text-xs'>
        <span className='flex items-center gap-2'>
          <FontAwesomeIcon icon={faPenToSquare} />
          Updating message...
        </span>
        <button
          type='button'
          aria-label='cancel edit'
          className='btn btn-ghost btn-xs btn-circle'
          onClick={handleCancel}
        >
          <FontAwesomeIcon icon={faXmarkCircle} />
        </button>
      </div>

      {/* Attachment preview */}
      {(newFile || message.attachment) && (
        <div className='relative mt-2 flex w-fit max-w-full items-center gap-2 rounded-lg bg-base-200 p-2 pr-8'>
          {attachmentPreviewUrl ? (
            <img
              src={attachmentPreviewUrl}
              alt='preview'
              className='h-16 w-16 rounded-lg object-cover'
            />
          ) : (
            <>
              <FontAwesomeIcon icon={faFile} />
              <span className='max-w-40 truncate text-sm'>
                {attachmentName}
              </span>
            </>
          )}
          {newFile && (
            <button
              type='button'
              aria-label='remove attachment'
              className='btn btn-circle btn-xs btn-error absolute top-1 right-1'
              onClick={() => setNewFile(null)}
            >
              <FontAwesomeIcon icon={faXmarkCircle} />
            </button>
          )}
        </div>
      )}

      {/* Text + actions */}
      <div className='mt-2 flex items-center gap-2'>
        <input
          type='text'
          className='input-bordered input input-sm flex-1'
          value={newContent}
          placeholder='Edit message...'
          onChange={(e) => setNewContent(e.target.value)}
          disabled={isUpdating}
          autoComplete='off'
        />
        <input
          type='file'
          ref={fileInputRef}
          accept='image/*,video/*,audio/*,application/pdf,.doc,.docx'
          className='hidden'
          onChange={handleFile}
        />
        <button
          type='button'
          aria-label='upload'
          className='btn btn-ghost btn-sm btn-square bg-gray-500'
          onClick={() => fileInputRef.current?.click()}
          disabled={isUpdating}
        >
          <FontAwesomeIcon icon={faUpload} />
        </button>
        <button
          type='button'
          onClick={handleUpdate}
          className='btn btn-sm bg-blue-900 hover:bg-primary'
          disabled={isUpdating}
        >
          {isUpdating ? (
            <span className='loading loading-xs loading-spinner' />
          ) : (
            "Update"
          )}
        </button>
      </div>
    </div>
  );
};

export default EditMessage;
