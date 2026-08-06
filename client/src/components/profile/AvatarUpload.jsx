import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfileAPI } from '../../hooks/useProfileAPI';
import { User, Camera, X } from 'lucide-react';

export function AvatarUpload() {
  const { user, updateUser } = useAuth();
  const { uploadAvatar, deleteAvatar, updating } = useProfileAPI();

  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (file.size > 15 * 1024 * 1024) {
      return 'File too large (max 15MB)';
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      return 'Only JPEG, PNG, GIF, WebP allowed';
    }
    return null;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setPreview(dataUrl);

      // Upload
      try {
        const updatedUser = await uploadAvatar(dataUrl);
        updateUser(updatedUser);
        setSuccess('Avatar uploaded successfully!');
        setPreview(null);
      } catch (err) {
        setError(err.message);
        setPreview(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    setError('');
    setSuccess('');

    try {
      const updatedUser = await deleteAvatar();
      updateUser(updatedUser);
      setSuccess('Avatar removed!');
    } catch (err) {
      setError(err.message);
    }
  };

  const avatarSrc = preview || user?.avatarUrl || null;

  return (
    <div className="mb-8">
      <h2 className="font-display text-lg mb-3 text-[color:var(--ink)]">Profile Picture</h2>

      {success && (
        <div className="status-ok mb-4">
          {success}
        </div>
      )}

      {error && (
        <div className="status-err mb-4">
          {error}
        </div>
      )}

      {/* Avatar Preview + Buttons */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-[color:color-mix(in_srgb,var(--ink)_8%,var(--paper))] border-2 border-[color:color-mix(in_srgb,var(--ink)_15%,transparent)]">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-[color:var(--ink-soft)]" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={updating}
            className="btn-coral focus-sketch"
          >
            {updating ? 'Uploading...' : (
              <>
                <Camera className="w-4 h-4" />
                <span>Choose Image</span>
              </>
            )}
          </button>

          {user?.avatarUrl && (
            <button
              onClick={handleDelete}
              disabled={updating}
              className="btn-ghost focus-sketch !text-sm !py-1.5"
            >
              <X className="w-4 h-4" />
              Remove Avatar
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-[color:var(--ink-soft)] mt-2">
        Max 15MB • JPEG, PNG, GIF, WebP only • Image will be resized to 200×200px
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
