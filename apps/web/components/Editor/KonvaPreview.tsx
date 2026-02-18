"use client";

import { Stage, Layer, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { StyleJson } from "./StylePanel";

export const CANVAS_W = 270;
export const CANVAS_H = 480;

interface SubtitleItem {
  id: number;
  text: string;
  start_time: number;
  end_time: number;
  parsedStyle: StyleJson;
}

interface KonvaPreviewProps {
  subtitles: SubtitleItem[];
  currentTime: number;
  selectedId: number | null;
  onDragEnd: (id: number, x: number, y: number) => void;
  onSelect: (id: number) => void;
}

export default function KonvaPreview({
  subtitles,
  currentTime,
  selectedId,
  onDragEnd,
  onSelect,
}: KonvaPreviewProps) {
  const visible = subtitles.filter((sub) => {
    const isActive = currentTime >= sub.start_time && currentTime <= sub.end_time;
    const isSelected = sub.id === selectedId;
    return isActive || isSelected;
  });

  return (
    <Stage width={CANVAS_W} height={CANVAS_H}>
      <Layer>
        {/* Background */}
        <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#111111" />

        {/* Safe-area guide lines (subtle) */}
        <Rect
          x={CANVAS_W * 0.05}
          y={CANVAS_H * 0.05}
          width={CANVAS_W * 0.9}
          height={CANVAS_H * 0.9}
          stroke="#ffffff"
          strokeWidth={0.5}
          opacity={0.06}
          listening={false}
        />

        {/* Placeholder when no subtitle active */}
        {visible.length === 0 && (
          <Text
            x={0}
            y={CANVAS_H / 2 - 16}
            width={CANVAS_W}
            align="center"
            text={"재생하거나\n자막을 선택하세요"}
            fontSize={11}
            fill="#333333"
            lineHeight={1.6}
            listening={false}
          />
        )}

        {/* Subtitle texts */}
        {visible.map((sub) => {
          const isSelected = sub.id === selectedId;
          return (
            <Text
              key={sub.id}
              text={sub.text}
              x={sub.parsedStyle.x}
              y={sub.parsedStyle.y}
              fontSize={sub.parsedStyle.fontSize}
              fill={sub.parsedStyle.color}
              fontFamily={sub.parsedStyle.fontFamily}
              fontStyle="bold"
              draggable
              shadowColor="black"
              shadowBlur={10}
              shadowOpacity={1}
              stroke={isSelected ? "#a855f7" : undefined}
              strokeWidth={isSelected ? 1 : 0}
              onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                onDragEnd(sub.id, e.target.x(), e.target.y());
              }}
              onClick={() => onSelect(sub.id)}
              onTap={() => onSelect(sub.id)}
            />
          );
        })}
      </Layer>
    </Stage>
  );
}
