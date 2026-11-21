import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode: it double-runs effects in development, which would speak the opening line twice.
createRoot(document.getElementById('root')).render(<App />);
