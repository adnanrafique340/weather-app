# Weather Watch App

A weather forecast application built with Vue.js 3 and TypeScript.

## What You Need

- Node.js (version 18 or higher)
- npm (comes with Node.js)

## How to Install

1. Open terminal/command prompt in the project folder
2. Run this command:
```bash
npm install
```

## How to Run

### For Development (Recommended)
```bash
npm run dev
```
Then open your browser and go to: `http://localhost:5173`

### For Production
```bash
npm run serve
```
Then open your browser and go to: `http://localhost:4173`

## How to Use

1. **Add Weather Forecast:**
   - Click the green "Add Forecast" button
   - Choose how you want to search (City Name, ZIP Code, or Coordinates)
   - Enter the details and click "Save"

2. **Search Forecasts:**
   - Use the search bar at the top to find saved forecasts

3. **Refresh Data:**
   - Click the red "Refresh" button to update all forecasts
   - Data automatically refreshes every 5 minutes

4. **Delete Forecast:**
   - Click the delete button (X) on any forecast row to remove it

## Features

-  Add weather forecasts by city name, ZIP code, or coordinates
-  Search through saved forecasts
-  View temperature, humidity, wind speed, pressure, sunrise, and sunset
-  Automatic data refresh every 5 minutes
-  Data saved in browser (localStorage)
-  Beautiful and modern design
-  Responsive layout (works on mobile and desktop)

## Project Structure

```
WetherAPP/
├── src/
│   ├── App.vue          # Main application component
│   ├── main.ts          # Application entry point
│   ├── services/        # API service for weather data
│   ├── storage.ts       # LocalStorage helper functions
│   └── types.ts         # TypeScript type definitions
├── package.json         # Project dependencies
└── README.md           # This file
```

## Technologies Used

- Vue.js 3 (with Composition API)
- TypeScript
- Vite (build tool)
- Bulma (CSS framework)
- Axios (HTTP client)
- OpenWeatherMap API

## Notes

- The app uses OpenWeatherMap API (API key is already included)
- All data is saved in your browser's localStorage
- The app automatically refreshes weather data every 5 minutes
- You can save multiple forecasts and search through them

## Support

If you face any issues, make sure:
1. Node.js is installed (version 18+)
2. All dependencies are installed (`npm install`)
3. You're using the correct command to run the app

---

**Made using Vue.js 3 + TypeScript**
