import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import {
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useDeleteAccountMutation,
} from "../features/users/usersEndpoints";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { ApiError } from "../app/middleware/rtkQueryErrorMiddlewarw";
import toast from "react-hot-toast";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const isLocalAccount = user?.provider === "local";
  // --- profile section ---
  const [name, setName] = useState(user?.name ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [
    updateProfile,
    {
      isLoading: isSavingProfile,
      isError: isProfileError,
      error: profileError,
    },
  ] = useUpdateProfileMutation();

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      console.error("File too large");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    const username = name.trim();
    const formData = new FormData();

    if (username && username !== user?.name) formData.append("name", username);
    if (avatarFile) formData.append("avatar", avatarFile); // field name MUST match multer's upload.single("avatar")

    // nothing changed
    if (!formData.has("name") && !formData.has("avatar")) return;

    try {
      await updateProfile(formData).unwrap();
      toast.success("Profile updated");
      setAvatarFile(null);
    } catch (err) {
      console.error("Failed to update profile", err);
    }
  };

  const profileErrorMessage =
    (profileError as ApiError | undefined)?.data?.message ||
    "Something went wrong.";

  const isProfileUnchanged =
    (name.trim() || "") === (user?.name || "") && !avatarFile;

  // --- change password section ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [
    changePassword,
    { isLoading: isChangingPassword, isError: isPassError, error: passError },
  ] = useChangePasswordMutation();

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    try {
      const { message } = await changePassword({
        currentPassword,
        newPassword,
      }).unwrap();
      toast.success(message);
      navigate("/login");
    } catch (error) {
      console.error("failed to change password", error);
    }
  };

  const passwordErrorMessage =
    (passError as ApiError | undefined)?.data?.message ||
    "something went wrong.";

  // --- delete account section ---
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [
    deleteAccount,
    { isLoading: isDeleting, isError: isDeleteError, error: deleteError },
  ] = useDeleteAccountMutation();

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(
        isLocalAccount ? { password: deletePassword } : {},
      ).unwrap();
      toast.success("Account deleted");
      navigate("/login");
    } catch (error) {
      console.error("fialed deleting account", error);
    }
  };

  const deleteErrorMessage =
    (deleteError as ApiError | undefined)?.data?.message ||
    "something went wrong.";
  return (
    <div className='min-h-screen flex items-start justify-center py-10 px-4'>
      <div className='flex flex-col gap-6 w-full max-w-md'>
        {/* --- Profile --- */}
        <div className='card bg-base-100 shadow-xl'>
          <div className='card-body'>
            <h2 className='card-title mb-4'>Profile</h2>

            {isProfileError && (
              <div className='alert alert-error mb-3'>
                <span>{profileErrorMessage}</span>
              </div>
            )}

            <div className='flex flex-col items-center gap-3 mb-4'>
              <label htmlFor='avatar-file' className='relative cursor-pointer'>
                <div className='avatar placeholder'>
                  <div className='bg-neutral text-neutral-content rounded-full w-20 flex items-center justify-center'>
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt='preview'
                        className='rounded-full'
                      />
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
                id='avatar-file'
                className='hidden'
                accept='image/*'
                onChange={handleImage}
              />
            </div>

            <div className='flex flex-col gap-2 form-control mb-3'>
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

            <div className='flex flex-col gap-2 form-control mb-6'>
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
              onClick={handleSaveProfile}
              disabled={isSavingProfile || isProfileUnchanged}
            >
              {isSavingProfile ? (
                <span className='loading loading-spinner loading-sm' />
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>

        {/* --- Change Password --- */}
        <div className='card bg-base-100 shadow-xl'>
          <div className='card-body'>
            <h2 className='card-title mb-2'>Change Password</h2>

            {isPassError && (
              <div className='alert alert-error mb-3'>
                <span>{passwordErrorMessage}</span>
              </div>
            )}

            <div className='form-control mb-3'>
              <label className='label label-text mb-3' htmlFor='current-password'>
                Current Password
              </label>
              <input
                type='password'
                id='current-password'
                className='input input-bordered'
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete='current-password'
              />
            </div>

            <div className='form-control mb-6'>
              <label className='label label-text mb-2' htmlFor='new-password'>
                New Password
              </label>
              <input
                type='password'
                id='new-password'
                className='input input-bordered'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete='new-password'
              />
              <span className='block text-xs text-base-content/50 mt-2'>
                8+ chars, upper, lower, number, special character
              </span>
            </div>

            <button
              type='button'
              className='btn btn-primary w-full'
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword}
            >
              {isChangingPassword ? (
                <span className='loading loading-spinner loading-sm' />
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </div>

        {/* --- Delete Account --- */}
        <div className='card bg-base-100 shadow-xl border border-error'>
          <div className='card-body'>
            <h2 className='card-title mb-4 text-error'>Delete Account</h2>

            {isDeleteError && (
              <div className='alert alert-error mb-3'>
                <span>{deleteErrorMessage}</span>
              </div>
            )}

            {!confirmingDelete ? (
              <button
                type='button'
                className='btn btn-error w-full gap-2'
                onClick={() => setConfirmingDelete(true)}
              >
                <FontAwesomeIcon icon={faTrash} />
                Delete My Account
              </button>
            ) : (
              <>
                <p className='text-sm mb-3'>
                  This is permanent.
                  {isLocalAccount
                    ? " Confirm your password to continue."
                    : " Confirm to continue."}
                </p>
                {isLocalAccount && (
                  <div className='form-control mb-4'>
                    <input
                      type='password'
                      className='input input-bordered'
                      placeholder='Password'
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      autoComplete='current-password'
                    />
                  </div>
                )}
                <div className='flex gap-2'>
                  <button
                    type='button'
                    className='btn btn-ghost flex-1'
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeletePassword("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    className='btn btn-error flex-1'
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || (isLocalAccount && !deletePassword)}
                  >
                    {isDeleting ? (
                      <span className='loading loading-spinner loading-sm' />
                    ) : (
                      "Confirm Delete"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
