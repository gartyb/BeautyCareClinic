import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CustomerProvider } from './contexts/CustomerContext';
import { ActiveTimerProvider } from './contexts/ActiveTimerContext';
import './index.css';
import { App } from './App';

document.documentElement.dir = 'rtl';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CustomerProvider>
        <ActiveTimerProvider>
          <App />
        </ActiveTimerProvider>
      </CustomerProvider>
    </BrowserRouter>
  </StrictMode>
);
