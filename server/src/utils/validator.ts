import { CustomError } from './customError.js';
import { StatusCodes } from 'http-status-codes';
import type { UserDocument } from '../models/User.js';

export class Validator {
  private static readonly emailRegEx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
  private static readonly passRegEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/; 
  private static readonly phoneRegEx = /^\+?[1-9]\d{7,14}$/
  // signup check
  static validateSignup(name: string, email: string, password: string, phone: string) {
    // check if all credentials is provided
    if (!name || !email || !password || !phone) {
      throw new CustomError('All fields are required', StatusCodes.BAD_REQUEST);
    }

    // check if the email is valid
    if (!this.emailRegEx.test(email)) {
      throw new CustomError('invalid credentials', StatusCodes.BAD_REQUEST);
    }

    // check if the password is valid
    if (!this.passRegEx.test(password)) {
      throw new CustomError(
        'Must contain uppercase, lowercase, number, and special character.',
        StatusCodes.BAD_REQUEST,
      );
    }
    
    // check if the password is valid
    if (!this.phoneRegEx.test(phone)) {
      throw new CustomError(
        'invalid phone number format',
        StatusCodes.BAD_REQUEST,
      );
    }
  }
  // login check
  static async validateLogin(password: string, user: UserDocument | null) {
    if(!user || !(await user.comparePassword(password))) {
      await user?.incrementLoginAttempts();
      throw new CustomError('invalid email or password', StatusCodes.UNAUTHORIZED);
    }
  }
}
