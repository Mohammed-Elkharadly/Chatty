import type { Reaction } from "../features/messages/message.types";

const ReactionBar = ({ reactions }: { reactions: Reaction[] }) => {
  if (!reactions.length) return null;

  // tallies count per emoji so multiple same-emoji reactions collapse into one badge
  const counts = reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className='flex flex-wrap gap-1 bg-gray-800/90 border border-gray-700 backdrop-blur-sm px-1.5 py-0.5 rounded-full shadow-sm text-xs select-none'>
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
