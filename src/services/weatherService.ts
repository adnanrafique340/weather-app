import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'
import type { SearchMode } from '../types'

// Using proxy in development to avoid CORS, direct API in production
const isDev = import.meta.env.DEV
const baseURL = isDev 
  ? '/api' // Vite proxy endpoint
  : 'https://api.openweathermap.org/data/2.5' // Direct API in production

// Creating axios instance without custom headers to avoid CORS preflight
const axiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  
})


// Configuring to avoid modifying request (which could trigger CORS preflight)
const client = setupCache(axiosInstance, {
  ttl: 1000 * 60 * 5,
  methods: ['get'],
  // Only cache successful responses
  cachePredicate: {
    statusCheck: (status) => status >= 200 && status < 300,
  },
  
  interpretHeader: false,
})

export interface WeatherQuery {
  mode: SearchMode
  city?: string
  zip?: string
  country?: string
  lat?: number
  lon?: number
  apiKey: string
}

export interface WeatherApiResponse {
  id: number
  name: string
  sys: { country: string; sunrise: number; sunset: number }
  main: { temp: number; humidity: number; pressure: number }
  wind: { speed: number }
  weather: { description: string; icon: string }[]
}

export async function fetchWeather(query: WeatherQuery) {
  const params: Record<string, string | number | undefined> = {
    appid: query.apiKey,
    units: 'metric',
  }

  if (query.mode === 'city') {
    if (!query.city?.trim()) {
      throw new Error('City name is required')
    }
    params.q = query.city.trim()
  } else if (query.mode === 'zip') {
    if (!query.zip?.trim()) {
      throw new Error('ZIP code is required')
    }
    params.zip = query.country ? `${query.zip.trim()},${query.country.trim()}` : query.zip.trim()
  } else {
    if (query.lat === undefined || query.lon === undefined) {
      throw new Error('Latitude and longitude are required')
    }
    params.lat = query.lat
    params.lon = query.lon
  }

  try {
    
    const response = await client.get<WeatherApiResponse>('/weather', {
      params,
      cache: { ttl: 1000 * 60 * 5 },
    })
    return response.data
  } catch (error) {
    // Re-throwing to let App.vue handle it
    throw error
  }
}

