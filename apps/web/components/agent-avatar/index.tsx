/**
 * Agent Avatar component exports
 */

export { AvatarDisplay } from "./avatar-display";
export { AvatarDisplayFramed } from "./avatar-display-framed";
export { AvatarEditor } from "./avatar-editor";
export {
  EYES,
  EYEBROWS,
  NOSES,
  MOUTHS,
  COLOR_PRESETS,
  generateRandomAvatarConfig,
  getAvatarConfigByState,
} from "./constants";
export {
  AVATAR_SHAPE_PRESETS,
  DEFAULT_AVATAR_SHAPE_ID,
  getAvatarShapePreset,
} from "./shape-presets";
export { mergeAvatarConfig } from "./utils";
export { AvatarState } from "./types";
export {
  loadAvatarConfigFromStorage,
  saveAvatarConfigToStorage,
  clearAvatarConfigFromStorage,
  loadAssistantNameFromStorage,
  saveAssistantNameToStorage,
} from "./utils";
export type {
  AvatarConfiguration,
  AvatarShapePreset,
  ColorPreset,
  SvgPath,
  FeatureType,
  Tab,
} from "./types";
export type { AvatarState as AvatarStateType } from "./types";
