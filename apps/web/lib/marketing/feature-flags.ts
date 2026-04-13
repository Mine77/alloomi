const rawAllowList = process.env.MARKETING_EMAIL_ENABLED ?? "";
const rawBlockList = process.env.MARKETING_EMAIL_DISABLED ?? "";

let allowList: Set<string> | null = null;
let blockList: Set<string> | null = null;

function normalizeTokens(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowTokens = normalizeTokens(rawAllowList);
if (
  allowTokens.length > 0 &&
  !(
    allowTokens.length === 1 &&
    (allowTokens[0] === "*" || allowTokens[0].toLowerCase() === "all")
  )
) {
  allowList = new Set(allowTokens);
}

const blockTokens = normalizeTokens(rawBlockList);
if (blockTokens.length > 0) {
  blockList = new Set(blockTokens);
}

export function isEmailTemplateEnabled(templateId: string): boolean {
  if (allowList && !allowList.has(templateId)) {
    return false;
  }

  if (blockList?.has(templateId)) {
    return false;
  }

  return true;
}

export function summarizeEmailFeatureFlags() {
  return {
    allowList: allowList ? Array.from(allowList) : null,
    blockList: blockList ? Array.from(blockList) : null,
  };
}
