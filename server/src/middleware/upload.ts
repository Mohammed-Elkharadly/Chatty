import multer from "multer";
import { CustomError } from "../utils/customError.js";
import { StatusCodes } from "http-status-codes";

export const ALLOWED_MIME_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/video"],
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/oog", "aduio/webm"],
  pdf: ["application/pdf"],
  document: [
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  ],
};

// it creates a union type of ALLOWED_MIME_TYPES. "image" | "video" | "audio" | "pdf" | "document"
export type AttachmentType = keyof typeof ALLOWED_MIME_TYPES;

// Reverse lookup: given a mimetype, which category does it belong to?
export const getAttachmentType = (mimeType: string): AttachmentType | null => {
  // "image" | "video" | "audio" | "pdf" | "document" | null
  for (const [type, mimeTypes] of Object.entries(ALLOWED_MIME_TYPES)) {
    if ((mimeTypes as readonly string[]).includes(mimeType)) {
      return type as AttachmentType;
    }
  }
  return null;
};

// memory storage: file lives as a buffer in RAM only long enough to
// stream it to Cloudinary — never written to disk, nothing to clean up
const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  const type = getAttachmentType(file.mimetype);
  if (!type) {
    cb(
      new CustomError(
        `unsupported mime type: ${file.mimetype}`,
        StatusCodes.BAD_REQUEST,
      ),
    );
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB app-level cap — Cloudinary's free
  },
});
