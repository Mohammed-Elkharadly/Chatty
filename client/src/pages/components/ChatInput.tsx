import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent, ChangeEvent } from "react";
import { useChat } from "../../contexts/chat/useChat";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faXmarkCircle,
  faFile,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";

const MAX_FILE_MB = 10;

const ChatInput = () => {
  const {
    content,
    file,
    isPending,
    setContent,
    setFile,
    inputRef,
    editingMessage,
    attachmentRemoved,
    removeEditingAttachment,
    handleCancelEdit,
    handleSend,
    handleUpdate,
  } = useChat();

  const fileRef = useRef<HTMLInputElement>(null);
  const isEditing = editingMessage !== null;

  // temporary local URL for image previews (null for non-images)
  const previewUrl = useMemo(
    () => (file?.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );

  // frees the temporary URL when the file changes or the component unmounts
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // validates the picked file's size before accepting it
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!picked) return;
    if (picked?.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File is too large (max ${MAX_FILE_MB}MB)`);
      return;
    }
    setFile(picked);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing) return;

    if (isEditing) {
      handleUpdate();
    } else {
      handleSend();
    }
  };

  // attachment above the input: a freshly picked file, or the original one while editing
  const showPickedFile = !!file;
  const showOriginalAttachment =
    isEditing && !file && !attachmentRemoved && !!editingMessage?.attachment;

  return (
    <div className='flex flex-col gap-2 border-t border-base-300 bg-base-100 px-4 py-3'>
      {/** Edit warning banner */}
      {isEditing && (
        <div className='flex items-center justify-between rounded-md bg-yellow-600/20 px-2 py-1 text-xs'>
          <span className='flex items-center gap-2 text-yellow-200/90'>
            <FontAwesomeIcon icon={faPenToSquare} />
            Updating message...
          </span>
          <button
            type='button'
            aria-label='cancel edit'
            className='btn btn-ghost btn-xs btn-circle'
            onClick={handleCancelEdit}
          >
            <FontAwesomeIcon icon={faXmarkCircle} />
          </button>
        </div>
      )}

      {/** attachment preview (own row so it never squeezes the input) */}
      {(showPickedFile || showOriginalAttachment) && (
        <div className='relative flex w-fit max-w-full items-center gap-2 rounded-lg bg-base-200 p-2 pr-8'>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt='preview'
              className='h-20 w-20 rounded-lg object-cover'
            />
          ) : showOriginalAttachment &&
            editingMessage?.attachment?.type === "image" ? (
            <img
              src={editingMessage.attachment.url}
              alt='attachment'
              className='h-20 w-20 rounded-lg object-cover'
            />
          ) : (
            <>
              <FontAwesomeIcon icon={faFile} />
              <span className='max-w-60 truncate text-sm'>
                {showPickedFile
                  ? file?.name
                  : editingMessage?.attachment?.fileName}
              </span>
            </>
          )}
          {/** X removes a picked file, or marks the original attachment for removal */}
          <button
            type='button'
            aria-label='remove attachment'
            className='btn btn-circle btn-xs btn-error absolute top-1 right-1'
            onClick={() =>
              showPickedFile ? setFile(null) : removeEditingAttachment()
            }
          >
            <FontAwesomeIcon icon={faXmarkCircle} />
          </button>
        </div>
      )}

      <div className='flex flex-1 items-center gap-2'>
        <input
          type='text'
          id='message'
          aria-label='message'
          ref={inputRef}
          className='input-bordered input input-sm flex-1'
          value={content}
          placeholder={isEditing ? "Edit message..." : "Type a message..."}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          autoComplete='off'
        />
        <input
          type='file'
          id='file'
          aria-label='attachment'
          className='hidden'
          ref={fileRef}
          accept='image/*,video/*,audio/*,application/pdf,.doc,.docx'
          onChange={handleFile}
        />
        <button
          type='button'
          aria-label='upload'
          className='btn btn-ghost btn-sm btn-square bg-gray-500'
          onClick={() => fileRef.current?.click()}
        >
          <FontAwesomeIcon icon={faUpload} />
        </button>
        <button
          type='button'
          onClick={isEditing ? handleUpdate : handleSend}
          className='btn btn-sm bg-blue-900 hover:bg-primary'
          disabled={
            isPending ||
            (!content.trim() &&
              !file &&
              (!isEditing || attachmentRemoved || !editingMessage?.attachment))
          }
        >
          {isPending ? (
            <span
              className='loading loading-xs loading-spinner'
              aria-label='spinner'
            />
          ) : isEditing ? (
            "Update"
          ) : (
            "Send"
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
