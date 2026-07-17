/* eslint-disable prettier/prettier */
// ServiceTicketAPI.js
// ─────────────────────────────────────────────────────────────────────────────
// Networking for Service Ticketing. Same POST-JSON style as TargetComparisonAPI.
//
// Endpoints (see serviceTicketController.js):
//   POST /serviceTicket/create
//   POST /serviceTicket/action
//   POST /serviceTicket/list
//   GET  /serviceTicket/detail?ticketId=
//   POST /serviceTicket/stats
// ─────────────────────────────────────────────────────────────────────────────

import { BACKEND_URL, resolveActor } from './ServiceTicketConstants';

const postJSON = async (path, body) => {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = { message: text };
  }
  if (!res.ok)
    throw new Error(
      json.error || json.message || `Request failed (${res.status})`,
    );
  return json;
};

const getJSON = async path => {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  console.log('getJSON', path, text);
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = { message: text };
  }
  if (!res.ok)
    throw new Error(
      json.error || json.message || `Request failed (${res.status})`,
    );
  return json;
};

// Raise a new request. `payload` = { branch, categoryCode, title, description, priority }
export const createTicket = async (payload, role, subRole) => {
  const actor = await resolveActor(role, subRole);
  return postJSON('/serviceTicket/create', { ...payload, ...actor });
};

// Perform a stage transition.
// action ∈ CLUSTER_APPROVED | CLUSTER_REJECTED | HO_ACTION_SUBMITTED | CLOSED | REOPENED
export const actOnTicket = async (ticketId, action, remark, role, subRole) => {
  const actor = await resolveActor(role, subRole);
  return postJSON('/serviceTicket/action', {
    ticketId,
    action,
    remark,
    ...actor,
  });
};

// Role-aware list for the given branches.
export const listTickets = async (
  { locations, status, category },
  role,
  subRole,
) => {
  const actor = await resolveActor(role, subRole);
  return postJSON('/serviceTicket/list', {
    locations,
    status,
    category,
    actorRole: actor.actorRole,
    actorSubRole: actor.actorSubRole,
    actorMobile: actor.actorMobile,
  });
};

// One ticket + timeline + TAT.
export const getTicketDetail = ticketId =>
  getJSON(`/serviceTicket/detail?ticketId=${encodeURIComponent(ticketId)}`);

// Dashboard aggregates.
export const getTicketStats = ({ locations, from, to }) =>
  postJSON('/serviceTicket/stats', { locations, from, to });
