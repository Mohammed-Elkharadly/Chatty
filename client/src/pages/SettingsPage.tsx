import { useState, type ChangeEvent } from "react";
import { useAppSelector } from "../app/hooks";
import { useUpdateProfileMutation } from "../features/auth/authEndpoints";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import type { ApiError } from "../middleware/rtkQueryErrorMiddlewarw";

const SettingsPage = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState<string | null>(null);

  const [updateProfile, { isLoading, isError, error }] =
    useUpdateProfileMutation();
  const errorMessage =
    (error as ApiError | undefined)?.data?.message || "Something went wrong.";

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      console.error("File too large");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setAvatar(reader.result as string);
    reader.onerror = () => console.error("Failed to read image file");
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const trimmedName = name?.trim();
    const payload: { name?: string; avatar?: string } = {};

    if (trimmedName && trimmedName !== user?.name) payload.name = trimmedName;
    if (avatar) payload.avatar = avatar;
    if (Object.keys(payload).length === 0) return;

    try {
      await updateProfile(payload).unwrap();
    } catch (err) {
      console.error("Failed to update profile", err);
    }
  };

  const isUnchanged = (name?.trim() || "") === (user?.name || "") && !avatar;

  return (
    <div className='min-h-screen flex items-start justify-center py-10 px-4'>
      <div className='card w-full max-w-md bg-base-100 shadow-xl'>
        <div className='card-body'>
          <h2 className='card-title mb-4'>Settings</h2>

          {isError && (
            <div className='alert alert-error mb-3'>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className='flex flex-col items-center gap-3 mb-4'>
            <label htmlFor='file' className='relative cursor-pointer'>
              <div className='avatar placeholder'>
                <div className='bg-neutral text-neutral-content rounded-full w-20 flex items-center justify-center'>
                  {avatar ? (
                    <img src={avatar} alt='preview' className='rounded-full' />
                  ) : user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className='rounded-full'
                    />
                  ) : (
                    <span className='text-2xl'>
                      {user?.name.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
              </div>
              <div className='absolute bottom-0 right-0 rounded-full'>
                <FontAwesomeIcon
                  icon={faPenToSquare}
                  className='text-lg hover:text-green-600'
                />
              </div>
            </label>
            <p className='text-xs text-base-content/50'>
              Click to change avatar
            </p>
            <input
              type='file'
              id='file'
              className='hidden'
              accept='image/*'
              onChange={handleImage}
            />
          </div>

          <div className='form-control mb-3'>
            <label className='label label-text' htmlFor='name'>
              Name
            </label>
            <input
              type='text'
              id='name'
              className='input input-bordered'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className='form-control mb-6'>
            <label className='label label-text' htmlFor='email'>
              Email
            </label>
            <input
              type='email'
              id='email'
              className='input input-bordered input-disabled'
              value={user?.email ?? ""}
              disabled
            />
          </div>

          <button
            type='button'
            className='btn btn-primary w-full'
            onClick={handleSave}
            disabled={isLoading || isUnchanged}
          >
            {isLoading ? (
              <span className='loading loading-spinner loading-sm' />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
