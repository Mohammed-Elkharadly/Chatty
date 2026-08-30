import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./env.js";

// Authentication credentials for Cloudinary API
cloudinary.config({
  // Your account name
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  // Public identifier
  api_key: ENV.CLOUDINARY_API_KEY,
  // Private key (keep secret!)
  api_secret: ENV.CLOUDINARY_API_SECRET,
});

export default cloudinary;