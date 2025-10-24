import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'
import en from './textLabelEN'
import jp from './textLabelJP'

const LangContext = createContext(null)

const LABELS = { en, jp }
const DEFAULT = 'en'
const STORAGE_KEY = 'bt_lang'

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(DEFAULT)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && LABELS[stored]) setLang(stored)
    } catch (e) { /* ignore */ }
  }, [])

  const value = useMemo(() => ({
    lang,
    labels: LABELS[lang] || LABELS[DEFAULT],
    setLanguage: (l) => {
      if (!LABELS[l]) return
      setLang(l)
      try { localStorage.setItem(STORAGE_KEY, l) } catch (e) {}
    }
  }), [lang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLangContext() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLangContext must be used inside LanguageProvider')
  return ctx
}
