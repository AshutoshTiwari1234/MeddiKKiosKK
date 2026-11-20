import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { store } from './redux/store.js';
import { ToastProvider } from './components/ToastProvider.jsx';
import './index.css';
import './auth.css';
import './login.css';
import './account-requests.css';
import './patient-intake.css';
import './voice.css';
import './records.css';
import './pagination.css';
import './clinical.css';
import './review-badges.css';
import './review-history.css';
import './patient-consent.css';
import './consent-history.css';
import './kiosk-enhancements.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ToastProvider>
        <BrowserRouter><App /></BrowserRouter>
      </ToastProvider>
    </Provider>
  </React.StrictMode>,
);
