import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfileAPI } from '../../hooks/useProfileAPI';
import { User, Camera } from 'lucide-react';

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
      <h2 className="text-lg font-semibold mb-3">Profile Picture</h2>

      {success && (
        <div className="mb-4 p-3 bg-green-100 border-2 border-green-400 rounded text-green-700 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Avatar Preview + Buttons */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border-2 border-gray-300">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-gray-400" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={updating}
            className="px-4 py-2 bg-[#f08080] text-white rounded font-medium hover:bg-[#e07070] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
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
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded font-medium hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✕ Remove Avatar
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2">
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
