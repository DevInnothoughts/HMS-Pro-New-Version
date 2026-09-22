/* eslint-disable prettier/prettier */
// src/api/feedback.js

import { get } from './client';

/** GET /hms/overview/feedback — operated patients plus their responses. */
export const fetchIpdFeedback = (location, from, to) =>
  get('/overview/feedback', { location, from, to });

export default { fetchIpdFeedback };
