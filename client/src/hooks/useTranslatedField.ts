import { useLanguage } from "@/contexts/LanguageContext";

type SupportedLanguage = "ar" | "en" | "ur";

/**
 * Hook to get translated field value based on current language
 * Falls back to original field if translation not available
 * 
 * Usage:
 *   const { getField } = useTranslatedField();
 *   const title = getField(ticket, "title"); // returns title_ar, title_en, or title_ur based on current language
 */
export function useTranslatedField() {
  const { language } = useLanguage();

  /**
   * Get the translated value of a field for the current language
   * @param record - The database record (ticket, asset, etc.)
   * @param fieldName - The base field name (e.g., "title", "description")
   * @returns The translated value or the original value as fallback
   */
  function getField(record: Record<string, any>, fieldName: string): string {
    if (!record) return "";
    const translatedKey = `${fieldName}_${language}`;
    const translatedValue = record[translatedKey];
    if (translatedValue && translatedValue.trim().length > 0) {
      return translatedValue;
    }
    return record[fieldName] || "";
  }

  /**
   * Get translated value for a specific language
   */
  function getFieldForLang(record: Record<string, any>, fieldName: string, lang: SupportedLanguage): string {
    if (!record) return "";
    const translatedKey = `${fieldName}_${lang}`;
    const translatedValue = record[translatedKey];
    if (translatedValue && translatedValue.trim().length > 0) {
      return translatedValue;
    }
    return record[fieldName] || "";
  }

  /**
   * Check if a record has translations for a field
   */
  function hasTranslation(record: Record<string, any>, fieldName: string): boolean {
    if (!record) return false;
    const langs: SupportedLanguage[] = ["ar", "en", "ur"];
    return langs.some((lang) => {
      const key = `${fieldName}_${lang}`;
      return record[key] && record[key].trim().length > 0;
    });
  }

  /**
   * Get all available translations for a field
   */
  function getAllTranslations(record: Record<string, any>, fieldName: string): Record<SupportedLanguage, string> {
    return {
      ar: record[`${fieldName}_ar`] || record[fieldName] || "",
      en: record[`${fieldName}_en`] || record[fieldName] || "",
      ur: record[`${fieldName}_ur`] || record[fieldName] || "",
    };
  }

  return {
    language,
    getField,
    getFieldForLang,
    hasTranslation,
    getAllTranslations,
  };
}

/**
 * Get localized name for records with nameEn/nameUr fields (sites, sections, technicians)
 * Falls back to name if translation not available
 */
export function getLocalizedName(
  record: { name: string; nameEn?: string | null; nameUr?: string | null } | null | undefined,
  language: string
): string {
  if (!record) return "";
  if (language === "en" && record.nameEn) return record.nameEn;
  if (language === "ur" && record.nameUr) return record.nameUr;
  return record.name;
}
