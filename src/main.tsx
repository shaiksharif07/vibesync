// Polyfills for simple-peer in Vite
import { Buffer } from 'buffer';
(window as any).global = window;
(window as any).Buffer = Buffer;
(window as any).process = { 
  env: { 
    NODE_ENV: (import.meta as any).env.MODE 
  },
  nextTick: (fn: any) => setTimeout(fn, 0),
  browser: true
};

// 🔥 EMERGENCY DEBUGGER: Alert any JS errors that cause blank screen
window.onerror = function(message, source, lineno, colno, error) {
  alert("🚨 APP CRASH: " + message + "\nAt: " + source + ":" + lineno);
  return false;
};
window.onunhandledrejection = function(event) {
  alert("🚨 PROMISE CRASH: " + event.reason);
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
