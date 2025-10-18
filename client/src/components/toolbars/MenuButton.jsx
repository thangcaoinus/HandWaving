import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useViewportContext } from "../../contexts/ViewportContext";
import { useAppState } from "../../contexts/AppStateContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCanvasPersistence } from "../../contexts/CanvasPersistenceContext";
import { useImportStrokes } from "../../hooks/useImportStrokes";
import { exportToPNG, exportToPDF, exportToJSON } from "../../utils/exportCanvas";
import { triggerImportDialog } from "../../utils/importCanvas";
import { ConfirmModal, AlertModal } from '../modals/Modal';
import { Menu, Image, FileText, Save, Grid3x3, LayoutGrid, Upload, Download, Eye, CheckCircle, AlertCircle } from "lucide-react";
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
  const { allStrokesRef, operationManagerRef } = useCanvasContext();
  const { viewport, setZoom, setPan } = useViewportContext();
  const { showGrid, toggleGrid } = useAppState();
  const { user } = useAuth();
  const { isOwner, canEdit } = useCanvasPersistence();
  const navigate = useNavigate();
  
  // Initialize import hook
  const { importStrokes } = useImportStrokes(operationManagerRef.current, allStrokesRef);

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

  const handleExport = (format) => {
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

    switch (format) {
      case "png":
        exportToPNG(strokes, `${filename}.png`);
        break;
      case "pdf":
        exportToPDF(strokes, `${filename}.pdf`);
        break;
      case "json":
        exportToJSON(strokes, viewport, `${filename}.json`);
        break;
      default:
        logger.error("Unknown export format:", format);
    }

    setIsOpen(false);
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
      {/* Menu Button */}
      <button
        className="w-10 h-10 bg-white hover:bg-gray-50 sketch-panel border-2 border-black/5 flex items-center justify-center transition-all duration-150 sketch-button active:scale-95"
        title="Menu (Export, Settings, etc.)"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Menu size={18} strokeWidth={2.5} className="text-gray-700" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-12 left-0 bg-white sketch-panel border-2 border-black/5 py-2 min-w-[220px] overflow-hidden">
          {/* Brand Header */}
          <div className="px-4 py-3 mb-2 border-b border-gray-200">
            <div className="text-2xl font-bold" style={{ fontFamily: 'Comic Sans MS, cursive', color: '#f8ad9d' }}>
              <span className="inline-block -rotate-1">HandWaving</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">Collaborative Whiteboard</div>
          </div>

          {/* Gallery Link (only show if authenticated and not a guest) */}
          {user && !user.isGuest && (
            <button
              onClick={() => {
                navigate('/gallery');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <LayoutGrid size={16} strokeWidth={2.5} className="text-gray-500 group-hover:text-indigo-600" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-800">My Canvases</div>
                <div className="text-[10px] text-gray-500">View all saved canvases</div>
              </div>
            </button>
          )}

          {user && !user.isGuest && <div className="h-px bg-gray-200 my-2" />}

          {/* Grid Toggle */}
          <button
            onClick={() => {
              toggleGrid();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors group"
            style={{
              backgroundColor: showGrid ? '#ffdab9' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!showGrid) e.currentTarget.style.backgroundColor = '#ffdab9';
            }}
            onMouseLeave={(e) => {
              if (!showGrid) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              showGrid ? "text-white" : "bg-gray-100 text-gray-500"
            }`} style={showGrid ? { backgroundColor: '#f08080' } : {}}>
              <Grid3x3 size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-800">
                {showGrid ? "Hide Grid" : "Show Grid"}
              </div>
              <div className="text-[10px] text-gray-500">
                Toggle canvas grid
              </div>
            </div>
          </button>

          <div className="h-px bg-gray-200 my-2" />

          {/* Import Button - Only show if user can edit */}
          {canEdit && (
            <button
              onClick={handleImport}
              className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <Upload size={16} strokeWidth={2.5} className="text-gray-500 group-hover:text-indigo-600" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-800">Import JSON</div>
                <div className="text-[10px] text-gray-500">Load saved canvas</div>
              </div>
            </button>
          )}

          <div className="h-px bg-gray-200 my-2" />

          {/* Export Section Header */}
          <div className="px-4 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Export
          </div>

          <button
            onClick={() => handleExport("png")}
            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
          >
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <Image size={16} strokeWidth={2.5} className="text-gray-500 group-hover:text-indigo-600" />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-800">PNG Image</div>
              <div className="text-[10px] text-gray-500">Raster format</div>
            </div>
          </button>

          <button
            onClick={() => handleExport("pdf")}
            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
          >
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <FileText size={16} strokeWidth={2.5} className="text-gray-500 group-hover:text-indigo-600" />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-800">PDF Document</div>
              <div className="text-[10px] text-gray-500">For printing</div>
            </div>
          </button>

          <button
            onClick={() => handleExport("json")}
            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
          >
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <Save size={16} strokeWidth={2.5} className="text-gray-500 group-hover:text-indigo-600" />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-800">JSON Data</div>
              <div className="text-[10px] text-gray-500">Editable format</div>
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
