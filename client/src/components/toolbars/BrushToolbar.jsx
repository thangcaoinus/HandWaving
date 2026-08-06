import React from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { Pencil, Wand2, Shapes, Lasso, BoxSelect, Type } from "lucide-react";

export default function BrushToolbar() {
  const { brushType, updateBrushType } = useAppState();

  const brushTypes = [
    { id: 1, Icon: Pencil, label: "Freehand Drawing" },
    { id: 2, Icon: Wand2, label: "Smart Shapes" },
    { id: 3, Icon: Shapes, label: "Insert Shape" },
    { id: 4, Icon: BoxSelect, label: "Rectangle Select" },
    { id: 5, Icon: Lasso, label: "Lasso Select" },
    { id: 6, Icon: Type, label: "Text Tool" },
  ];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 paper-card sketch-panel border-2 border-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] px-3 py-3 flex items-center justify-center gap-2 z-10 max-w-fit">
      {brushTypes.map((brush) => {
        const Icon = brush.Icon;
        return (
          <button
            key={brush.id}
            className={`sketch-button flex w-10 h-10 items-center justify-center transition-all duration-150 border-2 ${
              brushType === brush.id
                ? "text-white shadow-md border-[color:var(--coral)] scale-105"
                : "bg-[color:color-mix(in_srgb,var(--ink)_5%,transparent)] text-[color:var(--ink-soft)] hover:text-[color:var(--coral)] border-transparent hover:border-[color:color-mix(in_srgb,var(--coral)_40%,transparent)] hover:shadow-sm active:translate-y-0"
            }`}
            style={brushType === brush.id ? { backgroundColor: 'var(--coral)' } : {}}
            onClick={() => updateBrushType(brush.id)}
            title={brush.label}
          >
            <Icon size={20} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}
