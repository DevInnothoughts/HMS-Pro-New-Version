/* eslint-disable prettier/prettier */
// src/common/cityMap.js
// ─────────────────────────────────────────────────────────────────────────────
// Branch → city, shared by Branch Summary and the Ad Agency lead screen so a
// branch can never sit in one city on one screen and another city on the other.
// Moved here unchanged from BranchSummaryScreen.js.
//
// Only multi-branch cities are listed. A branch absent from the map becomes a
// city of its own, named after itself (Belgavi, Kalaburagi, Latur, Ludhiana,
// Lucknow, Mysore, Nashik, Mohali, Aurangabad, Raipur — and any branch opened
// after this map was written), so it stays visible instead of disappearing.
// ─────────────────────────────────────────────────────────────────────────────

export const CITIES = {
  Pune: [
    'Baner',
    'Chakan',
    'Chinchwad',
    'Dighi',
    'Hinjewadi',
    'Salunke Vihar',
    'Undri',
    'Katraj',
    'Hadapsar',
    'DP Road',
  ],
  Mumbai: ['Andheri', 'Navi Mumbai', 'Thane', 'Vashi', 'Kalyan'],
  Bangalore: [
    'HSR',
    'Sahakar Nagar',
    'Indiranagar',
    'JP Nagar',
    'Rajaji Nagar',
    'Sarjapura',
    'Whitefield',
    'Electronic City',
    'RR Nagar',
    'Kalyan Nagar',
  ],
  Hyderabad: ['Hyderabad', 'Secunderabad', 'Gachibowli'],
  Ahmedabad: ['Ahmedabad', 'Bopal'],
  Surat: ['Surat', 'Adajan'],
  Gurgaon: ['Gurgaon Sector 14', 'Gurgaon Sector 49'],
};

export const CITY_OF = {};
Object.entries(CITIES).forEach(([city, branches]) => {
  branches.forEach(b => (CITY_OF[b] = city));
});

/** The city a branch belongs to; a branch with no city is its own. */
export const cityOf = branch => CITY_OF[branch] || branch;

export default { CITIES, CITY_OF, cityOf };
