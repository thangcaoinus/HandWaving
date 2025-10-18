import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfileAPI } from '../../hooks/useProfileAPI';

export function ProfileForm() {
  const { user, updateUser } = useAuth();
  const { updateDisplayName, updating } = useProfileAPI();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const updatedUser = await updateDisplayName(displayName);
      updateUser(updatedUser);
      setSuccess('Display name updated successfully!');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-3">Display Name</h2>
      
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
          <label className="block text-sm font-medium mb-1" htmlFor="displayName">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
            required
            maxLength={50}
            placeholder="Your display name"
          />
          <p className="mt-1 text-xs text-gray-500">
            This is how your name appears to other users
          </p>
        </div>

        <button
          type="submit"
          disabled={updating || displayName === user?.displayName}
          className="w-full px-4 py-2 bg-[#f08080] text-white rounded font-medium hover:bg-[#e07070] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating ? 'Updating...' : 'Update Display Name'}
        </button>
      </form>
    </div>
  );
}
