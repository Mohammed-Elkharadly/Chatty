import { useRef } from 'react';
import type { KeyboardEvent, ChangeEvent, RefObject } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faXmarkCircle } from '@fortawesome/free-solid-svg-icons';

interface ChatInputProps {
  content: string;
  image: string | null;
  isSending: boolean;
  setContent: (value: string) => void;
  setImage: (value: string | null) => void;
  onSend: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}
const ChatInput = ({
  content,
  image,
  isSending,
  setContent,
  setImage,
  onSend,
  inputRef,
}: ChatInputProps) => {
  const imageRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSend();
  };

  return (
    <>
      <div className="flex items-center gap-2 border-t border-base-300 bg-base-100 px-4 py-3">
        <label htmlFor="message" aria-label="input message label"></label>
        <input
          type="text"
          id="message"
          ref={inputRef}
          className="input-bordered input input-sm flex-1"
          value={content}
          placeholder="Type a message..."
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          autoComplete="off"
        />
        {/** image preview */}
        {image && (
          <div className="relative w-24">
            <img
              src={image}
              alt="preview"
              className="object-cover w-24 h-24 rounded-lg"
            />
            <button
              className="absolute -top-1 -right-1 btn btn-circle btn-xs btn-error"
              type="button"
              aria-label="close"
              onClick={() => {
                setImage(null);
                if (imageRef.current) imageRef.current.value = '';
              }}
            >
              <FontAwesomeIcon icon={faXmarkCircle} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/** hidden file input */}
          <label htmlFor="file" aria-label="input file"></label>
          <input
            type="file"
            name="file"
            id="file"
            className="hidden"
            ref={imageRef}
            accept="image/*"
            onChange={handleImage}
          />
          <button
            type="button"
            aria-label="upload"
            className="btn btn-ghost btn-sm btn-square bg-gray-500"
            onClick={() => imageRef.current?.click()}
          >
            <FontAwesomeIcon icon={faUpload} />
          </button>
        </div>
        <button
          type="button"
          onClick={onSend}
          className="btn btn-sm bg-fuchsia-900 hover:bg-fuchsia-500"
          disabled={isSending || (!content.trim() && !image)}
        >
          {isSending ? (
            <span
              className="loading loading-xs loading-spinner"
              aria-label="spinner"
            ></span>
          ) : (
            'Send'
          )}
        </button>
      </div>
    </>
  );
};

export default ChatInput;
