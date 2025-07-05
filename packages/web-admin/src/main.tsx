import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // Temporarily disable StrictMode in development to prevent Firebase assertion errors
  // StrictMode causes components to mount/unmount twice in development
  import.meta.env.DEV ? (
    <App />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
