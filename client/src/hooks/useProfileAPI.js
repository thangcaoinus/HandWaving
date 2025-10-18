import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config/api';

const API_URL = API_ENDPOINTS.USERS;

export function useProfileAPI() {
  const { token, isAuthenticated } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  // Update display name
  const updateDisplayName = useCallback(async (displayName) => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to update your profile');
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/profile/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update display name');
      }

      const data = await response.json();
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [token, isAuthenticated]);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to change your password');
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [token, isAuthenticated]);

  // Upload avatar (base64 data)
  const uploadAvatar = useCallback(async (avatarData) => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to upload an avatar');
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/profile/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload avatar');
      }

      const data = await response.json();
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [token, isAuthenticated]);

  // Delete avatar
  const deleteAvatar = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to delete your avatar');
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/profile/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete avatar');
      }

      const data = await response.json();
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [token, isAuthenticated]);

  return {
    updateDisplayName,
    changePassword,
    uploadAvatar,
    deleteAvatar,
    updating,
    error,
  };
}
