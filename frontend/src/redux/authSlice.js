import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../services/api.js';

export const loadCurrentUser = createAsyncThunk('auth/loadCurrentUser', async () => {
  const { data } = await api.get('/auth/me');
  return data.user;
});

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', credentials);
    return data.user;
  } catch (error) {
    return rejectWithValue(error.response?.data?.error?.message || 'Unable to connect to MediKiosk. Check that the API is running.');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try { await api.post('/auth/logout'); } catch { /* Clear the local session even if the API is unavailable. */ }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, status: 'checking', error: '' },
  reducers: { clearAuthError: (state) => { state.error = ''; } },
  extraReducers: (builder) => {
    builder
      .addCase(loadCurrentUser.fulfilled, (state, action) => { state.user = action.payload; state.status = 'authenticated'; })
      .addCase(loadCurrentUser.rejected, (state) => { state.user = null; state.status = 'unauthenticated'; })
      .addCase(loginUser.pending, (state) => { state.status = 'signing-in'; state.error = ''; })
      .addCase(loginUser.fulfilled, (state, action) => { state.user = action.payload; state.status = 'authenticated'; state.error = ''; })
      .addCase(loginUser.rejected, (state, action) => { state.user = null; state.status = 'unauthenticated'; state.error = action.payload || 'Sign in failed.'; })
      .addCase(logoutUser.fulfilled, (state) => { state.user = null; state.status = 'unauthenticated'; state.error = ''; });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
