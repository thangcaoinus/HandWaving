import { useState } from 'react';
import { useProfileAPI } from '../../hooks/useProfileAPI';

export function PasswordChangeForm() {
  const { changePassword, updating } = useProfileAPI();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedNew !== trimmedConfirm) {
      setError('New passwords do not match');
      return;
    }

    if (trimmedNew.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await changePassword(currentPassword.trim(), newPassword.trim());
      setSuccess('Password changed successfully!');
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="border-t-2 border-[color:color-mix(in_srgb,var(--ink)_12%,transparent)] pt-8">
      <h2 className="font-display text-lg mb-3 text-[color:var(--ink)]">Change Password</h2>

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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="currentPassword">
            Current Password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="sketch-input"
            required
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="newPassword">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="sketch-input"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
            At least 8 characters, with uppercase, lowercase, and number
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="sketch-input"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={updating || !currentPassword || !newPassword || !confirmPassword}
          className="btn-coral focus-sketch w-full"
        >
          {updating ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
