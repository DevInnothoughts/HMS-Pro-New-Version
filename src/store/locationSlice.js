import {createSlice} from '@reduxjs/toolkit';

const locationSlice = createSlice({
  name: 'location',
  initialState: {
    value: '', // For single location
    locationArray: [], // For array of locations
    role: '',
    subRole: '',
  },
  reducers: {
    setLocation: (state, action) => {
      state.value = action.payload;
    },
    clearLocation: state => {
      state.value = '';
    },
    addToLocationArray: (state, action) => {
      state.locationArray.push(action.payload); // Add location to the array
    },
    clearLocationArray: state => {
      state.locationArray = []; // Clear the entire location array
    },
    setLocationArray: (state, action) => {
      state.locationArray = action.payload; // Set the entire location array
    },
    setRole: (state, action) => {
      state.role = action.payload;
    },
    clearRole: state => {
      state.role = '';
    },
    setSubRole: (state, action) => {
      state.subRole = action.payload;
    },
    clearSubRole: state => {
      state.subRole = '';
    },
  },
});

export const {
  setLocation,
  clearLocation,
  addToLocationArray,
  clearLocationArray,
  setLocationArray,
  setRole,
  clearRole,
  setSubRole,
  clearSubRole,
} = locationSlice.actions;

export default locationSlice.reducer;
