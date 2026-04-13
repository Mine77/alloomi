"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enUS from "./locales/en-US";
import zhHans from "./locales/zh-Hans";

// Language code mapping: Maps browser language codes to supported language codes
const languageMap: Record<string, string> = {
  en: "en-US",
  "en-US": "en-US",
  "en-GB": "en-US",
  "en-AU": "en-US",
  "en-CA": "en-US",
  zh: "zh-Hans",
  "zh-CN": "zh-Hans",
  "zh-Hans": "zh-Hans",
  "zh-Hant": "zh-Hans", // Traditional Chinese also maps to Simplified Chinese
  "zh-TW": "zh-Hans",
  "zh-HK": "zh-Hans",
  "zh-SG": "zh-Hans",
};

// Convert detected language code to supported language code
const convertLanguage = (lng: string): string => {
  // Try exact match first
  if (languageMap[lng]) {
    return languageMap[lng];
  }
  // Then try matching only the language code (e.g., "zh" extracted from "zh-CN")
  const langCode = lng.split("-")[0];
  return languageMap[langCode] || "en-US";
};

// Force default language on init to avoid hydration mismatch
// Language detection will be triggered manually after component mount
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "en-US": {
        translation: enUS,
      },
      "zh-Hans": {
        translation: zhHans,
      },
    },
    lng: "en-US", // Initial language always English, ensures server and client consistency
    fallbackLng: "en-US",
    debug: process.env.NODE_ENV === "development",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable Suspense to avoid hydration mismatch
    },
    returnObjects: true, // Allow returning objects (used to get array translation values, etc.)
    detection: {
      // Do not auto-detect, switch to manual trigger
      order: [],
      caches: [],
    },
  });

// Manually detect and set language (called after client mount)
export const detectAndSetLanguage = () => {
  // Get saved language from localStorage
  const savedLanguage = localStorage.getItem("langbot_language");
  if (savedLanguage && languageMap[savedLanguage]) {
    i18n.changeLanguage(languageMap[savedLanguage]);
    return;
  }

  // Detect from browser language
  const browserLang = navigator.language;
  const detectedLanguage = convertLanguage(browserLang);

  localStorage.setItem("langbot_language", detectedLanguage);
  i18n.changeLanguage(detectedLanguage);
};

export const saveLanguage = (languageCode: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("langbot_language", languageCode);
  }
};

export default i18n;
