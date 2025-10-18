import React from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { Palette, Pencil, Minus } from "lucide-react";

export default function PropertiesSidebar() {
  const {
    brushSettings,
    updateBrushColor,
    updateBrushWidth,
    updateLineDash,
    brushType,
  } = useAppState();

  // Only show sidebar for drawing and shape tools (brush types 1, 2, and 3)
  const shouldShow = brushType === 1 || brushType === 2 || brushType === 3;

  if (!shouldShow) return null;

  const colorPresets = [
    { name: "Black", value: "#000000" },
    { name: "Gray", value: "#6B7280" },
    { name: "Red", value: "#EF4444" },
    { name: "Orange", value: "#F97316" },
    { name: "Yellow", value: "#EAB308" },
    { name: "Green", value: "#22C55E" },
    { name: "Blue", value: "#3B82F6" },
    { name: "Indigo", value: "#6366F1" },
    { name: "Purple", value: "#A855F7" },
    { name: "Pink", value: "#EC4899" },
  ];

  const widthOptions = [
    { value: 1, label: "Thin", size: 2 },
    { value: 2, label: "Medium", size: 4 },
    { value: 3, label: "Thick", size: 6 },
    { value: 4, label: "Extra", size: 8 },
  ];

  return (
    <div className="fixed left-4 top-24 w-52 bg-white sketch-panel border-2 border-black/5 p-3 z-10">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3 pb-2 border-b-2 border-dashed border-gray-200">
        <Palette size={14} strokeWidth={2.5} style={{ color: '#f08080' }} />
        <h3 className="text-sm font-bold text-gray-800">
          {brushType === 1 ? "Draw" : brushType === 2 ? "Smart Shape" : "Insert Shape"}
        </h3>
      </div>

      {/* Color Picker Section */}
      <div className="mb-3">
        <label className="flex items-center gap-1 text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#f08080' }}></span>
          Color
        </label>
        
        {/* Color Presets Grid */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {colorPresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => updateBrushColor(preset.value)}
              className={`w-full aspect-square rounded-md transition-all duration-150 hover:scale-110 hover:shadow-md border-2 ${
                brushSettings.color.toUpperCase() === preset.value.toUpperCase()
                  ? "shadow-md scale-105"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={{ 
                backgroundColor: preset.value,
                borderColor: brushSettings.color.toUpperCase() === preset.value.toUpperCase() ? '#f08080' : undefined
              }}
              title={preset.name}
            />
          ))}
        </div>

        {/* Custom Color Picker */}
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1.5 border-2 transition-colors" style={{
          borderColor: '#fbc4ab'
        }}>
          <input
            type="color"
            value={brushSettings.color}
            onChange={(e) => updateBrushColor(e.target.value)}
            className="w-8 h-8 rounded-md cursor-pointer border-2 border-white shadow-sm"
          />
          <div className="flex-1">
            <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide mb-0.5">
              Custom
            </div>
            <div className="text-[10px] text-gray-700 font-mono font-bold">
              {brushSettings.color.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Stroke Width Section */}
      <div className="mb-3">
        <label className="flex items-center gap-1 text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#f08080' }}></span>
          Width
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {widthOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateBrushWidth(option.value)}
              className={`sketch-button flex flex-col items-center justify-center px-2 py-1.5 transition-all duration-150 border-2 ${
                brushSettings.width === option.value
                  ? "shadow-sm sketch-active"
                  : "bg-gray-50 border-gray-200"
              }`}
              style={brushSettings.width === option.value ? { 
                backgroundColor: '#ffdab9',
                borderColor: '#f08080',
                color: '#ffffff'
              } : {}}
            >
              <span className={`text-[10px] font-bold mb-1 ${
                brushSettings.width === option.value ? 'text-white' : 'text-gray-700'
              }`}>
                {option.label}
              </span>
              <div
                className="rounded-full"
                style={{
                  width: `${option.size}px`,
                  height: `${option.size}px`,
                  backgroundColor: brushSettings.width === option.value ? '#ffffff' : '#1f2937'
                }}
              ></div>
            </button>
          ))}
        </div>
      </div>

      {/* Line Style Section */}
      <div className="pt-2 border-t-2 border-dashed border-gray-200">
        {/* Line Dash Pattern */}
        <label className="flex items-center gap-1 text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
          <Minus size={10} className="text-gray-700" />
          Line Style
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: "solid", label: "Solid", preview: "───" },
            { value: "dashed", label: "Dashed", preview: "─ ─" },
            { value: "dotted", label: "Dotted", preview: "· · ·" },
          ].map((style) => (
            <button
              key={style.value}
              onClick={() => updateLineDash(style.value)}
              className={`px-2 py-2 text-xs font-medium rounded-md transition-all duration-150 border-2 ${
                brushSettings.lineDash === style.value
                  ? "shadow-md scale-105 text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
              }`}
              style={brushSettings.lineDash === style.value ? { backgroundColor: '#f08080', borderColor: '#f08080' } : {}}
              title={style.label}
            >
              <div className="text-base leading-none mb-0.5 overflow-hidden">{style.preview}</div>
              <div className="text-[9px] opacity-80">{style.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
