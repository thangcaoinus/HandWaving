import React from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { Square, Circle, Triangle, Minus, ArrowRight, Redo } from "lucide-react";

export default function ShapePickerPanel() {
  const { brushType, insertShapeType, updateInsertShapeType } = useAppState();

  // Only show panel for brush type 3 (Insert Shape)
  if (brushType !== 3) return null;

  const shapes = [
    { id: "rectangle", Icon: Square, label: "Rectangle" },
    { id: "circle", Icon: Circle, label: "Circle" },
    { id: "triangle", Icon: Triangle, label: "Triangle" },
    { id: "line", Icon: Minus, label: "Line" },
    { id: "arrow", Icon: ArrowRight, label: "Arrow" },
    { id: "curved-arrow", Icon: Redo, label: "Curved Arrow" },
  ];

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-white sketch-panel border-2 border-black/5 px-3 py-2.5 z-20 flex items-center gap-2 max-w-fit">
      <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Shape:</span>
      {shapes.map((shape) => {
        const Icon = shape.Icon;
        return (
          <button
            key={shape.id}
            onClick={() => updateInsertShapeType(shape.id)}
            className={`w-8 h-8 sketch-button transition-all duration-150 flex items-center justify-center border-2 ${
              insertShapeType === shape.id
                ? "text-white shadow-md border-[#f08080]"
                : "bg-gray-50 text-gray-600 hover:text-[#f08080] border-transparent hover:border-[#fbc4ab]"
            }`}
            style={insertShapeType === shape.id ? { backgroundColor: '#f08080' } : {}}
            title={shape.label}
          >
            <Icon size={16} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}
