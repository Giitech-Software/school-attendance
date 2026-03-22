// web/src/main.tsx
import React from 'react'   // this one can remain in main if you prefer, but not required
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'        // ← ensure this exists and is imported


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
