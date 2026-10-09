import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faAngleLeft } from "@fortawesome/free-solid-svg-icons";
import SidebarHeader from "./SidebarHeader";
import SidebarContent from "./SidebarContent";
import SidebarFooter from "./SidebarFooter";
import { useAppSelector } from "../app/hooks";

interface Props {
  isHidden: boolean;
  setIsHidden: React.Dispatch<React.SetStateAction<boolean>>;
}
const Sidebar = ({ ...props }: Props) => {
  const { isHidden, setIsHidden } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedContact = useAppSelector(
    (state) => state.users.selectedContact,
  );

  return (
    <nav
      className={`flex min-h-dvh flex-col border-r border-base-300 bg-base-100 transition-all duration-300
         ${
           isHidden
             ? "hidden"
             : isOpen
               ? "absolute inset-y-0 left-0 z-50 w-60 md:relative md:inset-auto md:z-auto"
               : "absolute inset-y-0 left-0 z-50 w-16 md:relative md:inset-auto md:z-auto"
         }`}
    >
      {/* Toggle */}
      <div className='flex flex-col items-center gap-1 p-2'>
        {/* Hide / show */}
        <button
          type='button'
          title='hide small menu'
          className='btn btn-square w-full hover:bg-blue-900'
          onClick={() => setIsHidden((prev) => !prev)}
          disabled={!selectedContact}
          aria-label='Hide sidebar'
        >
          <FontAwesomeIcon icon={faAngleLeft} size='lg' />
        </button>

        {/* Open / collapse */}
        <button
          type='button'
          title='show full menu'
          className='btn btn-square w-full hover:bg-blue-900'
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label='Toggle sidebar width'
        >
          <FontAwesomeIcon icon={faBars} size='lg' />
        </button>
      </div>

      {/** Sidebar header section */}
      <SidebarHeader isOpen={isOpen} search={search} setSearch={setSearch} />
      {/** siderbar contacts list section */}
      <SidebarContent isOpen={isOpen} search={search} setSearch={setSearch} />
      {/** siderbar footer section */}
      <SidebarFooter isOpen={isOpen} />
    </nav>
  );
};

export default Sidebar;
