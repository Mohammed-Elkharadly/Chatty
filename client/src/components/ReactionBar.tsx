import type { Reaction } from "../features/messages/message.types";

const ReactionBar = ({ reactions }: { reactions: Reaction[] }) => {
  if (!reactions.length) return null;

  // tallies count per emoji so multiple same-emoji reactions collapse into one badge
  const counts = reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className='flex flex-wrap select-none gap-1 rounded-full border border-gray-700 bg-gray-800/90 px-1.5 py-0.5 text-xs shadow-sm backdrop-blur-sm'>
      {Object.entries(counts).map(([emoji, count]) => (
        <span key={emoji} className='flex items-center gap-0.5 leading-none'>
          <span>{emoji}</span>
          {count > 1 && (
            <span className='text-[10px] text-gray-300 font-medium'>
              {count}
            </span>
          )}
        </span>
      ))}
    </div>
  );
};

export default ReactionBar;
