import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilePdf, faFileWord } from "@fortawesome/free-solid-svg-icons";
import type { Attachment } from "../../features/messages/message.types";

// renders one attachment according to its category
const AttachmentView = ({ attachment }: { attachment: Attachment }) => {
  const { type, url, fileName, fileSize } = attachment;

  if (type === "image") {
    return (
      <img
        src={url}
        alt={fileName}
        className='mb-2 mr-2.5 max-h-64 max-w-full cursor-pointer rounded-md'
        onClick={() => window.open(url, "_blank")}
      />
    );
  }
  if (type === "video") {
    return (
      <video
        src={url}
        controls
        className='mb-2 mr-2.5 max-h-64 max-w-full rounded-md'
      />
    );
  }
  if (type === "audio") {
    return <audio src={url} controls className='mb-2 pr-2.5 max-w-full' />;
  }

  // pdf / document: compact download chip
  return (
    <a
      href={url}
      target='_blank'
      rel='noreferrer'
      className='mb-2 mr-2.5 flex items-center gap-2 rounded-md bg-black/20 p-2 hover:bg-black/30'
    >
      <FontAwesomeIcon
        icon={type === "pdf" ? faFilePdf : faFileWord}
        className='text-xl'
      />
      <span className='min-w-0'>
        <span className='block truncate text-sm'>{fileName}</span>
        <span className='text-xs opacity-60'>
          {(fileSize / 1024 / 1024).toFixed(1)} MB
        </span>
      </span>
    </a>
  );
};

export default AttachmentView;
