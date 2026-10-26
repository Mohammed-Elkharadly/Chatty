import { useState, useEffect, useRef } from "react";
import type { SubmitEvent, ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLoginUserMutation } from "../features/auth/authEndpoints";
import type { LoginCredentials } from "../features/auth/auth.types";
import type { ApiError } from "../app/middleware/rtkQueryErrorMiddleware";
import GoogleAuthButton from "../utils/components/GoogleAuthButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import { faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const validationRegex = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/,
};

const initialLoginForm: LoginCredentials = {
  email: "",
  password: "",
};

const LoginPage = () => {
  const [show, setShow] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<LoginCredentials>(initialLoginForm);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await loginUser(formData).unwrap();
    } catch (error) {
      console.error("Failed to login", error);
    }
  };

  const errorMessage =
    (error as ApiError | undefined)?.data?.message ||
    "something went wrong. try again.";

  const isEmailValid = validationRegex.email.test(formData.email);
  const isPasswordValid = validationRegex.password.test(formData.password);

  const isFormIncomplete = !isEmailValid || !isPasswordValid;

  return (
    <>
      <main className='flex min-h-screen items-center justify-center bg-slate-900'>
        <div className='flex justify-center items-stretch w-full max-w-4xl rounded-lg overflow-hidden'>
          <div className='w-90 bg-[#1e1584] rounded-lg lg:rounded-r-none'>
            <div className='flex flex-auto flex-col gap-2 p-4 '>
              <div className='flex items-center justify-between'>
                <h2 className='mb-4 text-2xl font-bold'>Login</h2>
                <p className='w-15 h-15'>
                  <img
                    src='/chatty.png'
                    alt='chatty-image'
                    className='w-full h-full object-cover rounded-2xl animate-bounce'
                  />
                </p>
              </div>
              {/** error alert */}
              {isError && (
                <div className='alert alert-error'>
                  <span>{errorMessage}</span>
                </div>
              )}
              <form className='mb-4' onSubmit={handleSubmit}>
                <div className='form-control mb-3'>
                  <label htmlFor='email' className='label-text'>
                    Email
                  </label>
                  <input
                    ref={emailRef}
                    type='email'
                    placeholder='example@gmail.com'
                    className={`input w-full input-bordered mt-2 ${isError ? "input-error" : ""}`}
                    id='email'
                    name='email'
                    onChange={handleCange}
                    value={formData.email}
                    required
                    autoComplete='on'
                  />
                  {touched.email && !isEmailValid && (
                    <p className='text-error text-sm mt-2'>
                      Enter a valid email address.
                    </p>
                  )}
                </div>
                <div className='form-control mb-6 relative'>
                  <button
                    type='button'
                    title={show ? "hide password" : "show password"}
                    className='absolute top-10 right-2.5 cursor-pointer z-10'
                    onClick={() => setShow((prev) => !prev)}
                  >
                    <FontAwesomeIcon icon={show ? faEye : faEyeSlash} />
                  </button>
                  <label htmlFor='password' className='label-text'>
                    Password
                  </label>
                  <input
                    type={show ? "text" : "password"}
                    placeholder='************'
                    className={`input  w-full input-bordered mt-2 ${isError ? "input-error" : ""}`}
                    id='password'
                    name='password'
                    onChange={handleCange}
                    value={formData.password}
                    required
                    autoComplete='off'
                  />
                  {touched.password && !isPasswordValid && (
                    <p className='text-error text-sm mt-2'>
                      Use 8+ characters with uppercase, lowercase, number, and
                      special character.
                    </p>
                  )}
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
                <div className='mb-4'>
                  <Link
                    to='/forgot-password'
                    className='link text-white hover:text-black'
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className='mb-4'>
                  <Link
                    to='/otp-login'
                    className='link text-white hover:text-black'
                  >
                    Sign in with a code instead
                  </Link>
                </div>
              </div>
              <GoogleAuthButton />
              <div className='mt-4 text-center text-md'>
                Don't have an account?{" "}
                <Link to='/signup' className='link text-white hover:text-black ml-2'>
                  Signup
                </Link>
              </div>
            </div>
          </div>
          <div className='hidden lg:flex flex-1'>
            <img
              src='/chatty_ background.png'
              alt='chatty-background'
              className='w-full h-full object-cover'
            />
          </div>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
