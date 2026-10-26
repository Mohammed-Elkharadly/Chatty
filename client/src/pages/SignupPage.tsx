import { useState, useEffect, useRef } from "react";
import type { SubmitEvent, ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { SignupData } from "../features/auth/auth.types";
import { useSignupUserMutation } from "../features/auth/authEndpoints";
import GoogleAuthButton from "../utils/components/GoogleAuthButton";
import type { ApiError } from "../app/middleware/rtkQueryErrorMiddleware";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import { faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const validationRegex = {
  name: /^[a-zA-Z]+(?:[ '-][a-zA-Z]+)*$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,}$/,
};

const initialSignupForm: SignupData = {
  name: "",
  email: "",
  password: "",
};

const SignupPage = () => {
  const [show, setShow] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<SignupData>(initialSignupForm);

  const [signupUser, { isLoading, isError, error }] = useSignupUserMutation();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await signupUser(formData).unwrap();
      navigate("/");
    } catch (error) {
      console.error("Failed to signup", error);
    }
  };

  const errorMessage =
    (error as ApiError | undefined)?.data?.message ??
    "Something went wrong. Try again.";

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <span className='loading m-auto loading-xl loading-spinner text-center'></span>
      </div>
    );
  }

  const isNameValid = validationRegex.name.test(formData.name.trim());
  const isEmailValid = validationRegex.email.test(formData.email);
  const isPasswordValid = validationRegex.password.test(formData.password);

  const isFormIncomplete =
    !isNameValid ||
    !isEmailValid ||
    !isPasswordValid ||
    !confirmPassword ||
    formData.password !== confirmPassword;

  return (
    <main className='flex min-h-screen items-center justify-center bg-slate-900'>
      <div className='flex justify-center items-stretch w-full max-w-4xl rounded-lg overflow-hidden'>
        <div className='w-90 bg-[#1e1584] rounded-lg lg:rounded-r-none'>
          <div className='flex flex-auto flex-col gap-2 p-4 '>
            <div className='flex items-center justify-between'>
              <h2 className='mb-4 text-2xl font-bold'>Signup</h2>
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
                <label htmlFor='name' className='label-text'>
                  Name
                </label>
                <input
                  ref={nameRef}
                  type='text'
                  placeholder='John Deo'
                  className={`input w-full input-bordered mt-2 ${isError ? "input-error" : ""}`}
                  id='name'
                  name='name'
                  onChange={handleChange}
                  value={formData.name}
                  required
                  autoComplete='on'
                />
                {touched.name && !isNameValid && (
                  <p className='text-error text-sm mt-2'>
                    Enter a valid name using letters, spaces, apostrophes, or
                    hyphens.
                  </p>
                )}
              </div>
              <div className='form-control mb-3'>
                <label htmlFor='email' className='label-text'>
                  Email
                </label>
                <input
                  type='email'
                  placeholder='example@gmail.com'
                  className={`input w-full input-bordered mt-2 ${isError ? "input-error" : ""}`}
                  id='email'
                  name='email'
                  onChange={handleChange}
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
                  className={`input w-full input-bordered mt-2 ${isError ? "input-error" : ""}`}
                  id='password'
                  name='password'
                  onChange={handleChange}
                  value={formData.password}
                  required
                  autoComplete='off'
                />
                {touched.password && !isPasswordValid && (
                  <p className='text-error text-sm mt-1'>
                    Use 8+ characters with uppercase, lowercase, number, and
                    special character.
                  </p>
                )}
              </div>
              <div className='form-control mb-6 relative'>
                <button
                  type='button'
                  title={
                    showConfirmPassword ? "hide password" : "show password"
                  }
                  className='absolute top-10 right-2.5 cursor-pointer z-10'
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  <FontAwesomeIcon
                    icon={showConfirmPassword ? faEye : faEyeSlash}
                  />
                </button>
                <label htmlFor='confirmPassword' className='label-text'>
                  Confirm Password
                </label>

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id='confirmPassword'
                  name='confirmPassword'
                  placeholder='Confirm password'
                  className='input w-full input-bordered mt-2'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                {confirmPassword && confirmPassword !== formData.password && (
                  <p className='text-error text-sm mt-3'>
                    Passwords do not match.
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
                  "Signup"
                )}
              </button>
            </form>
            <GoogleAuthButton />
            <p className='mt-2 text-center text-md'>
              Already have an account? 
              <Link to='/login' className='link link-primary ml-2'>
                Login
              </Link>
            </p>
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
  );
};

export default SignupPage;
