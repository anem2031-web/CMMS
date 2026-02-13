import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import ar, { type TranslationKeys } from "@/i18n/ar";
import en from "@/i18n/en";
import ur from "@/i18n/ur";
import { trpc } from "@/lib/trpc";

export type SupportedLanguage = "ar" | "en" | "ur";

interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  dir: "rtl" | "ltr";
  fontFamily: string;
}

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    dir: "rtl",
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
  },
  ur: {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    dir: "rtl",
    fontFamily: "'IBM Plex Sans Arabic', 'Noto Nastaliq Urdu', sans-serif",
  },
};

const translations: Record<SupportedLanguage, TranslationKeys> = { ar, en, ur };

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationKeys;
  dir: "rtl" | "ltr";
  isRTL: boolean;
  config: LanguageConfig;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "cmms-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === "ar" || saved === "en" || saved === "ur")) {
      return saved as SupportedLanguage;
    }
    return "ar";
  });

  const setLanguageMutation = trpc.translation.setLanguage.useMutation();

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    // Update user preference in DB (fire and forget)
    setLanguageMutation.mutate({ language: lang });
  }, [setLanguageMutation]);

  // Apply direction and lang to document
  useEffect(() => {
    const config = LANGUAGE_CONFIGS[language];
    document.documentElement.lang = language;
    document.documentElement.dir = config.dir;
    document.documentElement.style.fontFamily = config.fontFamily;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: translations[language],
    dir: LANGUAGE_CONFIGS[language].dir,
    isRTL: LANGUAGE_CONFIGS[language].dir === "rtl",
    config: LANGUAGE_CONFIGS[language],
  }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

// Shortcut hook for translations only
export function useTranslation() {
  const { t, language, dir, isRTL } = useLanguage();
  return { t, language, dir, isRTL };
}
