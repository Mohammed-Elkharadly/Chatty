import { createWelcomeEmailTemplate } from './welcomeTemplate.js';
import { verifyEmailTemplate } from './verificationTemplate.js';
import { forgotPasswordTemplate } from './forgotPassTemplate.js'
import { otpTemplate } from './otpTemplate.js'
import { resend, sender } from '../config/resend.js';
import { CustomError } from '../utils/customError.js';
import { StatusCodes } from 'http-status-codes';

// sends a welcome email to a newly registered user (contains a link to the app)
export const welcomeEmail = async (
  name: string,     // user's name (for personalization in the email body)
  email: string,    // recipient address
  clientUrl: string, // frontend URL (used for the "Open App" button in the email)
) => {
  // call Resend's API to send the email
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`, // sender identity (from config)
    to: [email],
    subject: 'Welcome to Chatty', 
    html: createWelcomeEmailTemplate(name, clientUrl), // generate the HTML body
  });
  // if Resend returned an error (rate limit, invalid address, etc.)
  if (error) {
    console.log(error);
    throw new CustomError('Failed to send welcome email', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  console.log(data);
  return data;
};

// sends an email with a verification link (user clicks it to confirm their email)
export const verificationEmail = async (
  name: string,
  email: string,
  verificationToken: string, // the raw token (goes into the link URL)
  serverUrl: string,         // backend URL (the link points to /api/auth/verify-email/:token)
) => {
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: [email],
    subject: 'Verify your email by clicking the button below',
    html: verifyEmailTemplate(name, verificationToken, serverUrl),
  });
  if (error) {
    console.log(error);
    throw new CustomError('Failed to send verification email', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  console.log(data);
  return data;
};

// sends an email with a password reset link (user clicks it to set a new password)
export const forgotPasswordEmail = async (
  name: string,
  email: string,
  resetToken: string, // the raw token (goes into the link URL)
  url: string,        // frontend URL (redirects to /reset-password?token=...)
) => {
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: [email],
    subject: 'Reset your password by clicking the button below',
    html: forgotPasswordTemplate(name, resetToken, url),
  });
  if (error) {
    console.log(error);
    throw new CustomError('Failed to send reset password email', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  console.log(data);
  return data;
};

// sends an email containing a 6-digit OTP code (user types it into the app)
export const sendOtpEmail = async (
  name: string,
  email: string,
  otp: string, // the 6-digit code (e.g. "482916")
) => {
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: [email],
    subject: 'You can copy and paste the code',
    html: otpTemplate(name, otp),
  });
  if (error) {
    console.log(error);
    throw new CustomError('Failed to send OTP email', StatusCodes.INTERNAL_SERVER_ERROR);
  }
  console.log(data);
  return data;
};   