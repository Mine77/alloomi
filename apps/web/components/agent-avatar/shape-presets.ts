/**
 * Avatar silhouette presets — paths in 0 0 100 100 unless pathSourceWidth/Height is set.
 * Add Figma-export paths here as they become available.
 */

import type { AvatarShapePreset } from "./types";

/** Default silhouette when shapeId is missing or unknown */
export const DEFAULT_AVATAR_SHAPE_ID = "four-lobe";

/**
 * Preset silhouettes for clipPath / export clipping.
 * Paths are closed fills in userSpace 0–100 coordinates.
 */
export const AVATAR_SHAPE_PRESETS: AvatarShapePreset[] = [
  {
    id: "circle",
    labelKey: "agentAvatar.shapes.circle",
    label: "Circle",
    viewBox: "0 0 100 100",
    path: "M50 2a48 48 0 1 1 0 96a48 48 0 1 1 0-96z",
  },
  /** 151x151 four-lobe flower export; scaled via pathSource into 0-100 avatar coordinate system */
  {
    id: "four-lobe",
    labelKey: "agentAvatar.shapes.fourLobe",
    label: "Four-lobe",
    viewBox: "0 0 100 100",
    pathSourceWidth: 151,
    pathSourceHeight: 151,
    path: "M39.233 1.09339e-06C55.2195 -0.00372417 68.9592 9.51211 75.0142 23.209C75.0706 23.3255 75.1218 23.4437 75.1705 23.5625C75.2051 23.468 75.2425 23.3748 75.2808 23.2822C81.429 9.66417 95.222 0.037499 111.148 0.0742198C132.82 -0.0107225 150.42 17.5332 150.311 39.1494C150.286 55.1513 140.737 68.8402 127.06 74.9648C126.924 75.0331 126.786 75.093 126.647 75.1504C126.815 75.2086 126.983 75.2706 127.149 75.3379C140.848 81.4314 150.358 95.1731 150.336 111.068C150.267 132.711 132.706 150.255 111.088 150.314C95.106 150.373 81.3961 140.834 75.2603 127.115C75.2187 127.023 75.1791 126.93 75.1422 126.836C75.112 126.917 75.0813 126.998 75.0484 127.077C68.9002 140.695 55.1072 150.321 39.1812 150.284C17.5097 150.369 -0.00166704 132.774 0.0181437 111.209C0.0431328 95.207 9.59352 81.5192 23.2701 75.3945C23.3931 75.3406 23.5199 75.2888 23.65 75.2402C23.4686 75.1775 23.288 75.108 23.1099 75.0293C9.50721 68.8649 -0.0848251 55.1741 0.000565584 39.2979C0.0294433 17.6389 17.5497 0.031474 39.233 1.09339e-06Z",
  },
  {
    id: "double-pill",
    labelKey: "agentAvatar.shapes.doublePill",
    label: "Double pill",
    viewBox: "0 0 100 100",
    pathSourceWidth: 480,
    pathSourceHeight: 480,
    path: "M447.9 240c20.4-17.6 32.1-38.1 32.1-60 0-66.3-107.5-120-240-120S0 113.7 0 180c0 21.9 11.7 42.4 32.1 60C11.7 257.6 0 278.1 0 300c0 66.3 107.5 120 240 120s240-53.7 240-120c0-21.9-11.7-42.4-32.1-60Z",
  },
  {
    id: "triple-pill",
    labelKey: "agentAvatar.shapes.triplePill",
    label: "Triple pill",
    viewBox: "0 0 100 100",
    pathSourceWidth: 480,
    pathSourceHeight: 480,
    path: "M480 240c0-21.9-11.7-42.4-32.1-60 20.4-17.6 32.1-38.1 32.1-60C480 53.7 372.6 0 240 0S0 53.7 0 120c0 21.9 11.7 42.4 32.1 60C11.7 197.7 0 218.1 0 240s11.7 42.4 32.1 60C11.7 317.6 0 338.1 0 360c0 66.3 107.5 120 240 120s240-53.7 240-120c0-21.9-11.7-42.4-32.1-60 20.4-17.6 32.1-38.1 32.1-60Z",
  },
  {
    id: "orbit-cross",
    labelKey: "agentAvatar.shapes.orbitCross",
    label: "Orbit cross",
    viewBox: "0 0 100 100",
    pathSourceWidth: 480,
    pathSourceHeight: 480,
    path: "M409.7 409.7c33.2-33.2 23.8-100.2-17.9-169.7 41.7-69.6 51.1-136.5 18-169.7C376.4 37 309.4 46.5 240 88.2 170.4 46.5 103.5 37 70.3 70.2 37 103.6 46.5 170.5 88.2 240c-41.7 69.5-51.1 136.5-18 169.7 33.3 33.2 100.2 23.8 169.8-17.9 69.5 41.7 136.5 51.1 169.7 18Z",
  },
  {
    id: "rounded-square-xl",
    labelKey: "agentAvatar.shapes.roundedSquareXl",
    label: "Rounded square XL",
    viewBox: "0 0 100 100",
    pathSourceWidth: 480,
    pathSourceHeight: 480,
    path: "M120 0h240a120 120 0 0 1 120 120v240a120 120 0 0 1-120 120H120A120 120 0 0 1 0 360V120A120 120 0 0 1 120 0z",
  },
  {
    id: "sun-gear",
    labelKey: "agentAvatar.shapes.sunGear",
    label: "Sun gear",
    viewBox: "0 0 100 100",
    pathSourceWidth: 480,
    pathSourceHeight: 480,
    path: "M450 210h-59.2l54.7-22.6a30 30 0 1 0-23-55.4L368 154.5l41.8-41.9a30 30 0 1 0-42.4-42.4L325.4 112l22.7-54.6a30 30 0 1 0-55.4-23L270 89.2V30a30 30 0 1 0-60 0v59.2l-22.7-54.7a30 30 0 1 0-55.4 23l22.6 54.6-41.8-41.8a30 30 0 1 0-42.4 42.4l41.8 41.9-54.7-22.7a30 30 0 1 0-23 55.4L89.3 210H30a30 30 0 1 0 0 60h59.2l-54.7 22.7a30 30 0 1 0 23 55.4l54.6-22.6-41.8 41.8a30 30 0 1 0 42.4 42.4l41.9-41.8-22.7 54.7a30 30 0 1 0 55.4 23l22.7-54.8V450a30 30 0 1 0 60 0v-59.2l22.7 54.7a30 30 0 1 0 55.4-23L325.5 368l41.8 41.8a30 30 0 1 0 42.4-42.4L368 325.4l54.7 22.7a30 30 0 1 0 23-55.4L390.7 270H450a30 30 0 1 0 0-60Z",
  },
  {
    id: "arch",
    labelKey: "agentAvatar.shapes.arch",
    label: "Arch",
    viewBox: "0 0 100 100",
    pathSourceWidth: 480,
    pathSourceHeight: 480,
    path: "M437.3 158.3A99.5 99.5 0 0 0 321.6 42.8a99.5 99.5 0 0 0-163.4 0A99.5 99.5 0 0 0 42.7 158.3a99.5 99.5 0 0 0 0 163.4 99.5 99.5 0 0 0 115.6 115.6 99.5 99.5 0 0 0 163.4 0 99.5 99.5 0 0 0 115.5-115.6 99.5 99.5 0 0 0 0-163.4Z",
  },
];

/**
 * Resolve a silhouette preset by id, falling back to the default circle.
 */
export function getAvatarShapePreset(
  shapeId: string | undefined | null,
): AvatarShapePreset {
  if (shapeId) {
    const found = AVATAR_SHAPE_PRESETS.find((s) => s.id === shapeId);
    if (found) return found;
  }
  return AVATAR_SHAPE_PRESETS[0];
}
