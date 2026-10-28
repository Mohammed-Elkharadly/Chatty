import { useEffect } from "react";
import { getFcmToken } from "../lib/firebase";
import { useSaveFcmTokenMutation } from "../features/users/usersEndpoints";
import { setSocketFcmToken } from "../lib/socket";

const usePushNotifications = () => {
  const [saveFcmToken] = useSaveFcmTokenMutation();

  useEffect(() => {
    getFcmToken()
      .then(async (fcmToken) => {
        if (fcmToken) {
          await saveFcmToken({ fcmToken }).unwrap();
          setSocketFcmToken(fcmToken);
        }
      })
      .catch((error) => console.error("faild to push notification", error));
  }, [saveFcmToken]);
};

export default usePushNotifications;
