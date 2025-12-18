import type { SavedForecast } from './types'

const STORAGE_KEY = 'weather-forecasts'

export function loadSavedForecasts(): SavedForecast[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch (error) {
    console.error('Failed to read storage', error)
  }
  return []
}

export function persistForecasts(items: SavedForecast[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (error) {
    console.error('Failed to write storage', error)
  }
}

