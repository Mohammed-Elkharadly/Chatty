import { useState, useEffect, useRef, type SubmitEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSignupUserMutation } from '../features/auth/api/authApi';

const SignupPage = () => {
  const nameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [signupUser, { isLoading, isError, error }] = useSignupUserMutation();

  // Focus on name input on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    try {
      await signupUser({ name, email, password }).unwrap();
      navigate('/');
    } catch (error) {
      console.error('Failed to signup', error);
    }
  };

  const errorMessage =
    (error as any)?.data?.message || 'something went wrong. try again.';

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading m-auto loading-xl loading-spinner text-center"></span>
      </div>
    );
  }

  return (
    <>
      <main
        className="flex min-h-screen items-center justify-center
            bg-[linear-gradient(68deg,black,#ff0081)]"
      >
        <div className="card w-96 bg-fuchsia-900 shadow-xl">
          <div className="card-body">
            <h2 className="mb-4 card-title text-2xl font-bold">Signup</h2>
            {/** error alert */}
            {isError && (
              <div className="alert alert-error">
                <span>{errorMessage}</span>
              </div>
            )}
            <form id="submit-form" onSubmit={handleSubmit}>
              <div className="form-control mb-3">
                <label htmlFor="name" className="label-text">
                  Name
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="John Deo"
                  className={`input input-bordered ${isError ? 'input-error' : ''}`}
                  id="name"
                  name="name"
                  onChange={(e) => setName(e.target.value)}
                  value={name}
                  required
                  autoComplete="on"
                />
              </div>
              <div className="form-control mb-3">
                <label htmlFor="email" className="label-text">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="example@gmail.com"
                  className={`input input-borderd ${isError ? 'input-error' : ''}`}
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
                  className={`input input-borderd ${isError ? 'input-error' : ''}`}
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
                disabled={isLoading || !name || !email || !password}
              >
                {isLoading ? (
                  <span className="loading loading-sm loading-spinner"></span>
                ) : (
                  'Signup'
                )}
              </button>
            </form>
            <p className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <Link to="/login" className="link link-primary">
                Login
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
};

export default SignupPage;
