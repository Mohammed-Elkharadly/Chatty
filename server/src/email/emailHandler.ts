import { createWelcomeEmailTemplate } from './welcomeTemplate.js';
import { verifyEmailTemplate } from './verificationTemplate.js';
import { forgotPasswordTemplate } from './forgotPassTemplate.js'
import { otpTemplate } from './otpTemplate.js'
import { resend, sender } from '../config/resend.js';
import { CustomError } from '../utils/customError.js';
import { StatusCodes } from 'http-status-codes';

export const welcomeEmail = async (
  name: string,
  email: string,
  clientUrl: string,
) => {
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: [email],
    subject: 'Welcom to Chatty',
    html: createWelcomeEmailTemplate(name, clientUrl),
  });
  if (error) {
    console.log(error);
    
    throw new CustomError(
      'Faild To Send Welcom Email',
      StatusCodes.BAD_REQUEST,
    );
  }
  console.log(data);
  return data;
};

export const verificationEmail = async (
  name: string,
  email: string,
  verificationToken: string,
  serverUrl: string,
) => {
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: [email],
    subject: 'Verify your email by clicking the button below',
    html: verifyEmailTemplate(name, verificationToken, serverUrl),
  });
  if (error) {
    console.log(error);

    throw new CustomError(
      'Faild To Send Verification Email',
      StatusCodes.BAD_REQUEST,
    );
  }
  console.log(data);
  return data;
};

export const forgotPasswordEmail = async (
  name: string,
  email: string,
  resetToken: string,
  url: string,
) => {
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: [email],
    subject: 'Reset your password by clicking the button below',
    html: forgotPasswordTemplate(name, resetToken, url),
  });
  if (error) {
    console.log(error);

    throw new CustomError(
      'Faild To Send Forget password Email',
      StatusCodes.BAD_REQUEST,
    );
  }
  console.log(data);
  return data;
};

export const sendOtpEmail = async (
  name: string,
  email: string,
  otp: string,
) => {
  const { data, error } = await resend.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: [email],
    subject: 'You can copy and paste the code',
    html: otpTemplate(name, otp),
  });
  if (error) {
    console.log(error);

    throw new CustomError(
      'Faild To Send OTP Email',
      StatusCodes.BAD_REQUEST,
    );
  }
  console.log(data);
  return data;
};
