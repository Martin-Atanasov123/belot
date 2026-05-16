import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Landing } from './routes/Landing.js'
import { RoomRoute } from './routes/RoomRoute.js'
import { useI18n } from './i18n/index.js'
import './index.css'

// Initialise <html lang="…"> on first paint so screen readers pick the right voice.
document.documentElement.lang = useI18n.getState().locale

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/r/:code" element={<RoomRoute />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
