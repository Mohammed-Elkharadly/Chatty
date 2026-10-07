import { useState, useRef, useEffect } from "react";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFaceSmile } from "@fortawesome/free-solid-svg-icons";
import { useReactToMessageMutation } from "../features/messages/messageEndpoints";

interface Props {
  messageId: string;
  isMe: boolean;
}
const ReactionPicker = ({ messageId, isMe }: Props) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const [reactToMessage] = useReactToMessageMutation();

  const popularEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const handlePick = async (data: EmojiClickData) => {
    setOpen(false);
    setShowAll(false);
    try {
      await reactToMessage({ messageId, emoji: data.emoji }).unwrap();
    } catch (error) {
      console.error("Failed to react", error);
    }
  };

  const handleOpen = () => {
    setOpen((o) => {
      if (o) setShowAll(false);
      return !o;
    });
  };

  useEffect(() => {
    const handleClickOutSide = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowAll(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutSide);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutSide);
    };
  }, [open]);

  return (
    <div ref={menuRef} className='relative inline-block'>
      <button
        type='button'
        aria-label='react'
        className='p-1 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer'
        onClick={handleOpen}
      >
        <FontAwesomeIcon icon={faFaceSmile} />
      </button>

      {open && (
        <div className={`absolute z-50 mb-2 ${isMe ? "right-0" : "left-0"}`}>
          {!showAll ? (
            <div className='flex items-center gap-1 rounded-full bg-gray-800 border border-gray-700 p-1.5 shadow-xl'>
              {popularEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type='button'
                  className='text-lg hover:scale-125 transition-transform p-1'
                  onClick={() => handlePick({ emoji } as EmojiClickData)}
                >
                  {emoji}
                </button>
              ))}

              <button
                type='button'
                className='flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-sm font-semibold hover:bg-gray-600 text-gray-200'
                onClick={() => setShowAll(true)}
                aria-label='show all emojis'
              >
                +
              </button>
            </div>
          ) : (
            <div className='shadow-2xl rounded-lg overflow-hidden border border-gray-700'>
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={handlePick}
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
      )}
    </div>
  );
};

export default ReactionPicker;
