import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { trackInp } from './perf';
import './styles.css';

if (new URLSearchParams(location.search).has('bench')) void trackInp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
