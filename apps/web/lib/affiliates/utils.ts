import { customAlphabet } from "nanoid";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_CODE_LENGTH = 8;

const randomCode = customAlphabet(CODE_ALPHABET, DEFAULT_CODE_LENGTH);

export function generateAffiliateCode() {
  return randomCode();
}
