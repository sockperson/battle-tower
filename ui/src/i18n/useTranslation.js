import { useLangContext } from './LanguageProvider'

export default function useTranslation() {
  const { labels, lang, setLanguage } = useLangContext()

  function interpolate(template, args) {
    if (template == null) return template
    let out = String(template)

    // If single object arg given, treat as named replacements: {name}
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const obj = args[0]
      for (const key of Object.keys(obj)) {
        const re = new RegExp('\\{' + key + '\\}', 'g')
        out = out.replace(re, String(obj[key]))
      }
      return out
    }

    // Positional replacements: {0}, {1}, ...
    for (let i = 0; i < args.length; i++) {
      const re = new RegExp('\\{' + i + '\\}', 'g')
      out = out.replace(re, String(args[i]))
    }

    // Support '{}' sequential placeholders as a convenience
    if (out.includes('{}') && args.length > 0) {
      let idx = 0
      out = out.replace(/\{\}/g, () => {
        const val = idx < args.length ? args[idx] : ''
        idx++
        return String(val)
      })
    }

    return out
  }

  return {
    // t(key, ...args)
    // - positional: t('greet', 'Alice') replaces {0} with 'Alice'
    // - named: t('greetNamed', { name: 'Alice' }) replaces {name}
    // - sequential: t('list', 'a','b') also replaces '{}' placeholders in order
    textLabel: (k, ...args) => interpolate(labels[k] ?? k, args),
    lang,
    setLanguage
  }
}
