import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Landing } from './routes/Landing.js'
import { RoomRoute } from './routes/RoomRoute.js'
import './index.css'

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
