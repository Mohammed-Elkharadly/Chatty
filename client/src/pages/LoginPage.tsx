import { useState, useEffect, useRef } from "react";
import type { SubmitEvent, ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLoginUserMutation } from "../features/auth/authEndpoints";
import toast from "react-hot-toast";
import type { LoginCredentials } from "../features/auth/auth.types";
import type { ApiError } from "../app/middleware/rtkQueryErrorMiddlewarw";
import GoogleAuthButton from "../components/GoogleAuthButton";

const initialLoginForm: LoginCredentials = {
  email: "",
  password: "",
};

const LoginPage = () => {
  const emailRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<LoginCredentials>(initialLoginForm);

  const navigate = useNavigate();

  const [loginUser, { isLoading, isError, error, isSuccess }] =
    useLoginUserMutation();
  // focus on email input after loading
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isSuccess) navigate("/");
  }, [isSuccess, navigate]);

  const handleCange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const data = await loginUser(formData).unwrap();
      toast.success(data.message);
    } catch (error) {
      console.error("Failed to login", error);
    }
  };

  // extract error message from RTK query error
  const errorMessage =
    (error as ApiError | undefined)?.data?.message ||
    "something went wrong. try again.";

  const isFormIncomplete = !formData.email || !formData.password;

  return (
    <>
      <main className='flex min-h-screen items-center justify-center bg-slate-900 rounded-xl'>
        <div className='card w-96  bg-blue-900/25 shadow-xl'>
          <div className='card-body'>
            <h2 className='mb-4 card-title text-2xl font-bold'>Login</h2>
            {/** error alert */}
            {isError && (
              <div className='alert alert-error'>
                <span>{errorMessage}</span>
              </div>
            )}
            <form id='submit-form' onSubmit={handleSubmit}>
              <div className='form-control mb-3'>
                <label htmlFor='email' className='label-text'>
                  Email
                </label>
                <input
                  ref={emailRef}
                  type='email'
                  placeholder='example@gmail.com'
                  className={`input input-bordered mt-2 ${isError ? "input-error" : ""}`}
                  id='email'
                  name='email'
                  onChange={handleCange}
                  value={formData.email}
                  required
                  autoComplete='on'
                />
              </div>
              <div className='form-control mb-6'>
                <label htmlFor='password' className='label-text'>
                  Password
                </label>
                <input
                  type='password'
                  placeholder='************'
                  className={`input input-bordered mt-2 ${isError ? "input-error" : ""}`}
                  id='password'
                  name='password'
                  onChange={handleCange}
                  value={formData.password}
                  required
                  autoComplete='off'
                />
              </div>
              <button
                type='submit'
                className='btn w-full btn-primary'
                disabled={isLoading || isFormIncomplete}
              >
                {isLoading ? (
                  <span className='loading loading-sm loading-spinner'></span>
                ) : (
                  "Login"
                )}
              </button>
            </form>
            <div className='flex items-center justify-between'>
              <div className='my-4'>
                <Link
                  to='/forgot-password'
                  className='link link-hover text-md link-primary'
                >
                  Forgot password?
                </Link>
              </div>
              <div className='my-4'>
                <Link 
                    to='/otp-login' 
                    className='link link-hover text-md link-primary'>
                  Sign in with a code instead
                </Link>
              </div>
            </div>
            <GoogleAuthButton />
            <div className='mt-4 text-center text-md mb-4'>
              Don't have an account?{" "}
              <Link to='/signup' className='link link-primary'>
                Signup
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
