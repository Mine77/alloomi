import type { SVGProps } from "react";
import type { AvatarShapePreset } from "./types";

/**
 * Uniform scale from optional Figma/source size into the 0–100 avatar space.
 */
export function getAvatarShapePathScale(shape: AvatarShapePreset): number {
  const w = shape.pathSourceWidth;
  const h = shape.pathSourceHeight;
  if (w != null && h != null && w > 0 && h > 0) {
    return 100 / w;
  }
  return 1;
}

/**
 * Renders silhouette path in the shared 0–100 coordinate system (path `transform` when exported at another size).
 * Uses `transform` on `<path>` instead of a wrapping `<g>` so clipPath works in Chromium/WebKit (some builds ignore `<g>` inside clipPath).
 */
export function AvatarShapePathInHundred({
  shape,
  transform: userTransform,
  ...pathProps
}: {
  shape: AvatarShapePreset;
} & SVGProps<SVGPathElement>) {
  const s = getAvatarShapePathScale(shape);
  const transform =
    s === 1
      ? userTransform
      : userTransform != null && String(userTransform).length > 0
        ? `${userTransform} scale(${s})`
        : `scale(${s})`;
  return <path d={shape.path} transform={transform} {...pathProps} />;
}
