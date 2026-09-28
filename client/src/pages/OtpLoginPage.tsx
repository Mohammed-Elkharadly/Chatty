import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  useSendOtpMutation,
  useVerifyOtpMutation,
} from "../features/auth/authEndpoints";
import type { ApiError } from "../app/middleware/rtkQueryErrorMiddlewarw";
import toast from "react-hot-toast";

export const OtpLoginPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [
    sendOtp,
    { isLoading: isSending, isError: isSendError, error: sendError },
  ] = useSendOtpMutation();
  const [
    verifyOtp,
    { isLoading: isVerifying, isError: isVerifyError, error: verifyError },
  ] = useVerifyOtpMutation();

  const handleSendOtp = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { message } = await sendOtp({ email }).unwrap();
      toast.success(message);
      setStep("otp");
    } catch (error) {
      console.error("failed to send OTP", error);
    }
  };
  const handleVerifyOtp = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { message } = await verifyOtp({ email, otp }).unwrap();
      toast.success(message);
      navigate("/");
    } catch (error) {
      console.error("failed to verify OTP", error);
    }
  };

  const sendErrorMessage =
    (sendError as ApiError | undefined)?.data?.message ||
    "Something went wrong.";
  const verifyErrorMessage =
    (verifyError as ApiError | undefined)?.data?.message ||
    "Invalid or expired code.";

  return (
    <main className='flex min-h-screen items-center justify-center bg-slate-900'>
      <div className='card w-96 bg-blue-900/25 shadow-xl'>
        <div className='card-body'>
          <h2 className='mb-4 card-title text-2xl font-bold'>
            Sign in with Code
          </h2>

          {step === "email" ? (
            <>
              {isSendError && (
                <div className='alert alert-error mb-3'>
                  <span>{sendErrorMessage}</span>
                </div>
              )}
              <form onSubmit={handleSendOtp}>
                <div className='form-control mb-6'>
                  <label htmlFor='email' className='label-text'>
                    Email
                  </label>
                  <input
                    type='email'
                    id='email'
                    className='input input-bordered w-full mt-3'
                    placeholder='example@gmail.com'
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setEmail(e.target.value)
                    }
                    required
                    autoComplete='email'
                  />
                </div>
                <button
                  type='submit'
                  className='btn w-full btn-primary'
                  disabled={isSending || !email}
                >
                  {isSending ? (
                    <span className='loading loading-sm loading-spinner' />
                  ) : (
                    "Send Code"
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              {isVerifyError && (
                <div className='alert alert-error mb-3'>
                  <span>{verifyErrorMessage}</span>
                </div>
              )}
              <p className='text-sm mb-3'>Code sent to {email}</p>
              <form onSubmit={handleVerifyOtp}>
                <div className='form-control mb-6'>
                  <label htmlFor='otp' className='label-text'>
                    6-digit code
                  </label>
                  <input
                    type='text'
                    id='otp'
                    className='input input-bordered w-full mt-3'
                    placeholder='123456'
                    value={otp}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setOtp(e.target.value)
                    }
                    maxLength={6}
                    required
                    autoComplete='one-time-code'
                  />
                </div>
                <button
                  type='submit'
                  className='btn w-full btn-primary'
                  disabled={isVerifying || otp.length < 6}
                >
                  {isVerifying ? (
                    <span className='loading loading-sm loading-spinner' />
                  ) : (
                    "Verify"
                  )}
                </button>
              </form>
              <button
                type='button'
                className='link link-hover text-xs mt-3'
                onClick={() => setStep("email")}
              >
                Use a different email
              </button>
            </>
          )}

          <p className='mt-4 text-center text-md'>
            <Link to='/login' className='link link-primary'>
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
};
