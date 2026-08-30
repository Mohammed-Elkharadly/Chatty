import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store.ts';
import { Toaster } from 'react-hot-toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <Router>
        <>
          <Toaster position="top-center" reverseOrder={false} />
          <App />
        </>
      </Router>
    </Provider>
  </StrictMode>,
);
