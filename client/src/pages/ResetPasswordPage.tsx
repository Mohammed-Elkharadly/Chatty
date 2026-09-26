import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useResetPasswordMutation } from "../features/auth/authEndpoints";
import type { ApiError } from "../app/middleware/rtkQueryErrorMiddlewarw";
import toast from "react-hot-toast";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  // backend redirects here as: `${CLIENT_URL}/reset-password?token=...`
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [resetPassword, { isLoading, isError, error }] = useResetPasswordMutation();

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const data = await resetPassword({ token, password }).unwrap();
      toast.success(data.message);
      navigate("/login");
    } catch (error) {
      console.error("reset password failed", error);
    }
  };

  const errorMessage =
    (error as ApiError | undefined)?.data?.message || "Something went wrong.";

  if (!token) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-[linear-gradient(68deg,#ff0081,black)]'>
        <div className='card w-96 bg-fuchsia-900 shadow-xl'>
          <div className='card-body'>
            <h2 className='card-title text-2xl font-bold mb-4'>Invalid Link</h2>
            <p className='text-sm mb-4'>This reset link is missing its token.</p>
            <Link to='/forgot-password' className='link link-primary'>
              Request a new one
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className='flex min-h-screen items-center justify-center bg-[linear-gradient(68deg,#ff0081,black)]'>
      <div className='card w-96 bg-fuchsia-900 shadow-xl'>
        <div className='card-body'>
          <h2 className='mb-4 card-title text-2xl font-bold'>Reset Password</h2>

          {isError && (
            <div className='alert alert-error mb-3'>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className='form-control mb-6'>
              <label htmlFor='password' className='label-text'>
                New Password
              </label>
              <input
                type='password'
                id='password'
                className={`input input-bordered ${isError ? "input-error" : ""}`}
                placeholder='************'
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                autoComplete='new-password'
              />
              <span className='text-xs opacity-60 mt-1'>
                8+ chars, upper, lower, number, special character
              </span>
            </div>
            <button type='submit' className='btn w-full btn-primary' disabled={isLoading || !password}>
              {isLoading ? <span className='loading loading-sm loading-spinner' /> : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};

export default ResetPasswordPage;