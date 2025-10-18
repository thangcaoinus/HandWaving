import React, { useState, useEffect } from "react";
import { useSocket } from "../../contexts/SocketContext";
import { useCanvasPersistence } from "../../contexts/CanvasPersistenceContext";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Trash2, X, Link2, Check, Users } from "lucide-react";
import UserMenu from '../auth/UserMenu';
import { getCanvasUrl } from '../../config/api';
import { logger } from '../../utils/logger';

export default function UserPresence() {
  const { isConnected, currentRoom, users, registerCollaboratorsChangedHandler } = useSocket();
  const {
    canvasId,
    collaborators,
    canManageCollaborators,
    fetchCollaborators,
    shareToken,
    linkSharingEnabled,
    shareRole,
    isOwner,
    handleLoad
  } = useCanvasPersistence();
  const { token, isAnonymous } = useAuth();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Link sharing settings (local state for UI)
  const [localLinkSharingEnabled, setLocalLinkSharingEnabled] = useState(linkSharingEnabled);
  const [localShareRole, setLocalShareRole] = useState(shareRole);

  // Sync with context when it changes
  useEffect(() => {
    setLocalLinkSharingEnabled(linkSharingEnabled);
    setLocalShareRole(shareRole);
  }, [linkSharingEnabled, shareRole]);

  const roomUsers = users.slice(0, 3);
  const hasMoreUsers = users.length > 3;

  // Listen for real-time collaborator list changes
  useEffect(() => {
    const handleCollaboratorsChanged = ({ canvasId: targetCanvasId }) => {
      // Only refresh if it's for current canvas
      if (targetCanvasId === canvasId) {
        logger.log('👥 Collaborator list changed, refreshing...');
        fetchCollaborators();
      }
    };

    if (registerCollaboratorsChangedHandler) {
      registerCollaboratorsChangedHandler(handleCollaboratorsChanged);
    }

    // No cleanup needed - handler stays registered
  }, [canvasId, registerCollaboratorsChangedHandler, fetchCollaborators]);

  async function handleAddCollaborator(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(getCanvasUrl(canvasId, '/collaborators'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add collaborator');
      }

      setEmail("");
      setRole("VIEWER");
      setIsAddModalOpen(false);
      fetchCollaborators();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveCollaborator(collaborationId) {
    if (!confirm('Remove this collaborator?')) return;

    try {
      const response = await fetch(getCanvasUrl(canvasId, `/collaborators/${collaborationId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove collaborator');
      }

      fetchCollaborators();
    } catch (err) {
      alert('Failed to remove: ' + err.message);
    }
  }

  async function handleUpdateRole(collaborationId, newRole) {
    try {
      const response = await fetch(getCanvasUrl(canvasId, `/collaborators/${collaborationId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      fetchCollaborators();
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    }
  }

  function handleCopyShareLink() {
    if (!shareToken) {
      alert('Share link is not available. Please try refreshing the page.');
      return;
    }

    const shareUrl = `${window.location.origin}/canvas/${canvasId}?invite=${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(err => {
      logger.error('Failed to copy link:', err);
      alert('Failed to copy link to clipboard');
    });
  }

  async function handleToggleLinkSharing(enabled) {
    if (!isOwner) return;

    try {
      const response = await fetch(getCanvasUrl(canvasId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ linkSharingEnabled: enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update link sharing');
      }

      setLocalLinkSharingEnabled(enabled);
      handleLoad(canvasId); // Refresh canvas data
    } catch (err) {
      logger.error('Failed to toggle link sharing:', err);
      alert('Failed to update link sharing: ' + err.message);
    }
  }

  async function handleUpdateShareRole(newRole) {
    if (!isOwner) return;

    try {
      const response = await fetch(getCanvasUrl(canvasId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ shareRole: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update share role');
      }

      setLocalShareRole(newRole);
      handleLoad(canvasId); // Refresh canvas data
    } catch (err) {
      logger.error('Failed to update share role:', err);
      alert('Failed to update share role: ' + err.message);
    }
  }

  async function handleRotateShareToken() {
    if (!isOwner) return;
    if (!confirm('Rotate share link? This will invalidate the old link.')) return;

    try {
      const response = await fetch(getCanvasUrl(canvasId, '/rotate-token'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to rotate token');
      }

      handleLoad(canvasId); // Refresh canvas data to get new token
      alert('Share link rotated successfully');
    } catch (err) {
      logger.error('Failed to rotate token:', err);
      alert('Failed to rotate token: ' + err.message);
    }
  }

  return (
    <>
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        {/* User Menu Component */}
        <UserMenu />

        {/* Room User Indicators (like Google Docs) */}
        {currentRoom && users.length > 0 && (
          <div className="flex items-center gap-0.5">
            {roomUsers.map((user, index) => (
              <div
                key={user.id}
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md border-2 border-white overflow-hidden"
                title={user.username || `User ${user.id.substring(0, 6)}...`}
                style={{
                  marginLeft: index > 0 ? "-6px" : "0",
                  zIndex: roomUsers.length - index,
                  background: user.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #f8ad9d, #fbc4ab)',
                }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.username?.substring(0, 1).toUpperCase() || user.id.substring(0, 1).toUpperCase()
                )}
              </div>
            ))}
            {hasMoreUsers && (
              <div
                className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md border-2 border-white"
                title={`+${users.length - 3} more users`}
                style={{ marginLeft: "-6px", zIndex: 0 }}
              >
                +{users.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Share Button */}
        <button
          className="w-10 h-10 text-white rounded-lg shadow-lg font-medium transition-colors flex items-center justify-center"
          style={{ backgroundColor: '#f08080' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f4978e'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f08080'}
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          title="Share & Collaborate"
        >
          <Link2 className="w-5 h-5" />
        </button>
      </div>

      {isPanelOpen && (
        <div className="fixed top-16 right-4 w-80 z-50">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, #f08080, #f8ad9d)' }}>
              <h3 className="font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>Collaborators</span>
              </h3>
              <button
                className="text-white hover:bg-white/20 rounded px-2 py-1 transition-colors"
                onClick={() => setIsPanelOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {canvasId ? (
                <>
                  {/* Link Sharing Section - Only for authenticated owner */}
                  {isOwner && !isAnonymous && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                        <Link2 className="w-4 h-4" />
                        Link Sharing
                      </h4>

                      {/* Enable/Disable Toggle */}
                      <div className="flex items-center gap-2 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={localLinkSharingEnabled}
                            onChange={(e) => handleToggleLinkSharing(e.target.checked)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm">Enable link sharing</span>
                        </label>
                      </div>

                      {localLinkSharingEnabled && (
                        <>
                          {/* Share Role Selector */}
                          <div className="mb-2">
                            <label className="block text-xs text-gray-600 mb-1">
                              People with link can:
                            </label>
                            <select
                              value={localShareRole}
                              onChange={(e) => handleUpdateShareRole(e.target.value)}
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="VIEWER">View only</option>
                              <option value="EDITOR">Edit</option>
                            </select>
                          </div>

                          {/* Copy Link Button */}
                          <button
                            onClick={handleCopyShareLink}
                            disabled={!shareToken}
                            className="w-full mb-2 bg-[#ffdab9] hover:bg-[#fbc4ab] text-gray-800 px-3 py-2 rounded flex items-center justify-center gap-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {linkCopied ? (
                              <>
                                <Check size={14} />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Link2 size={14} />
                                Copy Link
                              </>
                            )}
                          </button>

                          {/* Rotate Token Button */}
                          <button
                            onClick={handleRotateShareToken}
                            className="w-full text-xs text-gray-600 hover:text-gray-800 underline"
                          >
                            Rotate link (invalidate old link)
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Anonymous user message */}
                  {isAnonymous && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-700">
                        <strong>Login required:</strong> You need to login or sign up to share this canvas with others.
                      </p>
                    </div>
                  )}

                  {canManageCollaborators && (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="w-full mb-4 sketch-button bg-[#f08080] hover:bg-[#e07070] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-bold"
                    >
                      <Plus size={16} />
                      Add Collaborator
                    </button>
                  )}

                  <div className="space-y-2">
                    {collaborators.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No collaborators yet
                      </div>
                    ) : (
                      collaborators.map((collab) => (
                        <div
                          key={collab.id}
                          className="bg-gray-50 p-3 rounded-lg flex items-center gap-3"
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-[#f8ad9d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                            {collab.user.avatarUrl ? (
                              <img
                                src={collab.user.avatarUrl}
                                alt={collab.user.displayName || collab.user.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (collab.user.displayName || collab.user.username).substring(0, 1).toUpperCase()
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate flex items-center gap-1">
                              {collab.user.displayName || collab.user.username}
                              {collab.user.isGuest && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">Guest</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {collab.user.email || '(No email)'}
                            </div>
                            {canManageCollaborators ? (
                              <select
                                value={collab.role}
                                onChange={(e) => handleUpdateRole(collab.id, e.target.value)}
                                className="text-xs mt-1 border border-gray-300 rounded px-1 py-0.5"
                              >
                                <option value="VIEWER">Viewer</option>
                                <option value="EDITOR">Editor</option>
                                {/* Guests cannot be ADMIN */}
                                {!collab.user.isGuest && <option value="ADMIN">Admin</option>}
                              </select>
                            ) : (
                              <div className="text-xs text-gray-400 mt-1">
                                Role: {collab.role}
                              </div>
                            )}
                          </div>
                          
                          {canManageCollaborators && (
                            <button
                              onClick={() => handleRemoveCollaborator(collab.id)}
                              className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                      <span className="text-sm text-gray-700">
                        {isConnected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {users.length} {users.length === 1 ? "user" : "users"} online
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  Save canvas to enable collaboration
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">Add Collaborator</h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCollaborator} className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f08080] focus:border-transparent outline-none"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission Level
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f08080] focus:border-transparent outline-none"
                >
                  <option value="VIEWER">Viewer (can view only)</option>
                  <option value="EDITOR">Editor (can edit)</option>
                  <option value="ADMIN">Admin (can manage collaborators)</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-[#f08080] hover:bg-[#e07070] text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
