import { useState, useRef, type ChangeEvent } from 'react';
import { useAppSelector } from '../../app/hooks';
import { useUpdateProfileMutation } from '../../features/auth/api/authApi';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmarkCircle,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user } = useAppSelector((state) => state.auth);
  const [name, setName] = useState(user?.name ?? '');
  const [avatar, setAvatar] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const [updateProfile, { isLoading, isError, error }] =
    useUpdateProfileMutation();

  const errorMessage = (error as any)?.data?.message || 'Something went wrong.';

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      console.error('faild to read image file');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setAvatar(reader.result as string);
    reader.onerror = () => console.error('Failed to read image file');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const trimedName = name?.trim();

    const payload: { name?: string; avatar?: string } = {};

    if (trimedName && trimedName !== user?.name) {
      payload.name = trimedName;
    }

    if (avatar) {
      payload.avatar = avatar;
    }

    if (Object.keys(payload).length === 0) return;

    try {
      await updateProfile(payload).unwrap();
      onClose();
    } catch (error) {
      console.error('Failed to update profile', error);
    }
  };

  const unChanged = (name?.trim() || '') === (user?.name || '') && !avatar;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">Settings</h2>
            <button
              type="button"
              className="cursor-pointer text-lg"
              aria-label="close"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmarkCircle} />
            </button>
          </div>

          {/* Error */}
          {isError && (
            <div className="alert alert-error mb-3">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-4">
            <div
              className="relative cursor-pointer"
              onClick={() => imageRef.current?.click()}
            >
              <div className="avatar placeholder">
                <div className="bg-neutral text-neutral-content rounded-full w-20 flex items-center justify-center">
                  {avatar ? (
                    <img src={avatar} alt="preview" className="rounded-full" />
                  ) : user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="rounded-full"
                    />
                  ) : (
                    <span className="text-2xl">
                      {user?.name.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 rounded-full">
                <button
                  type="button"
                  className="cursor-pointer text-lg hover:text-green-600"
                  aria-label="upload"
                >
                  <FontAwesomeIcon icon={faPenToSquare} />
                </button>
              </div>
            </div>
            <p className="text-xs text-base-content/50">
              Click to change avatar
            </p>
            <label htmlFor="file" aria-label="file"></label>
            <input
              type="file"
              id="file"
              ref={imageRef}
              className="hidden"
              accept="image/*"
              onChange={handleImage}
            />
          </div>

          {/* Name */}
          <div className="form-control mb-3">
            <label className="label label-text" htmlFor="name">
              Name
            </label>
            <input
              type="text"
              id="name"
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Email — read only */}
          <div className="form-control mb-6">
            <label className="label label-text" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="input input-bordered input-disabled"
              value={user?.email ?? ''}
              disabled
            />
          </div>

          {/* Save */}
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={handleSave}
            disabled={isLoading || unChanged}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
