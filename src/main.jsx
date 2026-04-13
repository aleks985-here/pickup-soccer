import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Group from './pages/Group'
import Profile from './pages/Profile'
import Rsvp from './pages/Rsvp'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/:groupSlug/rsvp/:gameId" element={<Rsvp />} />
      <Route path="/:groupSlug" element={<Group />} />
    </Routes>
  </BrowserRouter>
)
