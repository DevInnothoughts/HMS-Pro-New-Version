import { configureStore } from '@reduxjs/toolkit';
import locationReducer from './locationSlice';
import scopeReducer from './scopeSlice';

export const store = configureStore({
  reducer: {
    location: locationReducer,
    scope: scopeReducer,
  },
});
