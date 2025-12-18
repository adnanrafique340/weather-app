export type SearchMode = 'city' | 'zip' | 'coords'

export interface WeatherView {
  id: number
  name: string
  country: string
  description: string
  icon: string
  temperature: number
  humidity: number
  wind: number
  pressure: number
  sunrise: number
  sunset: number
  updatedAt: number
}

export interface SavedForecast {
  key: string
  mode: SearchMode
  value: string
  country?: string
  lat?: number
  lon?: number
  weather: WeatherView
}

export type NotificationType = 'success' | 'info' | 'danger'

export interface AppNotification {
  id: number
  type: NotificationType
  text: string
}

