import React, { createContext, useContext, useState, useCallback } from "react";
import { Lang, translations, Translations } from "@/i18n/translations";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getSavedLang(): Lang {
  try {
    const saved = localStorage.getItem("it-coach-lang");
    if (saved === "vi" || saved === "en") return saved;
  } catch {}
  return "vi";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getSavedLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("it-coach-lang", l); } catch {}
  }, []);

  return (
    <LanguageContext.Provider
      value={{ lang, setLang, t: translations[lang] as Translations }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
