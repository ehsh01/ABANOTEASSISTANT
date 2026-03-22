import { useLanguageStore } from "@/store/language-store";
import { translations } from "@/lib/translations";

export function useT() {
  const language = useLanguageStore((s) => s.language);
  return translations[language];
}
