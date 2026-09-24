import { GoogleLogin } from "@react-oauth/google";
import { useOAuthLoginMutation } from "../features/auth/authEndpoints";
import { useNavigate } from "react-router-dom";

const GoogleAuthButton = () => {
  const navigate = useNavigate();
  const [oAuthLogin] = useOAuthLoginMutation();

  return (
    <div className='w-full flex justify-center'>
      <GoogleLogin
        width='100%'
        size='large'
        text='continue_with'
        shape='pill'
        theme='outline'
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse.credential) return;
          try {
            await oAuthLogin({
              provider: "google",
              idToken: credentialResponse.credential,
            }).unwrap();
            navigate("/");
          } catch (error) {
            console.error("failed to login", error);
          }
        }}
        onError={() => console.error("failed login with google")}
      />
    </div>
  );
};

export default GoogleAuthButton;
