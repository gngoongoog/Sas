import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for Progressive Web App (PWA) installation backing
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production' || true) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[SuperSAS SW] Registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('[SuperSAS SW] Registration failed:', err);
      });
  });
}

