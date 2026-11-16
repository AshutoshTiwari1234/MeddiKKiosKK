import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice.js';
import authReducer from './authSlice.js';

export const store = configureStore({ reducer: { ui: uiReducer, auth: authReducer } });
