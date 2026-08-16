import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './bootstrap-theme.css'
import App from './App.jsx'
import PwaUpdatePrompt from './PwaUpdatePrompt.jsx'
import AddToHomeScreenPrompt from './AddToHomeScreenPrompt.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PwaUpdatePrompt />
    <AddToHomeScreenPrompt />
  </StrictMode>,
)
