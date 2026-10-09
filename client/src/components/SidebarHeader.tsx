import { useAppDispatch, useAppSelector } from "../app/hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setIsMuted } from "../features/users/usersSlice";
import {
  faMagnifyingGlass,
  faBell,
  faBellSlash,
} from "@fortawesome/free-solid-svg-icons";
interface SidebarContentProps {
  isOpen: boolean;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
}
const SidebarHeader = ({ ...props }: SidebarContentProps) => {
  const { isOpen, search, setSearch } = props;
  const user = useAppSelector((state) => state.auth.user);
  const { isMuted } = useAppSelector((state) => state.users);
  const dispatch = useAppDispatch();
  if (!isOpen) return null;
  const content = (
    <>
      {/** Avatar + Name */}
      <div className='m-2 flex items-center justify-evenly gap-3 rounded-sm bg-[#191e24] p-2 shadow-sm shadow-black'>
        <div className='avatar relative'>
          <div className='bg-slate-900 text-neutral-content rounded-full border border-gray-200 w-10 flex items-center justify-center'>
            {user?.avatar ? (
              <img
                src={user?.avatar}
                alt={user?.name}
                className='rounded-full'
              />
            ) : (
              <span>{user?.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span className='absolute z-50 top-0 left-0 w-2 h-2 rounded-full bg-success'></span>
        </div>
        <span className='font-semibold flex-1'>{user?.name}</span>
        {/* Mute button */}
        <button
          type='button'
          className='btn btn-ghost btn-xs btn-circle'
          onClick={() => dispatch(setIsMuted(!isMuted))}
          aria-label={isMuted ? "unmute notifications" : "mute notifications"}
        >
          <FontAwesomeIcon icon={isMuted ? faBellSlash : faBell} />
        </button>
      </div>
      {/** Search input */}
      <div className='relative m-2 rounded-sm bg-[#191e24] px-3 py-2 shadow-sm shadow-black'>
        <label
          htmlFor='search'
          aria-label='search input'
          className='absolute top-3 right-5 z-10'
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </label>
        <input
          type='text'
          id='search'
          name='search'
          placeholder='Search for a contact'
          className='grow input input-sm flex items-center gap-2 focus:ring-0 focus:outline-none'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete='off'
        />
      </div>
    </>
  );
  return content;
};

export default SidebarHeader;
