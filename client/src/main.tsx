import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/styles/base.scss'
import './app/styles/tailwind.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
