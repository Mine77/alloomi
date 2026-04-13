/**
 * Agent Avatar feature type definitions
 * Used for AI assistant avatar generation and configuration
 */

/**
 * Facial feature type enumeration
 */
export enum FeatureType {
  EYES = "EYES",
  EYEBROWS = "EYEBROWS",
  NOSE = "NOSE",
  MOUTH = "MOUTH",
}

/**
 * Avatar silhouette preset (clip path in unified viewBox coordinates)
 */
export interface AvatarShapePreset {
  /** Unique identifier */
  id: string;
  /** i18n key for label */
  labelKey: string;
  /** Fallback label when i18n missing */
  label: string;
  /** Closed SVG path `d` (see pathSourceWidth/Height for non–100×100 exports) */
  path: string;
  /** SVG viewBox for thumbnails (editor grid); use 0 0 100 100 when path is in 100-space */
  viewBox: string;
  /**
   * When both set, `path` is in 0..width / 0..height space (e.g. Figma 480×480);
   * clip/export scale to the shared 0–100 avatar coordinate system.
   */
  pathSourceWidth?: number;
  pathSourceHeight?: number;
}

/**
 * SVG path configuration interface
 */
export interface SvgPath {
  /** Unique identifier */
  id: string;
  /** SVG path d attribute */
  path: string;
  /** SVG viewBox attribute */
  viewBox?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Display label */
  label: string;
}

/**
 * Avatar configuration interface
 */
export interface AvatarConfiguration {
  /** Eye ID */
  eyesId: string;
  /** Eyebrow ID */
  eyebrowsId: string;
  /** Nose ID */
  noseId: string;
  /** Mouth ID */
  mouthId: string;
  /** Color preset ID */
  colorPresetId: string;
  /**
   * Silhouette preset id (see AVATAR_SHAPE_PRESETS).
   * Omit when loading legacy stored config; consumers should treat missing as "circle".
   */
  shapeId?: string;
  /** Custom texture URL (AI generated) */
  customTextureUrl?: string | null;
  /** Whether to show border */
  showBorder: boolean;
}

/**
 * Color preset interface
 */
export interface ColorPreset {
  /** Unique identifier */
  id: string;
  /** i18n translation key for display label */
  labelKey: string;
  /** Fallback display label (used when i18n is not available) */
  label: string;
  /** CSS class names for gradient effects */
  gradientClasses: string[];
  /** Main color CSS class name */
  mainColor: string;
  /** Editor chip: flat fill only (no decorative gradient orbs) */
  editorFlatFill?: boolean;
}

/**
 * Avatar editor tab enumeration
 */
export enum Tab {
  HEAD = "HEAD",
  FACE = "FACE",
}

/**
 * Avatar state enumeration
 */
export enum AvatarState {
  /** Default state */
  DEFAULT = "default",
  /** Refreshing/Thinking */
  REFRESHING = "refreshing",
  /** In conversation (wise dialogue partner) */
  CONVERSATION = "conversation",
}
