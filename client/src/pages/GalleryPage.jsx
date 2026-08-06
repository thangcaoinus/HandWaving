import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Copy, Clock, User as UserIcon, RefreshCw, Search, Filter, Tag as TagIcon, X, Palette } from 'lucide-react';
import { API_ENDPOINTS, getCanvasUrl } from '../config/api';

export default function GalleryPage() {
  const [canvases, setCanvases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOwner, setFilterOwner] = useState('all'); // 'all', 'mine', 'shared'
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('updated'); // 'updated', 'created', 'title', 'title-desc'
  
  // Tag input states
  const [showTagInput, setShowTagInput] = useState({});
  const [tagInputValue, setTagInputValue] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fetchCanvases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.CANVASES, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch canvases');
      }

      const data = await response.json();
      setCanvases(data.canvases);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Refetch whenever we navigate TO this page
  useEffect(() => {
    fetchCanvases();
  }, [fetchCanvases, location.pathname]);

  // Refetch when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCanvases();
      }
    };

    const handleFocus = () => {
      fetchCanvases();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchCanvases]);

  // Filter and sort canvases
  const filteredCanvases = useMemo(() => {
    let result = [...canvases];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(canvas =>
        canvas.title.toLowerCase().includes(query) ||
        (canvas.description && canvas.description.toLowerCase().includes(query))
      );
    }

    // Owner filter
    if (filterOwner === 'mine') {
      result = result.filter(canvas => canvas.owner.id === user?.id);
    } else if (filterOwner === 'shared') {
      result = result.filter(canvas => canvas.owner.id !== user?.id);
    }

    // Tag filter
    if (selectedTags.length > 0) {
      result = result.filter(canvas => {
        const canvasTags = canvas.tags?.map(t => t.tag.name) || [];
        return selectedTags.every(tag => canvasTags.includes(tag));
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'updated') {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      } else if (sortBy === 'created') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'title-desc') {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

    return result;
  }, [canvases, searchQuery, filterOwner, selectedTags, sortBy, user]);

  // Get all unique tags from canvases
  const allTags = useMemo(() => {
    const tagSet = new Set();
    canvases.forEach(canvas => {
      canvas.tags?.forEach(t => tagSet.add(t.tag.name));
    });
    return Array.from(tagSet).sort();
  }, [canvases]);

  const hasActiveFilters = searchQuery || filterOwner !== 'all' || selectedTags.length > 0;

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterOwner('all');
    setSelectedTags([]);
  };

  async function handleDelete(canvasId, e) {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this canvas?')) {
      return;
    }

    try {
      const response = await fetch(getCanvasUrl(canvasId), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete canvas');
      }

      setCanvases(canvases.filter(c => c.id !== canvasId));
    } catch (err) {
      alert('Failed to delete canvas: ' + err.message);
    }
  }

  async function handleDuplicate(canvasId, e) {
    e.stopPropagation();

    try {
      const response = await fetch(getCanvasUrl(canvasId, '/duplicate'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate canvas');
      }

      const data = await response.json();
      setCanvases([data.canvas, ...canvases]);
    } catch (err) {
      alert('Failed to duplicate canvas: ' + err.message);
    }
  }

  async function handleAddTag(canvasId, tagName) {
    if (!tagName || !tagName.trim()) return;

    const trimmed = tagName.trim();

    // Frontend validation
    if (trimmed.length > 30) {
      alert('Tag name must be 30 characters or less');
      return;
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
      alert('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    // Check if canvas already has this tag (case-insensitive)
    const canvas = canvases.find(c => c.id === canvasId);
    const existingTags = canvas?.tags?.map(t => t.tag.name.toLowerCase()) || [];
    if (existingTags.includes(trimmed.toLowerCase())) {
      alert('This tag already exists on the canvas');
      return;
    }

    // Check max tags limit
    if ((canvas?.tags?.length || 0) >= 10) {
      alert('Canvas cannot have more than 10 tags');
      return;
    }

    setAddingTag(true);
    try {
      const response = await fetch(getCanvasUrl(canvasId, '/tags'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tagName: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add tag');
      }

      const data = await response.json();
      
      // Update local canvas with new tag
      setCanvases(canvases.map(c => {
        if (c.id === canvasId) {
          return {
            ...c,
            tags: [...(c.tags || []), { tag: data.tag }],
          };
        }
        return c;
      }));

      setShowTagInput({ ...showTagInput, [canvasId]: false });
      setTagInputValue('');
    } catch (err) {
      alert('Failed to add tag: ' + err.message);
    } finally {
      setAddingTag(false);
    }
  }

  async function handleRemoveTag(canvasId, tagId, e) {
    e.stopPropagation();
    
    try {
      const response = await fetch(getCanvasUrl(canvasId, `/tags/${tagId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove tag');
      }

      // Update local canvas
      setCanvases(canvases.map(c => {
        if (c.id === canvasId) {
          return {
            ...c,
            tags: c.tags?.filter(t => t.tag.id !== tagId) || [],
          };
        }
        return c;
      }));
    } catch (err) {
      alert('Failed to remove tag: ' + err.message);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="paper-surface min-h-screen flex items-center justify-center text-[color:var(--ink)]">
        <div className="font-display text-2xl">
          Loading canvases...
        </div>
      </div>
    );
  }

  return (
    <div className="paper-surface min-h-screen p-8 font-body text-[color:var(--ink)]">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-5xl mb-1 flex items-center gap-3 text-[color:var(--ink)]">
              <Palette className="w-11 h-11 text-[color:var(--coral)]" strokeWidth={2.5} />
              <span>Your Canvases</span>
            </h1>
            <p className="text-[color:var(--ink-soft)] text-lg ml-1">
              Welcome back, {user?.displayName || user?.username}.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setLoading(true);
                fetchCanvases();
              }}
              className="btn-ghost focus-sketch !px-4 !py-3"
              title="Refresh gallery"
            >
              <RefreshCw size={20} />
            </button>

            <button
              onClick={() => navigate('/canvas/new')}
              className="btn-coral focus-sketch !px-6 !py-3"
            >
              <Plus size={20} />
              New Canvas
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="status-err">{error}</div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="sketch-panel paper-card p-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)] z-10" />
                <input
                  type="text"
                  placeholder="Search canvases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="sketch-input !pl-10"
                />
              </div>
            </div>

            {/* Owner Filter */}
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="sketch-input !w-auto"
            >
              <option value="all">All Canvases</option>
              <option value="mine">My Canvases</option>
              <option value="shared">Shared With Me</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sketch-input !w-auto"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Recently Created</option>
              <option value="title">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="btn-ghost focus-sketch !text-sm !py-2"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-sm text-[color:var(--ink-soft)]">Filtered by:</span>
              {selectedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                  className="tag-chip"
                >
                  {tag}
                  <X size={12} />
                </button>
              ))}
            </div>
          )}

          {/* Available Tags */}
          {allTags.length > 0 && selectedTags.length < allTags.length && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-sm text-[color:var(--ink-soft)]">Tags:</span>
              {allTags
                .filter(tag => !selectedTags.includes(tag))
                .map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTags([...selectedTags, tag])}
                    className="px-2.5 py-1 rounded-full text-xs font-body font-bold text-[color:var(--ink-soft)] bg-[color:color-mix(in_srgb,var(--ink)_8%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ink)_14%,transparent)] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
            </div>
          )}

          {/* Results Count */}
          <div className="mt-3 text-sm text-[color:var(--ink-soft)]">
            Showing {filteredCanvases.length} of {canvases.length} canvas{canvases.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Canvas Grid */}
      <div className="max-w-7xl mx-auto">
        {filteredCanvases.length === 0 ? (
          <div className="sketch-panel paper-card p-12 text-center">
            <div className="mb-4 flex justify-center">
              <Palette className="w-24 h-24 text-[color:color-mix(in_srgb,var(--ink)_25%,transparent)]" strokeWidth={2} />
            </div>
            <h2 className="font-display text-3xl mb-2 text-[color:var(--ink)]">
              {canvases.length === 0 ? 'No canvases yet' : 'Nothing matches those filters'}
            </h2>
            <p className="text-[color:var(--ink-soft)] mb-6">
              {canvases.length === 0 ? 'Draw your first canvas to get started.' : 'Try adjusting your search or filters.'}
            </p>
            {canvases.length === 0 && (
              <button
                onClick={() => navigate('/canvas/new')}
                className="btn-coral focus-sketch !px-6 !py-3"
              >
                <Plus size={18} />
                New Canvas
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCanvases.map((canvas) => (
              <div
                key={canvas.id}
                onClick={() => navigate(`/canvas/${canvas.id}`)}
                className="sketch-panel paper-card p-4 cursor-pointer hover:-translate-y-1 transition-transform duration-200 group"
              >
                {/* Thumbnail Placeholder */}
                <div className="w-full h-40 rounded-lg mb-3 flex items-center justify-center overflow-hidden bg-[color:color-mix(in_srgb,var(--ink)_5%,var(--paper))] border border-[color:color-mix(in_srgb,var(--ink)_8%,transparent)]">
                  {canvas.thumbnailUrl ? (
                    <img src={canvas.thumbnailUrl} alt={canvas.title} className="w-full h-full object-cover" />
                  ) : (
                    <Palette className="w-12 h-12 text-[color:color-mix(in_srgb,var(--ink)_18%,transparent)]" strokeWidth={2} />
                  )}
                </div>

                {/* Canvas Info */}
                <div className="mb-3">
                  <h3 className="font-display text-xl mb-1 truncate text-[color:var(--ink)] group-hover:text-[color:var(--coral)] transition-colors">
                    {canvas.title}
                  </h3>
                  {canvas.description && (
                    <p className="text-sm text-[color:var(--ink-soft)] line-clamp-2">
                      {canvas.description}
                    </p>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-[color:var(--ink-soft)] mb-3">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(canvas.updatedAt)}
                  </div>
                  {canvas.owner && canvas.owner.id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <UserIcon size={12} />
                      {canvas.owner.displayName || canvas.owner.username}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="mb-3 min-h-[24px]">
                  <div className="flex flex-wrap gap-1">
                    {canvas.tags?.map(({ tag }) => (
                      <div
                        key={tag.id}
                        className="tag-chip group/tag"
                      >
                        <TagIcon size={10} />
                        <span>{tag.name}</span>
                        {(canvas.owner.id === user?.id || canvas.owner.id !== user?.id) && (
                          <button
                            onClick={(e) => handleRemoveTag(canvas.id, tag.id, e)}
                            className="opacity-0 group-hover/tag:opacity-100 hover:text-[color:var(--coral-deep)] transition-opacity"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add Tag Button/Input */}
                    {!showTagInput[canvas.id] ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTagInput({ ...showTagInput, [canvas.id]: true });
                        }}
                        className="px-2.5 py-0.5 rounded-full text-xs font-body font-bold flex items-center gap-1 text-[color:var(--ink-soft)] bg-[color:color-mix(in_srgb,var(--ink)_8%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ink)_14%,transparent)] transition-colors"
                        title="Add tag"
                      >
                        <Plus size={10} />
                        Tag
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          placeholder="tag name"
                          value={tagInputValue}
                          onChange={(e) => setTagInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddTag(canvas.id, tagInputValue);
                            } else if (e.key === 'Escape') {
                              setShowTagInput({ ...showTagInput, [canvas.id]: false });
                              setTagInputValue('');
                            }
                          }}
                          className="sketch-input !w-24 !px-2 !py-0.5 !text-xs"
                          autoFocus
                          disabled={addingTag}
                        />
                        <button
                          onClick={() => handleAddTag(canvas.id, tagInputValue)}
                          disabled={addingTag || !tagInputValue.trim()}
                          className="text-[color:var(--coral)] hover:text-[color:var(--coral-deep)] disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setShowTagInput({ ...showTagInput, [canvas.id]: false });
                            setTagInputValue('');
                          }}
                          className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-[color:color-mix(in_srgb,var(--ink)_10%,transparent)]">
                  <button
                    onClick={(e) => handleDuplicate(canvas.id, e)}
                    className="flex-1 py-2 px-3 rounded-md flex items-center justify-center gap-1 text-sm font-body font-bold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ink)_12%,transparent)] transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={14} />
                    Copy
                  </button>

                  {canvas.owner.id === user?.id && (
                    <button
                      onClick={(e) => handleDelete(canvas.id, e)}
                      className="py-2 px-3 rounded-md flex items-center justify-center text-[#c0392b] bg-[color:color-mix(in_srgb,#c0392b_10%,transparent)] hover:bg-[color:color-mix(in_srgb,#c0392b_20%,transparent)] transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
