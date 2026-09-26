import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { Link } from "react-router-dom";
import { useForgotPasswordMutation } from "../features/auth/authEndpoints";
import toast from "react-hot-toast";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { message } = await forgotPassword({ email }).unwrap();
      toast.success(message);
      setSent(true)
    } catch (error) {
      console.error("forgot password fialed", error);
    }
  };

  return (
    <main className='flex min-h-screen items-center justify-center bg-[linear-gradient(68deg,#ff0081,black)]'>
      <div className='card w-96 bg-fuchsia-900 shadow-xl'>
        <div className='card-body'>
          <h2 className='mb-4 card-title text-2xl font-bold'>
            Forgot Password
          </h2>

          {sent ? (
            <p className='text-sm'>
              If an account exists for that email, a reset link is on its way.
              Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className='form-control mb-6'>
                <label htmlFor='email' className='label-text'>
                  Email
                </label>
                <input
                  type='email'
                  id='email'
                  name='email'
                  className='input input-bordered'
                  placeholder='example@gmail.com'
                  value={email}
                  onChange={handleChange}
                  required
                  autoComplete='email'
                />
              </div>
              <button
                type='submit'
                className='btn w-full btn-primary'
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <span className='loading loading-sm loading-spinner' />
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          )}

          <p className='mt-4 text-center text-sm'>
            <Link to='/login' className='link link-primary'>
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default ForgotPasswordPage;
