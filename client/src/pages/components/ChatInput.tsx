import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ChangeEvent } from "react";
import { useAppSelector } from "../../app/hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  useSendMessageMutation,
  useUpdateMessageMutation,
} from "../../features/messages/messageEndpoints";
import {
  faUpload,
  faXmarkCircle,
  faFile,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import { faFaceSmile } from "@fortawesome/free-solid-svg-icons";

const MAX_FILE_MB = 10;

interface ChatInputProps {
  editingId: string | null; // which message is being edited, or null for a new message
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
}

const ChatInput = ({ editingId, setEditingId }: ChatInputProps) => {
  const messages = useAppSelector((state) => state.messages.messages);
  const editingMessage = messages.find((msg) => msg._id === editingId) ?? null;

  const [content, setContent] = useState(editingMessage?.content ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);


  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [updateMessage, { isLoading: isUpdating }] = useUpdateMessageMutation();

  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLInputElement>(null);
  const isEditing = editingMessage !== null;
  const isPending = isSending || isUpdating;

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedContact?._id]);

  useEffect(() => {
    const handleClickOutSide = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current?.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    if (emojiOpen) {
      document.addEventListener("mousedown", handleClickOutSide);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutSide);
    };
  }, [emojiOpen]);

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

  const handleEmojiClick = (data: EmojiClickData) => {
    setContent((prevContent) => prevContent + data.emoji);
    inputRef.current?.focus();
    setEmojiOpen(false);
  };

  const handleSend = async () => {
    if ((!content.trim() && !file) || !selectedContact) return;
    const formData = new FormData();
    if (content.trim()) formData.append("content", content);
    if (file) formData.append("attachment", file);
    try {
      await sendMessage({ receiverId: selectedContact._id, formData }).unwrap();
      setContent("");
      setFile(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !selectedContact) return;
    if (!content.trim() && !file) return;

    const formData = new FormData();
    if (content.trim()) formData.append("content", content);
    if (file) formData.append("attachment", file);

    try {
      await updateMessage({ _id: editingId, body: formData }).unwrap();
      setEditingId(null);
      setContent("");
      setFile(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to update message", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setContent("");
    setFile(null);
  };

  const hasPickedFile = !!file;
  const hasOriginalAttachment = !!editingMessage?.attachment;
  const showAttachmentPreview =
    hasPickedFile || (isEditing && hasOriginalAttachment);

  return (
    <div className='flex flex-col gap-2 border-t border-base-300 bg-base-100 px-4 py-3'>
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

      {showAttachmentPreview && (
        <div className='relative flex w-fit max-w-full items-center gap-2 rounded-lg bg-base-200 p-2 pr-8'>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt='preview'
              className='h-20 w-20 rounded-lg object-cover'
            />
          ) : editingMessage?.attachment?.type === "image" ? (
            <img
              src={editingMessage.attachment.url}
              alt='attachment'
              className='h-20 w-20 rounded-lg object-cover'
            />
          ) : (
            <>
              <FontAwesomeIcon icon={faFile} />
              <span className='max-w-60 truncate text-sm'>
                {file ? file?.name : editingMessage?.attachment?.fileName}
              </span>
            </>
          )}
          {file && (
            <button
              type='button'
              aria-label='remove attachment'
              className='btn btn-circle btn-xs btn-error absolute top-1 right-1'
              onClick={() => setFile(null)}
            >
              <FontAwesomeIcon icon={faXmarkCircle} />
            </button>
          )}
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
        <div ref={emojiRef}>
          <button
            type='button'
            aria-label='emoji'
            className='text-2xl text-yellow-500 cursor-pointer'
            onClick={() => setEmojiOpen((open) => !open)}
          >
            <FontAwesomeIcon icon={faFaceSmile} />
          </button>

          {emojiOpen && (
            <div className='absolute right-0 bottom-14 z-50'>
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={handleEmojiClick}
                height={320}
                width={250}
                searchDisabled
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                style={
                  {
                    "--epr-emoji-size": "20px",
                    "--epr-category-label-height": "20px",
                    "--epr-header-padding": "4px",
                  } as React.CSSProperties
                }
              />
            </div>
          )}
        </div>

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
              (!isEditing || !editingMessage?.attachment))
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
