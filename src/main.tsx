import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Register PWA Service Worker only in standard web/PWA browser environments (not inside Chrome Extension)
const isExtension = typeof window !== 'undefined' && (
  window.location.protocol.startsWith('chrome-extension') ||
  window.location.protocol.startsWith('moz-extension')
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isExtension) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('ServiceWorker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
