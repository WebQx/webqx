import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// Initialize the React application
const container = document.getElementById('webqx-app');
const root = createRoot(container);

root.render(<App />);