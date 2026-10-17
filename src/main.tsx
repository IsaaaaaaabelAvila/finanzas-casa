import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true }); // con autoUpdate recarga cuando hay version nueva

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
