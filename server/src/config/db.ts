import mongoose from 'mongoose';

export const connectDB = async (uri: string) => {
  try {
    await mongoose.connect(uri);
    console.log('mongo db is connected');
  } catch (error) {
    console.error(error);
    process.exit(1); // 1 status code means fails, 0 means success
  }
};
