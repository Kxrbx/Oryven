import { cn } from "@/utils/cn";
import { ColorDot } from "./ColorDot";
import type { ColorKey } from "@/types";

interface ProjectMarkerProps {
  color: ColorKey;
  emoji?: string;
  size?: "sm" | "md";
}

/**
 * Inline marker rendered at the start of each project nav-item.
 *
 * When the project has an emoji, the marker is a small `swatch` tile
 * (rounded square, colored background soft-tint, emoji tile centered).
 * When no emoji is set, it falls back to a single 6px ColorDot, matching
 * the pre-v0.3.0 render.
 *
 * The emoji font stack is set explicitly so platform-native color emoji
 * render uniformly on Windows (Segoe UI Emoji), macOS (Apple Color Emoji),
 * and Linux (Noto Color Emoji). Without this declaration, browsers often
 * fall back to black-and-white outline emoji glyphs on some OSes.
 */
export function ProjectMarker({ color, emoji, size = "sm" }: ProjectMarkerProps) {
  if (emoji && emoji.length > 0) {
    const tileSize = size === "md" ? 20 : 16;
    return (
      <span
        className={cn("pm-tile", `pm-soft-${color}`)}
        style={{
          width: tileSize,
          height: tileSize,
          fontSize: size === "md" ? 13 : 11,
        }}
        aria-hidden
      >
        <span className="pm-emoji">{emoji}</span>
      </span>
    );
  }
  return <ColorDot color={color} size="sm" />;
}
