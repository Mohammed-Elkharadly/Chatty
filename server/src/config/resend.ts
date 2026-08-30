import { ENV } from './env.js';
import { Resend } from 'resend';

export const resend = new Resend(ENV.RESEND_API_KEY);
export const sender = {
  name: ENV.RESEND_FROM,
  email: ENV.RESEND_EMAIL,
};
