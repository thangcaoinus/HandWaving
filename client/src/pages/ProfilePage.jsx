import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AvatarUpload } from '../components/profile/AvatarUpload';
import { ProfileForm } from '../components/profile/ProfileForm';
import { PasswordChangeForm } from '../components/profile/PasswordChangeForm';
import { UserCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f08080] to-[#ffdab9] flex items-center justify-center p-4">
      <div className="sketch-panel bg-white p-8 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold -rotate-1 flex items-center gap-3" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
            <UserCircle className="w-8 h-8 text-[#f08080]" strokeWidth={2.5} />
            Profile Settings
          </h1>
          <button
            onClick={() => navigate('/gallery')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium transition-colors"
          >
            ← Back to Gallery
          </button>
        </div>

        {/* Account Info (Read-only) */}
        <div className="mb-8 p-4 bg-gray-50 rounded border-2 border-gray-200">
          <h2 className="text-lg font-semibold mb-3">Account Information</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-600">Email:</span>{' '}
              <span className="text-gray-900">{user?.email}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Username:</span>{' '}
              <span className="text-gray-900">{user?.username}</span>
            </div>
          </div>
        </div>

        {/* Avatar Upload Component */}
        <AvatarUpload />

        {/* Profile Form Component */}
        <ProfileForm />

        {/* Password Change Form Component */}
        <PasswordChangeForm />
      </div>
    </div>
  );
}
