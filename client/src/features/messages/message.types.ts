export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content?: string;
  image?: string;
  status: 'sent' | 'delivered' | 'seen';
  createdAt: string | Date;
  updatedAt: string | Date;
}
