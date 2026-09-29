export interface Attachment {
  url: string; // Cloudinary url
  type: "image" | "video" | "audio" | "pdf" | "document"; // picks the render
  mimiType: string;
  fileName: string;
  fileSize: number; // bytes
}

export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content?: string;
  attachment?: Attachment;
  status: "sent" | "delivered" | "seen";
  createdAt: string | Date;
  updatedAt: string | Date;
}
