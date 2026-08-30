import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import SettingsModal from './SettingsModal';
interface SidebarFooterProps {
  isOpen: boolean;
  isLoggingOut: boolean;
  handleLogout: () => void;
}

const SidebarFooter = ({
  isOpen,
  isLoggingOut,
  handleLogout,
}: SidebarFooterProps) => {
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const content = (
    <>
      <div className="border-t border-base-300 p-3 flex flex-col gap-2">
        <button
          type="button"
          aria-label="settings"
          onClick={() => setIsSettingOpen(true)}
          className="btn btn-ghost btn-sm justify-start gap-3 w-full hover:bg-fuchsia-900"
        >
          <FontAwesomeIcon icon={faGear} size="lg" />
          {isOpen && <span>Settings</span>}
        </button>
        <button
          type="button"
          aria-label="logout"
          className="btn btn-ghost btn-sm justify-start gap-3 w-full text-error hover:bg-fuchsia-900"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <FontAwesomeIcon icon={faRightFromBracket} size="lg" />
          )}
          {isOpen && <span>Logout</span>}
        </button>
      </div>
      <SettingsModal
        isOpen={isSettingOpen}
        onClose={() => setIsSettingOpen(false)}
      />
    </>
  );
  return content;
};

export default SidebarFooter;
