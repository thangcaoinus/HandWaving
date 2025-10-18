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
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
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
    <div className="border-t-2 border-gray-200 pt-8">
      <h2 className="text-lg font-semibold mb-3">Change Password</h2>

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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="currentPassword">
            Current Password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
            required
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="newPassword">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-gray-500">
            At least 8 characters, with uppercase, lowercase, and number
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={updating || !currentPassword || !newPassword || !confirmPassword}
          className="w-full px-4 py-2 bg-[#f08080] text-white rounded font-medium hover:bg-[#e07070] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
