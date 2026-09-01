import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

// options we pass to every upload call
interface UploadOptions {
  folder: string; // which Cloudinary folder to store the file in
  resourceType?: "image" | "video" | "raw" | "auto"; // tells Cloudinary how to handle the file
}

// takes a Buffer (from multer), streams it to Cloudinary, returns the upload result (url, publicId, etc.)
export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  options: UploadOptions,
): Promise<UploadApiResponse> => {
  // wrap the callback-based upload_stream in a Promise so we can await it
  return new Promise((resolve, reject) => {
    // create a writable stream that Cloudinary will write the file into
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        // store under the specified folder
        options: options.folder,
        // "auto" lets Cloudinary detect the type; override if you know it
        resource_type: options.resourceType ?? "auto",
      },
      // fires when upload finishes (success or failure)
      (error, result) => {
        // if there's an error or no result → reject the promise
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        // upload succeeded → resolve with the response (contains secure_url, public_id, etc.)
        resolve(result);
      },
    );
    // convert the Buffer into a readable stream and pipe it into Cloudinary's writable stream
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// removes a file from Cloudinary by its public_id
export const deleteFromCloudinary = async (
  publicId: string, // the unique identifier Cloudinary returns after upload
  resourceType: "image" | "video" | "raw" = "image", // must match the type used during upload
) => {
  // call Cloudinary's destroy API to permanently delete the file
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
