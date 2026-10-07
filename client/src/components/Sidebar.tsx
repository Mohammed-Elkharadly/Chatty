import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import SidebarHeader from "./SidebarHeader";
import SidebarContent from "./SidebarContent";
import SidebarFooter from "./SidebarFooter";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <nav
      className={`flex flex-col min-h-dvh border-r border-base-300 bg-base-100
    transition-all duration-300 
    ${
      isOpen
        ? "w-60 fixed inset-y-0 left-0 z-40 md:relative md:inset-auto md:z-auto"
        : "w-16"
    }`}
    >
      {/* Toggle */}
      <div className='p-3'>
        <button
          type='button'
          className='btn btn-square btn-ghost w-full hover:bg-blue-900'
          onClick={() => setIsOpen(!isOpen)}
          aria-label='Toggle sidebar'
        >
          <FontAwesomeIcon icon={faBars} size='lg' />
        </button>
      </div>

      {/** Sidebar header section */}
      <SidebarHeader isOpen={isOpen} search={search} setSearch={setSearch}/>
      {/** siderbar contacts list section */}
      <SidebarContent isOpen={isOpen}  search={search} setSearch={setSearch}/>
      {/** siderbar footer section */}
      <SidebarFooter isOpen={isOpen}/>
    </nav>
  );
};

export default Sidebar;
