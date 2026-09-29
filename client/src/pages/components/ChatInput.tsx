import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent, ChangeEvent, RefObject } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faXmarkCircle,
  faFile,
} from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";

const MAX_FILE_MB = 10;

interface ChatInputProps {
  content: string;
  file: File | null;
  isSending: boolean;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  onSend: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}
const ChatInput = ({
  content,
  file,
  isSending,
  setContent,
  setFile,
  onSend,
  inputRef,
}: ChatInputProps) => {
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (e.key === "Enter" && !e.nativeEvent.isComposing) onSend();
  };

  return (
    <div className='flex flex-col gap-2 border-t border-base-300 bg-base-100 px-4 py-3 h-24.5'>
      {/** attachment preview (own row so it never squeezes the input) */}
      {file && (
        <div className='relative flex w-fit max-w-full items-center gap-2 rounded-lg bg-base-200 p-2 pr-8'>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt='preview'
              className='h-20 w-20 rounded-lg object-cover'
            />
          ) : (
            <>
              <FontAwesomeIcon icon={faFile} />
              <span className='max-w-60 truncate text-sm'>{file.name}</span>
            </>
          )}
          <button
            type='button'
            aria-label='remove attachment'
            className='btn btn-circle btn-xs btn-error absolute top-1 right-1'
            onClick={() => setFile(null)}
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
          placeholder='Type a message...'
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
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
          onClick={onSend}
          className='btn btn-sm bg-blue-900 hover:bg-primary'
          disabled={isSending || (!content.trim() && !file)}
        >
          {isSending ? (
            <span
              className='loading loading-xs loading-spinner'
              aria-label='spinner'
            />
          ) : (
            "Send"
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
