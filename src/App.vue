// Main application logic
// Handles forecasts CRUD, pagination, search, auto-refresh, and notifications

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { fetchWeather } from './services/weatherService'
import { loadSavedForecasts, persistForecasts } from './storage'
import type {
  AppNotification,
  SavedForecast,
  SearchMode,
  WeatherView,
} from './types'


// App configuration constants
const API_KEY = 'b55616e8a1f4ebd7ddac31a77c399945'
const PAGE_SIZE = 10
const REFRESH_MS = 1000 * 60 * 5

const notifications = ref<AppNotification[]>([])
const modalOpen = ref(false)
const isLoading = ref(false)
const searchTerm = ref('')
const currentPage = ref(1)
const savedForecasts = ref<SavedForecast[]>([])
const refreshTimer = ref<number | undefined>()

const form = reactive({
  mode: 'city' as SearchMode,
  city: '',
  zip: '',
  zipCountry: 'us',
  lat: '',
  lon: '',
})


// Showing temporary notification messages (success, error, info)
function notify(type: AppNotification['type'], text: string) {
  const id = Date.now()
  notifications.value.push({ id, type, text })
  setTimeout(() => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }, 3500)
}

function formatTime(value: number) {
  return new Date(value * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatUpdated(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const filtered = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return savedForecasts.value
  return savedForecasts.value.filter((f) =>
    [
      f.weather.name,
      f.weather.country,
      f.weather.description,
      `${Math.round(f.weather.temperature)}`,
    ]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(term))
  )
})

const paged = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE) || 1)
)

watch(filtered, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = 1
  }
})

function forecastKey(mode: SearchMode, value: string) {
  return `${mode}-${value}`.toLowerCase()
}



// Maps OpenWeatherMap API response to internal WeatherView model
function mapWeather(data: Awaited<ReturnType<typeof fetchWeather>>): WeatherView {
  const iconCode = data.weather[0]?.icon ?? '01d'
  return {
    id: data.id,
    name: data.name,
    country: data.sys?.country ?? '',
    description: data.weather[0]?.description ?? 'N/A',
    icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
    temperature: data.main?.temp ?? 0,
    humidity: data.main?.humidity ?? 0,
    wind: data.wind?.speed ?? 0,
    pressure: data.main?.pressure ?? 0,
    sunrise: data.sys?.sunrise ?? 0,
    sunset: data.sys?.sunset ?? 0,
    updatedAt: Date.now(),
  }
}

async function handleAdd() {
  if (!API_KEY) {
    notify('danger', 'Missing VITE_OPENWEATHER_KEY in .env file.')
    return
  }

  try {
    isLoading.value = true
    const query = buildQuery()
    const raw = await fetchWeather({ ...query, apiKey: API_KEY })
    const weather = mapWeather(raw)
    const key = query.mode === 'coords'
      ? forecastKey(query.mode, `${query.lat},${query.lon}`)
      : forecastKey(query.mode, (query.city || query.zip || '') as string)

    const existingIndex = savedForecasts.value.findIndex((f) => f.key === key)
    const item: SavedForecast = {
      key,
      mode: query.mode,
      value: query.city ?? query.zip ?? `${query.lat},${query.lon}`,
      country: query.country,
      lat: query.lat,
      lon: query.lon,
      weather,
    }

    if (existingIndex >= 0) {
      savedForecasts.value.splice(existingIndex, 1, item)
    } else {
      savedForecasts.value.unshift(item)
    }
    persistForecasts(savedForecasts.value)
    notify('success', 'Forecast added.')
    modalOpen.value = false
    resetForm()
  } catch (error: unknown) {
    console.error('Error adding forecast:', error)
    notify('danger', parseError(error))
  } finally {
    isLoading.value = false
  }
}

function buildQuery() {
  const mode = form.mode
  if (mode === 'city') {
    if (!form.city.trim()) throw new Error('Enter a city name.')
    return { mode, city: form.city.trim() }
  }
  if (mode === 'zip') {
    if (!form.zip.trim()) throw new Error('Enter a ZIP/postal code.')
    return { mode, zip: form.zip.trim(), country: form.zipCountry.trim() || undefined }
  }
  const lat = Number(form.lat)
  const lon = Number(form.lon)
  if (Number.isNaN(lat) || Number.isNaN(lon)) throw new Error('Enter valid coordinates.')
  return { mode, lat, lon }
}

function resetForm() {
  form.city = ''
  form.zip = ''
  form.lat = ''
  form.lon = ''
  form.zipCountry = 'us'
  form.mode = 'city'
}

function removeForecast(key: string) {
  savedForecasts.value = savedForecasts.value.filter((f) => f.key !== key)
  persistForecasts(savedForecasts.value)
  notify('info', 'Forecast removed.')
}

async function refreshAll(showMessage = false) {
  if (!API_KEY || savedForecasts.value.length === 0) return
  try {
    const refreshed = await Promise.all(
      savedForecasts.value.map(async (item) => {
        const raw = await fetchWeather({
          mode: item.mode,
          apiKey: API_KEY,
          city: item.mode === 'city' ? item.value : undefined,
          zip: item.mode === 'zip' ? item.value : undefined,
          country: item.country,
          lat: item.lat,
          lon: item.lon,
        })
        return { ...item, weather: mapWeather(raw) }
      })
    )
    savedForecasts.value = refreshed
    persistForecasts(refreshed)
    if (showMessage) notify('success', 'Forecasts refreshed.')
  } catch (error) {
    console.error('Error refreshing forecasts:', error)
    notify('danger', parseError(error))
  }
}

function parseError(error: unknown) {
  if (typeof error === 'string') return error
  
  // Handling axios errors
  if (error && typeof error === 'object') {
    const axiosError = error as {
      response?: { data?: { message?: string }; status?: number }
      request?: unknown
      message?: string
    }
    
    // Network error (if no response received)
    if (axiosError.request && !axiosError.response) {
      return 'Network error: Could not reach the server. Check your internet connection.'
    }
    
    // API error response
    if (axiosError.response) {
      const msg = axiosError.response.data?.message
      const status = axiosError.response.status
      if (msg) return `${status ? `[${status}] ` : ''}${msg}`
      if (status === 401) return 'Invalid API key. Please check your OpenWeatherMap API key.'
      if (status === 404) return 'City not found. Please check the city name.'
      if (status === 429) return 'Too many requests. Please wait a moment.'
      return `API error: ${status || 'Unknown error'}`
    }
    
    // General error message
    if ('message' in axiosError && axiosError.message) {
      return axiosError.message
    }
  }
  
  return 'Something went wrong. Please try again.'
}


// Load saved forecasts on app start and enable auto-refresh
onMounted(() => {
  savedForecasts.value = loadSavedForecasts()
  if (API_KEY && savedForecasts.value.length > 0) {
    refreshAll()
  }
  refreshTimer.value = window.setInterval(() => refreshAll(), REFRESH_MS)
})

// Clear refresh interval when component is destroyed
onBeforeUnmount(() => {
  if (refreshTimer.value) clearInterval(refreshTimer.value)
})
</script>

<template>
  <div>
    <div class="notification-stack">
      <article
        v-for="note in notifications"
        :key="note.id"
        class="notification"
        :class="`is-${note.type}`"
      >
        {{ note.text }}
      </article>
    </div>

    <section class="hero is-primary hero-gradient">
      <div class="hero-body">
        <div class="container">
          <div class="hero-content">
            <div class="hero-title-section">
              <h1 class="title is-2 has-text-white mb-2">
                Weather Watch
              </h1>
              <p class="subtitle is-6 has-text-white-ter mb-5">
                Real-time weather forecasts powered by OpenWeatherMap API
              </p>
            </div>
            <div class="hero-actions">
              <div class="search-controls">
                <div class="field has-icons-left">
                  <div class="control has-icons-left">
                    <input
                      v-model="searchTerm"
                      class="input is-medium search-input"
                      type="text"
                      placeholder="Search saved forecasts..."
                    />
                    <span class="icon is-left">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.5; color: var(--text-muted);">
                        <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
              <div class="action-buttons">
                <button class="button is-medium is-success has-text-weight-semibold" @click="modalOpen = true">
                  <span class="icon is-small">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3.333v9.334M3.333 8h9.334" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span>Add Forecast</span>
                </button>
                <button class="button is-medium is-danger has-text-weight-semibold" @click="refreshAll(true)">
                  <span class="icon is-small">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.667 8a5.333 5.333 0 0 1 10.666 0M2.667 8h2.666M13.333 8h-2.666M8 2.667V5.333M8 10.667v2.666" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section main-content">
      <div class="container">
        <div class="forecast-card">
          <div class="card-header">
            <div class="card-header-left">
              <h2 class="title is-4 mb-2">
                Saved Forecasts
              </h2>
              <p class="subtitle is-6 has-text-grey" v-if="savedForecasts.length === 0">
                No forecasts yet. Click "Add Forecast" to get started.
              </p>
              <p class="subtitle is-6 has-text-grey" v-else>
                Showing {{ filtered.length }} forecast{{ filtered.length !== 1 ? 's' : '' }}
              </p>
            </div>
            <div class="card-header-right">
              <div class="info-badges">
                <span class="tag is-info is-light">
                  {{ PAGE_SIZE }} per page
                </span>
                <span class="tag is-success is-light ml-2">
                  Auto-refresh {{ REFRESH_MS / 60000 }}min
                </span>
              </div>
            </div>
          </div>

          <div class="table-wrapper" v-if="paged.length > 0">
            <table class="table is-fullwidth forecast-table">
              <thead>
                <tr>
                  <th><span class="table-header">Location</span></th>
                  <th><span class="table-header">Weather</span></th>
                  <th><span class="table-header">Temperature</span></th>
                  <th><span class="table-header">Humidity</span></th>
                  <th><span class="table-header">Wind Speed</span></th>
                  <th><span class="table-header">Pressure</span></th>
                  <th><span class="table-header">Sunrise</span></th>
                  <th><span class="table-header">Sunset</span></th>
                  <th class="has-text-centered"><span class="table-header">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(item, index) in paged" 
                  :key="item.key" 
                  class="forecast-row"
                  :style="{ animationDelay: `${index * 0.05}s` }"
                >
                  <td>
                    <div class="location-cell">
                      <img :src="item.weather.icon" alt="weather icon" class="weather-icon" />
                      <div class="location-info">
                        <div class="location-name">
                          {{ item.weather.name }}, {{ item.weather.country }}
                        </div>
                        <div class="location-updated">
                          Updated {{ formatUpdated(item.weather.updatedAt) }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="weather-desc">{{ item.weather.description }}</span>
                  </td>
                  <td>
                    <span class="temp-value">{{ Math.round(item.weather.temperature) }}°C</span>
                  </td>
                  <td>
                    <span class="metric-value">{{ item.weather.humidity }}%</span>
                  </td>
                  <td>
                    <span class="metric-value">{{ item.weather.wind }} m/s</span>
                  </td>
                  <td>
                    <span class="metric-value">{{ item.weather.pressure }} hPa</span>
                  </td>
                  <td>
                    <span class="time-value">{{ formatTime(item.weather.sunrise) }}</span>
                  </td>
                  <td>
                    <span class="time-value">{{ formatTime(item.weather.sunset) }}</span>
                  </td>
                  <td class="has-text-centered">
                    <button 
                      class="button is-small is-danger is-light delete-btn" 
                      @click="removeForecast(item.key)"
                      title="Remove forecast"
                    >
                      <span class="icon is-small">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                      </span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-else class="empty-state">
            <div class="empty-state-content">
              <div class="empty-icon-wrapper">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.3">
                  <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2"/>
                  <path d="M32 20v12M32 44h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <h3 class="title is-5 mt-4">No Forecasts Yet</h3>
              <p class="subtitle is-6 has-text-grey">Get started by adding your first weather forecast</p>
              <button class="button is-primary is-medium mt-4" @click="modalOpen = true">
                <span class="icon is-small">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3.333v9.334M3.333 8h9.334" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </span>
                <span>Add Your First Forecast</span>
              </button>
            </div>
          </div>

          <nav v-if="paged.length > 0" class="pagination-wrapper" role="navigation" aria-label="pagination">
            <div class="pagination-info">
              <span class="has-text-grey">
                Page {{ currentPage }} of {{ totalPages }} 
                ({{ filtered.length }} total)
              </span>
            </div>
            <div class="pagination">
              <a
                class="pagination-previous"
                :class="{ 'is-disabled': currentPage === 1 }"
                :disabled="currentPage === 1"
                @click.prevent="currentPage = Math.max(1, currentPage - 1)"
              >
                ← Previous
              </a>
              <ul class="pagination-list">
                <li v-for="page in totalPages" :key="page">
                  <a
                    class="pagination-link"
                    :class="{ 'is-current': page === currentPage }"
                    @click.prevent="currentPage = page"
                  >
                    {{ page }}
                  </a>
                </li>
              </ul>
              <a
                class="pagination-next"
                :class="{ 'is-disabled': currentPage === totalPages }"
                :disabled="currentPage === totalPages"
                @click.prevent="currentPage = Math.min(totalPages, currentPage + 1)"
              >
                Next →
              </a>
            </div>
          </nav>
        </div>
      </div>
    </section>

    <div class="modal" :class="{ 'is-active': modalOpen }">
      <div class="modal-background" @click="modalOpen = false"></div>
      <div class="modal-card modal-enhanced">
        <header class="modal-card-head">
          <p class="modal-card-title">Add New Forecast</p>
          <button class="delete" aria-label="close" @click="modalOpen = false"></button>
        </header>
        <section class="modal-card-body">
          <div class="search-mode-selector">
            <p class="label mb-3">Search by:</p>
            <div class="field is-grouped is-grouped-multiline">
              <div class="control">
                <label class="radio radio-enhanced" :class="{ 'is-active': form.mode === 'city' }">
                  <input v-model="form.mode" type="radio" value="city" />
                  <span class="radio-label">City Name</span>
                </label>
              </div>
              <div class="control">
                <label class="radio radio-enhanced" :class="{ 'is-active': form.mode === 'zip' }">
                  <input v-model="form.mode" type="radio" value="zip" />
                  <span class="radio-label">ZIP Code</span>
                </label>
              </div>
              <div class="control">
                <label class="radio radio-enhanced" :class="{ 'is-active': form.mode === 'coords' }">
                  <input v-model="form.mode" type="radio" value="coords" />
                  <span class="radio-label">Coordinates</span>
                </label>
              </div>
            </div>
          </div>

          <div v-if="form.mode === 'city'" class="field">
            <label class="label">City name</label>
            <div class="control">
              <input v-model="form.city" class="input" type="text" placeholder="e.g. London" />
            </div>
          </div>

          <div v-else-if="form.mode === 'zip'" class="field is-horizontal">
            <div class="field-body">
              <div class="field">
                <label class="label">ZIP / postal code</label>
                <div class="control is-expanded">
                  <input v-model="form.zip" class="input" type="text" placeholder="10001" />
                </div>
              </div>
              <div class="field">
                <label class="label">Country code</label>
                <div class="control">
                  <input
                    v-model="form.zipCountry"
                    class="input"
                    type="text"
                    maxlength="2"
                    placeholder="US"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-else class="field is-horizontal">
            <div class="field-body">
              <div class="field">
                <label class="label">Latitude</label>
                <div class="control">
                  <input v-model="form.lat" class="input" type="number" step="0.01" />
                </div>
              </div>
              <div class="field">
                <label class="label">Longitude</label>
                <div class="control">
                  <input v-model="form.lon" class="input" type="number" step="0.01" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <footer class="modal-card-foot is-justify-content-flex-end">
          <button class="button" @click="modalOpen = false">Cancel</button>
          <button class="button is-primary" :class="{ 'is-loading': isLoading }" @click="handleAdd">
            Save
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

