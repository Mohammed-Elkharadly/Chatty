import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useOAuthLoginMutation } from "../../features/auth/authEndpoints";
import { useNavigate } from "react-router-dom";

const GoogleAuthButton = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const [oAuthLogin] = useOAuthLoginMutation();

  return (
    <div className='flex w-full flex-col items-center'>
      <GoogleLogin
        width='320'
        size='large'
        text='continue_with'
        shape='pill'
        theme='outline'
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse.credential) return;
          setErrorMessage("");
          try {
            await oAuthLogin({
              provider: "google",
              idToken: credentialResponse.credential,
            }).unwrap();
            navigate("/");
          } catch (error) {
            console.error("failed to login", error);
            setErrorMessage("Google sign-in failed. Please try again.");
          }
        }}
        onError={() =>
          setErrorMessage("Google sign-in failed. Please try again.")
        }
      />
      {errorMessage && (
        <p role='alert' className='mt-2 text-sm text-error'>
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default GoogleAuthButton;
