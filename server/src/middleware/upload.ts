import multer from "multer";
import { CustomError } from "../utils/customError.js";
import { StatusCodes } from "http-status-codes";

// whitelist of allowed MIME types grouped by category
export const ALLOWED_MIME_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"], 
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm"], 
  pdf: ["application/pdf"],
  document: [
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  ],
};

// extracts the keys of ALLOWED_MIME_TYPES as a union type: "image" | "video" | "audio" | "pdf" | "document"
export type AttachmentType = keyof typeof ALLOWED_MIME_TYPES;

// takes a MIME type string, returns which category it belongs to (or null if not allowed)
export const getAttachmentType = (mimeType: string): AttachmentType | null => {
  // loop through each category and its list of allowed MIME types
  for (const [type, mimeTypes] of Object.entries(ALLOWED_MIME_TYPES)) {
    // if this MIME type is in the list → return the category name
    if ((mimeTypes as readonly string[]).includes(mimeType)) {
      return type as AttachmentType;
    }
  }
  // not found in any category → not allowed
  return null;
};

// store the file in memory (RAM) as a Buffer — never touches disk, we stream it to Cloudinary immediately
const storage = multer.memoryStorage();

// runs for each uploaded file BEFORE it's accepted — rejects disallowed types
const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  // check if this file's MIME type is in our whitelist
  const type = getAttachmentType(file.mimetype);
  // if not recognized → reject with a 400 error
  if (!type) {
    cb(
      new CustomError(
        `unsupported mime type: ${file.mimetype}`,
        StatusCodes.BAD_REQUEST,
      ),
    );
    return;
  }
  // allowed → tell Multer to accept the file
  cb(null, true);
};

// the Multer instance your routes will use as middleware (e.g. upload.single("file"))
export const upload = multer({
  storage, // use memory storage
  fileFilter, // reject disallowed MIME types
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max per file (matches Cloudinary free tier image limit)
  },
});   