export interface Attachment {
  url: string; // Cloudinary url
  type: "image" | "video" | "audio" | "pdf" | "document"; // picks the render
  mimeType: string;
  fileName: string;
  fileSize: number; // bytes
  resourceType: "image" | "video" | "raw";
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content?: string;
  attachment?: Attachment;
  reactions: Reaction[];
  status: "sent" | "delivered" | "seen";
  createdAt: string | Date;
  updatedAt: string | Date;
}
