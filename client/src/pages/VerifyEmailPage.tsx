import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useResendVerificationMutation } from "../features/auth/authEndpoints";
import toast from "react-hot-toast";

const VerifyEmailPage = () => {
  const { status } = useParams<{ status: "success" | "error" }>();
  const isSuccess = status === "success";

  const [email, setEmail] = useState("");
  const [resendVerification, { isLoading }] = useResendVerificationMutation();

  const handleResend = async () => {
    if (!email) return;
    try {
      const data = await resendVerification({ email }).unwrap();
      toast.success(data.message);
    } catch (error) {
      console.error("resend verification failed", error);
    }
  };

  return (
    <main className='flex min-h-screen items-center justify-center bg-[linear-gradient(68deg,#ff0081,black)]'>
      <div className='card w-96 bg-fuchsia-900 shadow-xl'>
        <div className='card-body'>
          {isSuccess ? (
            <>
              <h2 className='card-title text-2xl font-bold mb-4'>Email Verified ✅</h2>
              <p className='text-sm mb-4'>You're all set. You can log in now.</p>
              <Link to='/login' className='btn btn-primary w-full'>
                Go to Login
              </Link>
            </>
          ) : (
            <>
              <h2 className='card-title text-2xl font-bold mb-4'>Verification Failed</h2>
              <p className='text-sm mb-4'>
                This link is invalid or expired. Enter your email to get a new one.
              </p>
              <div className='form-control mb-4'>
                <input
                  type='email'
                  className='input input-bordered'
                  placeholder='example@gmail.com'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                type='button'
                className='btn btn-primary w-full'
                onClick={handleResend}
                disabled={isLoading || !email}
              >
                {isLoading ? <span className='loading loading-sm loading-spinner' /> : "Resend Email"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default VerifyEmailPage;