import { useState, useEffect, useRef, type SubmitEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLoginUserMutation } from '../features/auth/api/authApi';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const navigate = useNavigate();

  const [loginUser, { isLoading, isError, error, isSuccess }] =
    useLoginUserMutation();
  // focus on email input after loading
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isSuccess) {
      navigate('/');
    }
  }, [isSuccess, navigate]);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    try {
      const data = await loginUser({ email, password }).unwrap();
      toast.success(data.message);
    } catch (error) {
      console.error('Failed to login', error);
    }
  };

  // extract error message from RTK query error
  const errorMessage =
    (error as any)?.data?.message || 'something went wrong. try again.';

  return (
    <>
      <main
        className="flex min-h-screen items-center justify-center
            bg-[linear-gradient(68deg,#ff0081,black)]"
      >
        <div className="card w-96 bg-fuchsia-900 shadow-xl">
          <div className="card-body">
            <h2 className="mb-4 card-title text-2xl font-bold">Login</h2>
            {/** error alert */}
            {isError && (
              <div className="alert alert-error">
                <span>{errorMessage}</span>
              </div>
            )}
            <form id="submit-form" onSubmit={handleSubmit}>
              <div className="form-control mb-3">
                <label htmlFor="email" className="label-text">
                  Email
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="example@gmail.com"
                  className={`input input-bordered ${isError ? 'input-error' : ''}`}
                  id="email"
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  value={email}
                  required
                  autoComplete="on"
                />
              </div>
              <div className="form-control mb-6">
                <label htmlFor="password" className="label-text">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="************"
                  className={`input input-bordered ${isError ? 'input-error' : ''}`}
                  id="password"
                  name="password"
                  onChange={(e) => setPassword(e.target.value)}
                  value={password}
                  required
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className="btn w-full btn-primary"
                disabled={isLoading || !email || !password}
              >
                {isLoading ? (
                  <span className="loading loading-sm loading-spinner"></span>
                ) : (
                  'Login'
                )}
              </button>
            </form>
            <p className="mt-4 text-center text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="link link-primary">
                Signup
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
