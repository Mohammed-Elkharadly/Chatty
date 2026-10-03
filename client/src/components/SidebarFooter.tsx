import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useSidebar } from "../contexts/sidebar/useSidebar";


const SidebarFooter = () => {
  const { isOpen, isLoggingOut, handleLogout } = useSidebar();
  return (
    <>
      <div className='border-t border-amber-50 p-3 flex flex-col gap-2'>
        <Link
          to='/settings'
          aria-label='settings'
          className='btn btn-ghost btn-sm justify-start gap-3 w-full hover:bg-blue-900'
        >
          <FontAwesomeIcon icon={faGear} size='lg' />
          {isOpen && <span>Settings</span>}
        </Link>
        <button
          type='button'
          aria-label='logout'
          className='btn btn-ghost btn-sm justify-start gap-3 w-full text-error hover:bg-red-600/25'
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
