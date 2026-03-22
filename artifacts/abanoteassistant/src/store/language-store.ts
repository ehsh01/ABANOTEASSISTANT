import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "en" | "es";

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggle: () => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: "en",
      setLanguage: (language) => set({ language }),
      toggle: () =>
        set({ language: get().language === "en" ? "es" : "en" }),
    }),
    { name: "aba-language" }
  )
);
