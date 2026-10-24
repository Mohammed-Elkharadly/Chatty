
import { formatDistanceToNow } from "date-fns";

interface LastSeenDate {
  lastSeenDate: string;
}

export const RelativeTimeDisplay = ({ lastSeenDate }: LastSeenDate) => {
  return (
    <span>
      {formatDistanceToNow(new Date(lastSeenDate), { addSuffix: true })}
    </span>
  );
};
