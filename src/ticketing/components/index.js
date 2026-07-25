/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// components/index.js
// ─────────────────────────────────────────────────────────────────────────────
// The building blocks of the ticket screens, each a direct port of a rule in
// hhc_branch_admin_website.html. Keeping them here means the CSS is honoured in
// one place instead of being re-approximated on every screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { C, F, PRIORITY_STYLE, S, STATUS_STYLE } from '../theme';

// ─── ScreenHeader ────────────────────────────────────────────────────────────
// The mockup's <header>: brand line, role pill, title, sub.
//
// The hamburger replaces the logo per requirement 1 and opens the sidebar.
//
// No tabs here. The mockup carried tabs in the header AND a bottom nav doing the
// same job; two controls for one thing is one too many, and on a phone the
// bottom bar is the one you can reach. Navigation is BottomNav only — see
// TicketingHome, which owns the shell so no screen can render without it.
//
// The background is a solid colour on S.header rather than a gradient child.
// See the note in theme.js.
export const ScreenHeader = ({
  onMenu,
  rolePill,
  title,
  sub,
  right = null,
}) => (
  <View style={S.header}>
    <View style={S.headerTop}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
      >
        {!!onMenu && (
          <TouchableOpacity
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: C.white, fontSize: 19, lineHeight: 22 }}>
              ☰
            </Text>
          </TouchableOpacity>
        )}
        <Text style={S.headerLogo} numberOfLines={1}>
          Healing Hands Clinic
        </Text>
      </View>
      {right}
      {!!rolePill && (
        <View style={S.headerPill}>
          <Text style={S.headerPillText}>{rolePill}</Text>
        </View>
      )}
    </View>

    {!!title && <Text style={S.h1}>{title}</Text>}
    {!!sub && <Text style={S.sub}>{sub}</Text>}
  </View>
);

// ─── Badge ───────────────────────────────────────────────────────────────────
// CSS: .badge, tinted by .critical/.high/.medium/.low/.overdue
export const Badge = ({ children, tone }) => {
  const t = PRIORITY_STYLE[tone] || STATUS_STYLE[tone] || null;
  const extra =
    tone === 'overdue'
      ? { bg: C.overdueBg, fg: C.red }
      : t || { bg: C.badgeBg, fg: C.badgeText };
  return (
    <View style={[S.badge, { backgroundColor: extra.bg }]}>
      <Text style={[S.badgeText, { color: extra.fg }]}>{children}</Text>
    </View>
  );
};

// ─── Metric tile ─────────────────────────────────────────────────────────────
// CSS: button.metric — tappable, and tapping filters the list below.
export const Metric = ({ value, label, onPress, tone }) => {
  const colour =
    tone === 'red'
      ? C.red
      : tone === 'orange'
      ? C.orange
      : tone === 'green'
      ? C.green
      : C.text;
  return (
    <TouchableOpacity
      style={[S.metric, S.grid2Item]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${value ?? 0}`}
    >
      <Text style={[S.metricNum, { color: colour }]}>{value ?? 0}</Text>
      <Text style={S.metricLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

// ─── Button ──────────────────────────────────────────────────────────────────
export const Btn = ({
  label,
  onPress,
  secondary,
  small,
  danger,
  disabled,
  loading,
  style,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.85}
    accessibilityRole="button"
    style={[
      S.btn,
      secondary && S.btnSecondary,
      danger && S.btnDanger,
      small && S.btnSmall,
      (disabled || loading) && S.btnDisabled,
      style,
    ]}
  >
    {loading ? (
      <ActivityIndicator size="small" color={secondary ? C.green : C.white} />
    ) : (
      <Text
        style={[
          S.btnText,
          secondary && S.btnSecondaryText,
          small && S.btnSmallText,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    )}
  </TouchableOpacity>
);

// ─── Progress bar ────────────────────────────────────────────────────────────
export const ProgressBar = ({ pct = 0 }) => (
  <View style={S.progress}>
    <View style={[S.bar, { width: `${Math.max(0, Math.min(100, pct))}%` }]} />
  </View>
);

// ─── Select ──────────────────────────────────────────────────────────────────
// React Native has no <select>. This is the modal-list pattern already used
// elsewhere in the app, styled to match the CSS input rule so the form reads
// exactly like the mockup on both platforms.
export const Select = ({
  value,
  options = [],
  onChange,
  placeholder = 'Select',
  disabled,
  pill,
  active,
  label,
}) => {
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () =>
      options.map(o => (typeof o === 'string' ? { label: o, value: o } : o)),
    [options],
  );
  const current = items.find(o => o.value === value);

  const trigger = pill
    ? [
        S.chip,
        active && S.chipActive,
        { flexDirection: 'row', alignItems: 'center', gap: 6 },
      ]
    : [
        S.input,
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      ];

  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${label || placeholder}: ${
          current?.label || 'not set'
        }`}
        style={[trigger, disabled && { opacity: 0.5 }]}
      >
        <Text
          numberOfLines={1}
          style={
            pill
              ? [S.chipText, active && S.chipTextActive]
              : [S.inputText, !current && S.placeholder, { flex: 1 }]
          }
        >
          {current?.label || placeholder}
        </Text>
        <Text
          style={{
            color: pill ? (active ? C.white : C.chipText) : C.muted,
            fontSize: 10,
          }}
        >
          ▾
        </Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: C.drawerOverlay,
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Pressable
            style={{
              backgroundColor: C.white,
              borderRadius: 20,
              maxHeight: '70%',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                padding: 15,
                borderBottomWidth: 1,
                borderBottomColor: C.line,
              }}
            >
              <Text
                style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}
              >
                {label || placeholder}
              </Text>
            </View>
            <ScrollView>
              {items.map(o => {
                const on = o.value === value;
                return (
                  <TouchableOpacity
                    key={String(o.value)}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 15,
                      borderBottomWidth: 1,
                      borderBottomColor: C.line,
                      backgroundColor: on ? C.navActiveBg : C.white,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: on ? F.semibold : F.regular,
                        fontSize: 14,
                        color: on ? C.green : C.text,
                        flex: 1,
                      }}
                    >
                      {o.label}
                    </Text>
                    {!!o.hint && <Text style={S.tiny}>{o.hint}</Text>}
                  </TouchableOpacity>
                );
              })}
              {!items.length && (
                <View style={S.empty}>
                  <Text style={S.emptyText}>Nothing to choose from yet.</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

// ─── Labelled field ──────────────────────────────────────────────────────────
export const Field = ({ label, children }) => (
  <View>
    <Text style={S.label}>{label}</Text>
    {children}
  </View>
);

export const Input = ({ multiline, style, ...rest }) => (
  <TextInput
    style={[S.input, multiline && S.textarea, style]}
    placeholderTextColor={C.muted}
    multiline={multiline}
    {...rest}
  />
);

// ─── Filter bar ──────────────────────────────────────────────────────────────
// CSS: .filterbar — an "All" chip then a row of pill selects.
// `showMine` adds a "Raised by me" chip. It earns its place once a person sees
// more than their own tickets: for a partner whose list is now the whole
// branch, "which of these are mine" is a question worth one tap.
// A horizontal strip of filter chips and pill dropdowns.
//
// Ticketing calls this with no `fields`, and gets the original set (status,
// type, department, location). Recruitment passes its own, because its filters
// are genuinely different — a requisition has no priority, and its department
// list is the hiring one. Configuring rather than duplicating keeps one strip
// to maintain and one place where "cleared" is defined.
export const FilterBar = ({
  filters,
  onChange,
  meta,
  branches = [],
  showMine,
  mineLabel = 'Raised by me',
  fields,
  chips = [],
}) => {
  const set = patch => onChange({ ...filters, ...patch });

  // Ticketing's original strip, kept as the default so its call site is unchanged.
  const defaultFields = [
    {
      key: 'status',
      label: 'Status',
      any: 'Any status',
      options: meta?.statuses || [],
    },
    {
      key: 'priority',
      label: 'Type',
      any: 'Any type',
      options: meta?.priorities || [],
    },
    {
      key: 'department',
      label: 'Department',
      any: 'Any department',
      options: meta?.departments || [],
    },
    {
      key: 'branch',
      label: 'Location',
      any: 'Any location',
      options: branches,
      minOptions: 2,
    },
  ];
  const shown = (fields || defaultFields).filter(
    f => (f.options || []).length >= (f.minOptions || 1),
  );

  // "All" means nothing is set — computed from the fields actually shown plus
  // the chips, so adding a filter can't leave this stale.
  const keys = [...shown.map(f => f.key), ...chips.map(c => c.key), 'mine'];
  const isAll = !keys.some(k => filters[k]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={S.filterbar}
      contentContainerStyle={S.filterbarContent}
    >
      <TouchableOpacity
        onPress={() => onChange({})}
        style={[S.chip, isAll && S.chipActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: isAll }}
      >
        <Text style={[S.chipText, isAll && S.chipTextActive]}>All</Text>
      </TouchableOpacity>

      {showMine && (
        <TouchableOpacity
          onPress={() => set({ mine: filters.mine ? undefined : 'true' })}
          style={[S.chip, !!filters.mine && S.chipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: !!filters.mine }}
        >
          <Text style={[S.chipText, !!filters.mine && S.chipTextActive]}>
            {mineLabel}
          </Text>
        </TouchableOpacity>
      )}

      {/* One-tap toggles, e.g. "Overdue". */}
      {chips.map(c => {
        const on = filters[c.key] === c.value;
        return (
          <TouchableOpacity
            key={c.key}
            onPress={() => set({ [c.key]: on ? undefined : c.value })}
            style={[S.chip, on && S.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[S.chipText, on && S.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}

      {shown.map(f => (
        <Select
          key={f.key}
          pill
          label={f.label}
          placeholder={f.label}
          active={!!filters[f.key]}
          value={filters[f.key]}
          options={[{ label: f.any, value: '' }, ...(f.options || [])]}
          onChange={v => set({ [f.key]: v })}
        />
      ))}
    </ScrollView>
  );
};

export const SLACard = ({ pct = 0, target = 90, breached = 0 }) => {
  const met = pct >= target;
  return (
    <View style={S.card}>
      <View style={S.split}>
        <Text style={S.bold}>SLA Performance</Text>
        <Text
          style={[
            S.tiny,
            { color: met ? C.green2 : C.red, fontFamily: F.semibold },
          ]}
        >
          {pct}%
        </Text>
      </View>
      <View style={{ height: 10 }} />
      <View style={S.progress}>
        <View
          style={[
            S.bar,
            {
              width: `${Math.max(0, Math.min(100, pct))}%`,
              backgroundColor: met ? C.green : C.red,
            },
          ]}
        />
      </View>
      <Text style={[S.tiny, { marginTop: 10 }]}>
        Target: {target}% tickets closed within SLA.
        {breached > 0
          ? ` ${breached} ticket${
              breached === 1 ? ' has' : 's have'
            } missed the deadline.`
          : ' Nothing has missed a deadline.'}
      </Text>
    </View>
  );
};

// ─── Breakdown table ─────────────────────────────────────────────────────────
// The mockup's "Location-wise Open Tickets" and "Department Pressure", rendered
// as a compact table (chosen over the old bar-card stack: denser and easier to
// scan across many locations). One row per branch/department, busiest first,
// tap a row to filter the ticket list to it.
//
// The column header (Location · Open · Overdue) is FIXED: it sits outside the
// scrolling body, so it stays visible while the rows scroll. The body has its
// own bounded ScrollView (nestedScrollEnabled) rather than growing unbounded
// inside the page — that's what lets the header stay put. With only a few rows
// the body simply shows them all and doesn't scroll.
const BREAKDOWN_BODY_MAX_HEIGHT = 320; // ~7 rows before the body scrolls

export const BreakdownList = ({
  rows = [],
  nameKey,
  onPress,
  emptyText = 'No open tickets.',
  nameLabel,
  countLabel = 'Open',
  // Which number the row shows. Ticketing counts tickets, so 'open' is right.
  // Recruitment's card is headed "Open positions", and one requisition can be
  // for five nurses — so it passes 'positions' and gets the number the heading
  // actually promises.
  countKey = 'open',
}) => {
  if (!rows.length) {
    return (
      <View style={[S.card, S.empty]}>
        <Text style={S.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  // Busiest first, so the row needing attention is at the top.
  const sorted = [...rows].sort(
    (a, b) => (b[countKey] || 0) - (a[countKey] || 0),
  );
  // Derived from the key by default, and overridable — this used to be a
  // two-way guess that headed recruitment's unit table "Location".
  const HEADINGS = {
    department: 'Department',
    unit: 'Unit',
    branch: 'Location',
    location: 'Location',
  };
  const nameHeader = nameLabel || HEADINGS[nameKey] || 'Name';

  return (
    <View
      style={[
        S.card,
        { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
      ]}
    >
      {/* Fixed header row */}
      <View style={[S.breakdownRow, S.breakdownHead]}>
        <Text style={[S.breakdownHeadText, { flex: 1 }]}>{nameHeader}</Text>
        <Text style={[S.breakdownHeadText, S.breakdownNumCol]}>Open</Text>
        <Text style={[S.breakdownHeadText, S.breakdownOverdueCol]}>
          Overdue
        </Text>
      </View>

      {/* Scrolling body — header above stays put. */}
      <ScrollView
        style={{ maxHeight: BREAKDOWN_BODY_MAX_HEIGHT }}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {sorted.map((r, i) => {
          const open = r.open || 0;
          const overdue = r.overdue || 0;
          return (
            <TouchableOpacity
              key={r[nameKey]}
              onPress={() => onPress(r)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={
                `${r[nameKey]}, ${open} open` +
                (overdue > 0 ? `, ${overdue} overdue` : '') +
                '. Tap to view these tickets.'
              }
              style={[
                S.breakdownRow,
                i === sorted.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={[S.breakdownName, { flex: 1 }]} numberOfLines={1}>
                {r[nameKey]}
              </Text>
              <Text style={[S.breakdownOpen, S.breakdownNumCol]}>{open}</Text>
              <Text
                style={[
                  S.breakdownNumCol,
                  S.breakdownOverdueCol,
                  overdue > 0 ? S.breakdownOverdueOn : S.breakdownOverdueOff,
                ]}
              >
                {overdue > 0 ? overdue : '—'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ─── Section heading ─────────────────────────────────────────────────────────
// CSS: .list-title
export const ListTitle = ({ children, hint }) => (
  <View style={S.listTitle}>
    <Text style={S.listTitleText}>{children}</Text>
    {!!hint && <Text style={S.tiny}>{hint}</Text>}
  </View>
);

// ─── Ticket card ─────────────────────────────────────────────────────────────
// CSS: .ticket — id · center, issue type, description, owner, age, badges.
export const TicketCard = ({ ticket, onPress, footer }) => (
  <TouchableOpacity
    style={S.card}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.8}
    accessibilityRole={onPress ? 'button' : 'text'}
  >
    <View style={S.ticketHead}>
      <View style={{ flex: 1 }}>
        <Text style={S.ticketId}>
          {ticket.id} · {ticket.center}
        </Text>
        <Text style={S.ticketTitle}>{ticket.issueType}</Text>
        <Text style={S.ticketMeta}>{ticket.description}</Text>
        <Text style={[S.ticketMeta, { marginTop: 4 }]}>
          Owner:{' '}
          <Text style={{ fontFamily: F.semibold, color: C.text }}>
            {ticket.owner}
          </Text>
          {'  ·  '}
          Age: {ticket.age} day{ticket.age === 1 ? '' : 's'}
        </Text>
        {/* Who raised it. On the cluster head's list this is how you tell one
            branch's report from another's; on the partner's branch-wide list it
            is how you tell your own tickets from your branch admin's. */}
        {!!ticket.raisedBy && (
          <Text style={S.ticketMeta}>
            Raised by:{' '}
            <Text style={{ fontFamily: F.medium, color: C.text }}>
              {ticket.raisedBy}
            </Text>
            {ticket.raisedByRole === 'ClusterHead' ? ' (Cluster Head)' : ''}
          </Text>
        )}
      </View>
    </View>

    <View style={S.badges}>
      <Badge tone={ticket.priority}>{ticket.priority}</Badge>
      <Badge>{ticket.center}</Badge>
      <Badge>{ticket.department}</Badge>
      {/* The five-word vocabulary, not the internal workflow state. */}
      <Badge tone={ticket.displayStatus || ticket.status}>
        {ticket.displayStatus || ticket.status}
      </Badge>
      {!!ticket.overdue && <Badge tone="overdue">Overdue</Badge>}
    </View>

    {footer}
  </TouchableOpacity>
);

// ─── Empty state ─────────────────────────────────────────────────────────────
export const Empty = ({ children = 'No tickets found.' }) => (
  <View style={[S.card, S.empty]}>
    <Text style={S.emptyText}>{children}</Text>
  </View>
);

// ─── Toast ───────────────────────────────────────────────────────────────────
export const Toast = ({ message }) =>
  message ? (
    <View style={S.toast} pointerEvents="none" accessibilityLiveRegion="polite">
      <Text style={S.toastText}>{message}</Text>
    </View>
  ) : null;

// ─── Bottom nav ──────────────────────────────────────────────────────────────
// CSS: nav — one column per tab.
export const BottomNav = ({ tabs, active, onChange }) => {
  if (!tabs || tabs.length < 2) return null;
  return (
    <View style={S.nav}>
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[S.navBtn, on && S.navBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[S.navText, on && S.navTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/** One-line toast helper: `const [msg, toast] = useToast()`. */
export function useToast() {
  const [message, setMessage] = useState('');
  const show = (m, ms = 2200) => {
    setMessage(m);
    setTimeout(() => setMessage(''), ms);
  };
  return [message, show];
}

// ─── Date field ──────────────────────────────────────────────────────────────
// A tappable field that opens a month calendar, replacing the YYYY-MM-DD text
// box people had to type into. Built from React Native primitives on purpose:
// a picker package would mean an install and a pod step before anyone could use
// it, and this project already carries one optional-dependency shim.
//
// Dates are handled as plain YYYY-MM-DD strings and constructed with local date
// parts, never parsed through UTC — `new Date('2026-08-10')` is midnight UTC,
// which lands on the 9th west of Greenwich and silently shifts every date by a
// day.
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = n => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Parse YYYY-MM-DD into local parts, or null. */
function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** "10 Aug 2026" — short, unambiguous, and not locale-dependent. */
export function formatISO(s) {
  const p = parseISO(s);
  if (!p) return '';
  return `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
}

export const DateField = ({
  value,
  onChange,
  placeholder = 'Select a date',
  minDate,
  maxDate,
  disabled,
  label,
}) => {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const today = new Date();

  // The month on show. Opens on the chosen date, else today.
  const [view, setView] = useState(() =>
    selected
      ? { y: selected.y, m: selected.m }
      : { y: today.getFullYear(), m: today.getMonth() },
  );

  // Guard the grid maths. `Array(n)` throws RangeError on NaN, which would
  // blank the whole screen rather than fail politely — so neither length is
  // ever allowed to be anything but a sane integer.
  const safeY = Number.isFinite(view?.y) ? view.y : today.getFullYear();
  const safeM = Number.isFinite(view?.m)
    ? Math.min(Math.max(view.m, 0), 11)
    : today.getMonth();

  const min = parseISO(minDate);
  const max = parseISO(maxDate);
  const cmp = (a, b) => a.y - b.y || a.m - b.m || a.d - b.d;
  const outOfRange = day => {
    const c = { y: safeY, m: safeM, d: day };
    if (min && cmp(c, min) < 0) return true;
    if (max && cmp(c, max) > 0) return true;
    return false;
  };

  const rawFirst = new Date(safeY, safeM, 1).getDay();
  const rawDays = new Date(safeY, safeM + 1, 0).getDate();
  const firstWeekday = Number.isFinite(rawFirst) ? rawFirst : 0;
  const daysInMonth = Number.isFinite(rawDays) ? rawDays : 30;
  // Leading blanks so the 1st sits under the right weekday.
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = step =>
    setView(v => {
      const m = v.m + step;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });

  const isToday = d =>
    d === today.getDate() &&
    safeM === today.getMonth() &&
    safeY === today.getFullYear();
  const isSelected = d =>
    selected &&
    selected.d === d &&
    selected.m === safeM &&
    selected.y === safeY;

  const choose = (y, m, d) => {
    onChange(toISO(y, m, d));
    setOpen(false);
  };

  const toggle = () => {
    if (disabled) return;
    // Jump the calendar to the chosen date each time it opens, so reopening
    // after a change doesn't leave you on the wrong month.
    if (!open) {
      const s = parseISO(value);
      setView(
        s
          ? { y: s.y, m: s.m }
          : { y: today.getFullYear(), m: today.getMonth() },
      );
    }
    setOpen(o => !o);
  };

  return (
    <View>
      <TouchableOpacity
        onPress={toggle}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label || placeholder}: ${
          formatISO(value) || 'not set'
        }`}
        style={[
          S.input,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text style={[S.inputText, !value && S.placeholder, { flex: 1 }]}>
          {formatISO(value) || placeholder}
        </Text>
        <Text style={{ fontSize: 13 }}>{open ? '▴' : '📅'}</Text>
      </TouchableOpacity>

      {/* The calendar expands IN PLACE rather than in its own Modal.
          This field is used inside bottom sheets that are themselves Modals,
          and a Modal inside a Modal is unreliable on the New Architecture —
          it can fail to present or throw outright. Expanding inline sidesteps
          that entirely, and reads better in a sheet anyway. */}
      {open && (
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: C.white,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 8,
              paddingVertical: 10,
              backgroundColor: C.green,
            }}
          >
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={{ paddingHorizontal: 12 }}
            >
              <Text style={{ color: C.white, fontSize: 20, lineHeight: 22 }}>
                ‹
              </Text>
            </TouchableOpacity>
            <Text
              style={{ color: C.white, fontFamily: F.semibold, fontSize: 14 }}
            >
              {MONTHS[safeM]} {safeY}
            </Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              style={{ paddingHorizontal: 12 }}
            >
              <Text style={{ color: C.white, fontSize: 20, lineHeight: 22 }}>
                ›
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 8 }}>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((w, i) => (
                <View
                  key={i}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text
                    style={{
                      fontFamily: F.semibold,
                      fontSize: 11,
                      color: C.muted,
                    }}
                  >
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row' }}>
                {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
                  if (d === null)
                    return (
                      <View key={`b${i}`} style={{ flex: 1, height: 38 }} />
                    );
                  const off = outOfRange(d);
                  const on = isSelected(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      disabled={off}
                      onPress={() => choose(safeY, safeM, d)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: !!on, disabled: off }}
                      accessibilityLabel={`${d} ${MONTHS[safeM]} ${safeY}`}
                      style={{
                        flex: 1,
                        height: 38,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: on
                            ? C.green
                            : isToday(d)
                            ? C.navActiveBg
                            : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily:
                              on || isToday(d) ? F.semibold : F.regular,
                            fontSize: 13.5,
                            color: off
                              ? C.line
                              : on
                              ? C.white
                              : isToday(d)
                              ? C.green
                              : C.text,
                          }}
                        >
                          {d}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <TouchableOpacity
              onPress={() => {
                const t = new Date();
                choose(t.getFullYear(), t.getMonth(), t.getDate());
              }}
              accessibilityRole="button"
              style={{ alignItems: 'center', paddingVertical: 8, marginTop: 2 }}
            >
              <Text
                style={{ fontFamily: F.semibold, fontSize: 13, color: C.green }}
              >
                Today
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
