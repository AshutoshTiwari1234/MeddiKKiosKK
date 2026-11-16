import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { darkMode: false, notice: '' },
  reducers: {
    toggleTheme: (state) => { state.darkMode = !state.darkMode; },
    setNotice: (state, action) => { state.notice = action.payload; },
  },
});

export const { toggleTheme, setNotice } = uiSlice.actions;
export default uiSlice.reducer;
