import { useGoogleLogin } from "@react-oauth/google";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { useOAuthLoginMutation } from "../features/auth/authEndpoints";
import { useNavigate } from "react-router-dom";

const GoogleAuthButton = () => {
  const navigate = useNavigate();
  const [oAuthLogin, { isLoading }] = useOAuthLoginMutation();

  const handleGoogleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) {
      try {
        
      } catch (error) {
        
      }
    },
  })
  return <div>GoogleAuthButton</div>;
};

export default GoogleAuthButton;
