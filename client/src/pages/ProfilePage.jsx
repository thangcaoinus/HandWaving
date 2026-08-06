import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AvatarUpload } from '../components/profile/AvatarUpload';
import { ProfileForm } from '../components/profile/ProfileForm';
import { PasswordChangeForm } from '../components/profile/PasswordChangeForm';
import { UserCircle, ArrowLeft } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="paper-surface min-h-screen flex items-center justify-center p-4 font-body text-[color:var(--ink)]">
      <div className="sketch-panel paper-card p-8 w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="font-display text-3xl -rotate-1 flex items-center gap-3 text-[color:var(--ink)]">
            <UserCircle className="w-8 h-8 text-[color:var(--coral)]" strokeWidth={2.5} />
            Profile Settings
          </h1>
          <button
            onClick={() => navigate('/gallery')}
            className="btn-ghost focus-sketch !text-sm !py-2"
          >
            <ArrowLeft size={16} />
            Back to Gallery
          </button>
        </div>

        {/* Account Info (Read-only) */}
        <div className="mb-8 p-4 rounded-lg bg-[color:color-mix(in_srgb,var(--paper-deep)_70%,transparent)] border-2 border-[color:color-mix(in_srgb,var(--ink)_10%,transparent)]">
          <h2 className="font-display text-lg mb-3 text-[color:var(--ink)]">Account Information</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-bold text-[color:var(--ink-soft)]">Email:</span>{' '}
              <span className="text-[color:var(--ink)]">{user?.email}</span>
            </div>
            <div>
              <span className="font-bold text-[color:var(--ink-soft)]">Username:</span>{' '}
              <span className="text-[color:var(--ink)]">{user?.username}</span>
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
