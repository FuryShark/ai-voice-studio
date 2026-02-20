import { useState, useCallback } from 'react'

export interface UserPreferences {
  defaultEngine: string
  defaultVoice: string
  defaultFormat: 'wav' | 'mp3' | 'flac' | 'ogg'
  defaultSpeed: number
  defaultTemperature: number
}

const PREFS_KEY = 'voice-studio-preferences'

const DEFAULT_PREFS: UserPreferences = {
  defaultEngine: 'kokoro',
  defaultVoice: 'af_heart',
  defaultFormat: 'wav',
  defaultSpeed: 1.0,
  defaultTemperature: 0.7,
}

function loadPreferences(): UserPreferences {
  try {
    const saved = localStorage.getItem(PREFS_KEY)
    if (saved) {
      return { ...DEFAULT_PREFS, ...JSON.parse(saved) }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences)

  const updatePrefs = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPrefs(prev => {
      const updated = { ...prev, ...newPrefs }
      localStorage.setItem(PREFS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS)
    localStorage.removeItem(PREFS_KEY)
  }, [])

  return { prefs, updatePrefs, resetPrefs }
}
