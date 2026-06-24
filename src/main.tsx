import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerShellServiceWorker } from './features/pwa/pwa-service';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

export const shellServiceWorkerRegistration =
  window.isSecureContext ? registerShellServiceWorker() : Promise.resolve(null);
