import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useLogoutUserMutation } from "../features/users/usersEndpoints";

const SidebarFooter = ({ isOpen }: { isOpen: boolean }) => {
  const [logoutUser, { isLoading: isLoggingOut }] = useLogoutUserMutation();
  const handleLogout = async () => {
    try {
      await logoutUser().unwrap();
    } catch (error) {
      console.error("failed logging out", error);
    }
  };
  return (
    <>
      <div className='flex flex-col gap-2 border-t border-black p-3'>
        <Link
          to='/settings'
          aria-label='settings'
          className='btn btn-sm w-full justify-start gap-3 hover:bg-blue-900'
        >
          <FontAwesomeIcon icon={faGear} size='lg' />
          {isOpen && <span>Settings</span>}
        </Link>
        <button
          type='button'
          aria-label='logout'
          className='btn btn-sm w-full justify-start gap-3 text-error hover:bg-red-600/25'
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <span className='loading loading-spinner loading-xs'></span>
          ) : (
            <FontAwesomeIcon icon={faRightFromBracket} size='lg' />
          )}
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </>
  );
};

export default SidebarFooter;
