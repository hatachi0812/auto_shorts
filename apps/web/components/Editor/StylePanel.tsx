"use client";

export interface StyleJson {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
}

interface StylePanelProps {
  style: StyleJson;
  text: string;
  canvasH: number;
  onChange: (partial: Partial<StyleJson>) => void;
}

const FONT_FAMILIES = ["Arial", "Impact", "Georgia", "Verdana", "Courier New"];
const PRESET_COLORS = ["#FFFFFF", "#FFFF00", "#FF4444", "#44DDAA", "#FF88FF"];

export default function StylePanel({ style, text, canvasH, onChange }: StylePanelProps) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">자막 스타일 편집</h3>

      <div className="p-2 bg-black/30 rounded text-xs text-white/60 truncate leading-relaxed">
        &ldquo;{text}&rdquo;
      </div>

      {/* Font Size */}
      <div>
        <label className="flex justify-between text-xs text-white/50 mb-1.5">
          <span>글자 크기</span>
          <span className="font-mono text-white/70">{style.fontSize}px</span>
        </label>
        <input
          type="range"
          min="10"
          max="60"
          step="1"
          value={style.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">글자 색상</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border border-white/20 bg-transparent p-0.5"
          />
          <span className="text-xs text-white/40 font-mono">{style.color}</span>
          <div className="flex gap-1 ml-auto">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                title={c}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  style.color.toLowerCase() === c.toLowerCase()
                    ? "border-white scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">폰트</label>
        <select
          value={style.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Vertical Position */}
      <div>
        <label className="flex justify-between text-xs text-white/50 mb-1.5">
          <span>수직 위치</span>
          <span className="font-mono text-white/70">{Math.round((style.y / canvasH) * 100)}%</span>
        </label>
        <input
          type="range"
          min="0"
          max={canvasH - 10}
          step="1"
          value={style.y}
          onChange={(e) => onChange({ y: Number(e.target.value) })}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-xs text-white/20 mt-0.5">
          <span>상단</span>
          <span>하단</span>
        </div>
      </div>

      <p className="text-xs text-white/25 text-center">캔버스에서 드래그하여 위치 변경 가능</p>
    </div>
  );
}
