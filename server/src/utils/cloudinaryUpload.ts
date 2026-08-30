import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

interface UploadOptions {
  folder: string;
  resourceType?: "image" | "video" | "raw" | "auto";
}

export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  options: UploadOptions,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        options: options.folder,
        resource_type: options.resourceType ?? "auto",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image",
) => {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
