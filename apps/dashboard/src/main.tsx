import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { useThemeStore } from './store/theme';
import './index.css';

// Sync DOM with persisted theme state before first render
const { theme } = useThemeStore.getState();
document.documentElement.classList.toggle('dark', theme === 'dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
