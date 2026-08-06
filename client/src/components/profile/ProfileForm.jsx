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
      const updatedUser = await updateDisplayName(displayName.trim());
      updateUser(updatedUser);
      setSuccess('Display name updated successfully!');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mb-8">
      <h2 className="font-display text-lg mb-3 text-[color:var(--ink)]">Display Name</h2>

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
          <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="displayName">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="sketch-input"
            required
            maxLength={50}
            placeholder="Your display name"
          />
          <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
            This is how your name appears to other users
          </p>
        </div>

        <button
          type="submit"
          disabled={updating || displayName === user?.displayName}
          className="btn-coral focus-sketch w-full"
        >
          {updating ? 'Updating...' : 'Update Display Name'}
        </button>
      </form>
    </div>
  );
}
