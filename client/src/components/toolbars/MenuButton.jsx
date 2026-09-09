import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useViewportContext } from "../../contexts/ViewportContext";
import { useAppState } from "../../contexts/AppStateContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCanvasPersistence } from "../../contexts/CanvasPersistenceContext";
import { useImportStrokes } from "../../hooks/useImportStrokes";
import { useImageInsert } from "../../hooks/useImageInsert";
import { exportToPNG, exportToPDF, exportToJSON } from "../../utils/exportCanvas";
import { triggerImportDialog } from "../../utils/importCanvas";
import { ConfirmModal, AlertModal } from '../modals/Modal';
import { Menu, Image, ImagePlus, FileText, Save, Grid3x3, LayoutGrid, Upload, Download, Eye, CheckCircle, AlertCircle } from "lucide-react";
import { logger } from "../../utils/logger";

export default function MenuButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showViewportModal, setShowViewportModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [importData, setImportData] = useState(null);
  const menuRef = useRef(null);
  const imageInputRef = useRef(null);
  const { allStrokesRef, operationManagerRef, canvasRef } = useCanvasContext();
  const { viewport, setZoom, setPan } = useViewportContext();
  const { showGrid, toggleGrid } = useAppState();
  const { user } = useAuth();
  const { isOwner, canEdit } = useCanvasPersistence();
  const navigate = useNavigate();

  // Initialize import hook
  const { importStrokes } = useImportStrokes(operationManagerRef.current, allStrokesRef);

  // Image insertion (shared logic with the paste path); errors surface via the existing error modal.
  const { insertImageFromBlob } = useImageInsert(
    () => operationManagerRef.current,
    allStrokesRef,
    viewport,
    canvasRef,
    (msg) => { setModalMessage(msg); setShowErrorModal(true); }
  );

  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) { setModalMessage('Please choose an image file.'); setShowErrorModal(true); return; }
    if (file.size > 15 * 1024 * 1024) { setModalMessage('Image is too large (max 15MB).'); setShowErrorModal(true); return; }
    setIsOpen(false);
    await insertImageFromBlob(file); // no center → viewport center
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleExport = async (format) => {
    // Convert Map to array for export
    const strokes = allStrokesRef?.current
      ? Array.from(allStrokesRef.current.values())
      : [];

    if (!strokes || strokes.length === 0) {
      setModalMessage("No strokes to export. Draw something first!");
      setShowErrorModal(true);
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `canvas-${timestamp}`;

    // Close the menu right away; PNG/PDF export is async (KaTeX/Markdown rasters + fonts).
    setIsOpen(false);

    try {
      switch (format) {
        case "png":
          await exportToPNG(strokes, `${filename}.png`);
          break;
        case "pdf":
          await exportToPDF(strokes, `${filename}.pdf`);
          break;
        case "json":
          exportToJSON(strokes, viewport, `${filename}.json`);
          break;
        default:
          logger.error("Unknown export format:", format);
      }
    } catch (error) {
      logger.error("Export failed:", format, error);
      setModalMessage("Export failed. Please try again.");
      setShowErrorModal(true);
    }
  };

  const handleImport = () => {
    triggerImportDialog(
      (data) => {
        setImportData(data);
        setShowImportModal(true);
      },
      (error) => {
        setModalMessage(error);
        setShowErrorModal(true);
      }
    );
  };

  const confirmImport = (shouldReplace) => {
    if (!importData || !operationManagerRef.current) {
      setModalMessage('Import system not ready. Please try again.');
      setShowErrorModal(true);
      return;
    }

    try {
      // Use the import hook which handles operations properly
      const result = importStrokes(importData.strokes, { shouldReplace });
      
      logger.log(`✅ Import complete: ${result.imported} strokes`);

      // Check if there's viewport data
      if (importData.viewport) {
        // Store count before clearing importData
        setModalMessage(`Successfully imported ${result.imported} strokes!`);
        setShowViewportModal(true);
      } else {
        finishImport(result.imported);
      }
    } catch (error) {
      logger.error('Import error:', error);
      setModalMessage(error.message || 'Failed to import strokes');
      setShowErrorModal(true);
      setImportData(null);
    }
  };

  const applyViewport = (shouldApply) => {
    if (shouldApply && importData?.viewport) {
      if (setZoom && importData.viewport.zoom) {
        setZoom(importData.viewport.zoom);
      }
      if (setPan && importData.viewport.pan) {
        setPan(importData.viewport.pan);
      }
    }
    // Message already set, just show modal
    setShowSuccessModal(true);
    setImportData(null);
    setIsOpen(false);
  };

  const finishImport = (count) => {
    // operationManager already triggered redraw, just show success
    setModalMessage(`Successfully imported ${count} strokes!`);
    setShowSuccessModal(true);
    setImportData(null);
    setIsOpen(false);
  };

  return (
    <div className="fixed top-4 left-4 z-20" ref={menuRef}>
      {/* Hidden file input for image insertion */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleImageFileSelect}
        className="hidden"
      />
      {/* Menu Button */}
      <button
        className="w-10 h-10 paper-card hover:brightness-[0.97] sketch-panel border-2 border-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] flex items-center justify-center transition-all duration-150 sketch-button active:scale-95"
        title="Menu (Export, Settings, etc.)"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Menu size={18} strokeWidth={2.5} className="text-[color:var(--ink)]" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-12 left-0 paper-card sketch-panel border-2 border-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] py-2 min-w-[220px] overflow-hidden">
          {/* Brand Header */}
          <div className="px-4 py-3 mb-2 border-b border-[color:color-mix(in_srgb,var(--ink)_10%,transparent)]">
            <div className="font-display text-2xl text-[color:var(--coral)]">
              <span className="inline-block -rotate-1">HandWaving</span>
            </div>
            <div className="text-[10px] text-[color:var(--ink-soft)] mt-1">Collaborative Whiteboard</div>
          </div>

          {/* Gallery Link (only show if authenticated and not a guest) */}
          {user && !user.isGuest && (
            <button
              onClick={() => {
                navigate('/gallery');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
                <LayoutGrid size={16} strokeWidth={2.5} className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]" />
              </div>
              <div>
                <div className="font-bold text-sm text-[color:var(--ink)]">My Canvases</div>
                <div className="text-[10px] text-[color:var(--ink-soft)]">View all saved canvases</div>
              </div>
            </button>
          )}

          {user && !user.isGuest && <div className="h-px bg-[color:color-mix(in_srgb,var(--ink)_10%,transparent)] my-2" />}

          {/* Grid Toggle */}
          <button
            onClick={() => {
              toggleGrid();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors group"
            style={{
              backgroundColor: showGrid ? 'color-mix(in srgb, var(--coral) 14%, transparent)' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!showGrid) e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--coral) 10%, transparent)';
            }}
            onMouseLeave={(e) => {
              if (!showGrid) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              showGrid ? "text-white" : "text-[color:var(--ink-soft)]"
            }`} style={showGrid ? { backgroundColor: 'var(--coral)' } : { backgroundColor: 'color-mix(in srgb, var(--ink) 7%, transparent)' }}>
              <Grid3x3 size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-bold text-sm text-[color:var(--ink)]">
                {showGrid ? "Hide Grid" : "Show Grid"}
              </div>
              <div className="text-[10px] text-[color:var(--ink-soft)]">
                Toggle canvas grid
              </div>
            </div>
          </button>

          <div className="h-px bg-[color:color-mix(in_srgb,var(--ink)_10%,transparent)] my-2" />

          {/* Insert Image - Only show if user can edit */}
          {canEdit && (
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
                <ImagePlus size={16} strokeWidth={2.5} className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]" />
              </div>
              <div>
                <div className="font-bold text-sm text-[color:var(--ink)]">Insert Image</div>
                <div className="text-[10px] text-[color:var(--ink-soft)]">Add a picture to the canvas</div>
              </div>
            </button>
          )}

          {/* Import Button - Only show if user can edit */}
          {canEdit && (
            <button
              onClick={handleImport}
              className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
                <Upload size={16} strokeWidth={2.5} className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]" />
              </div>
              <div>
                <div className="font-bold text-sm text-[color:var(--ink)]">Import JSON</div>
                <div className="text-[10px] text-[color:var(--ink-soft)]">Load saved canvas</div>
              </div>
            </button>
          )}

          <div className="h-px bg-[color:color-mix(in_srgb,var(--ink)_10%,transparent)] my-2" />

          {/* Export Section Header */}
          <div className="px-4 py-1.5 text-[10px] font-bold text-[color:var(--ink-soft)] uppercase tracking-wider">
            Export
          </div>

          <button
            onClick={() => handleExport("png")}
            className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
              <Image size={16} strokeWidth={2.5} className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]" />
            </div>
            <div>
              <div className="font-bold text-sm text-[color:var(--ink)]">PNG Image</div>
              <div className="text-[10px] text-[color:var(--ink-soft)]">Raster format</div>
            </div>
          </button>

          <button
            onClick={() => handleExport("pdf")}
            className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
              <FileText size={16} strokeWidth={2.5} className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]" />
            </div>
            <div>
              <div className="font-bold text-sm text-[color:var(--ink)]">PDF Document</div>
              <div className="text-[10px] text-[color:var(--ink-soft)]">For printing</div>
            </div>
          </button>

          <button
            onClick={() => handleExport("json")}
            className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
              <Save size={16} strokeWidth={2.5} className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]" />
            </div>
            <div>
              <div className="font-bold text-sm text-[color:var(--ink)]">JSON Data</div>
              <div className="text-[10px] text-[color:var(--ink-soft)]">Editable format</div>
            </div>
          </button>
        </div>
      )}

      {/* Import Modal - Replace or Merge */}
      <ConfirmModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportData(null);
        }}
        onConfirm={() => confirmImport(true)}
        onCancel={isOwner ? () => confirmImport(false) : undefined}
        title="Import Canvas"
        icon={<Download size={28} />}
        message={
          isOwner
            ? `Import ${importData?.strokes.length || 0} strokes?\n\nClick Replace to CLEAR canvas and import\nClick Merge to ADD to current canvas`
            : `Import ${importData?.strokes.length || 0} strokes?\n\nStrokes will be MERGED with current canvas.\n(Only owners can replace the entire canvas)`
        }
        confirmText={isOwner ? "Replace" : "Merge"}
        cancelText={isOwner ? "Merge" : "Cancel"}
        confirmStyle={isOwner ? "danger" : "primary"}
      />

      {/* Viewport Restore Modal */}
      <ConfirmModal
        isOpen={showViewportModal}
        onClose={() => {
          setShowViewportModal(false);
          applyViewport(false);
        }}
        onConfirm={() => {
          setShowViewportModal(false);
          applyViewport(true);
        }}
        title="Restore Viewport"
        icon={<Eye size={28} />}
        message="Restore zoom and pan settings from the imported file?"
        confirmText="Yes, Restore"
        cancelText="No, Keep Current"
      />

      {/* Success Modal */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success"
        icon={<CheckCircle size={28} />}
        message={modalMessage}
      />

      {/* Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        icon={<AlertCircle size={28} />}
        message={modalMessage}
      />
    </div>
  );
}
