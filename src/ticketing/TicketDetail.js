/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// TicketDetail.js
// ─────────────────────────────────────────────────────────────────────────────
// One ticket: what it is, where it has been, and what this person can do next.
//
// This is the screen the whole workflow runs through — every role acts here, and
// each sees a different set of buttons:
//
//   Cluster Head    Approve · Reconsider
//   Dept Head       Update progress · Re-assign · Forward · Resolve · Close
//   Partner/raiser  Reopen
//
// None of that is decided here. The server sends `ticket.actions` and this
// screen renders a button per entry, labelled from ACTION_UI. A role that gains
// or loses a power needs no change in this file.
//
// Every action that changes hands asks for a reason first, and the reason lands
// in the timeline. That is the difference between an audit trail and a log.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { actOnTicket, buildActor, fetchTicket, getMeta } from './api';
import { listAssignees } from './api';
import {
  Badge,
  Btn,
  Field,
  Input,
  Select,
  Toast,
  useToast,
} from './components';
import { C, F, S, STATUS_HINT } from './theme';

/**
 * How each server action presents itself.
 *   needs:   'remark' | 'approval' | 'departmentReason' | 'progress' | null
 *   tone:    styles the button
 */
const ACTION_UI = {
  // PDF §4 and §7 — approving is three decisions at once: which department,
  // what priority, and how long they get. All three are the Cluster Head's call
  // and all three land in the trail, so they belong in one confirmation rather
  // than three screens. Pre-filled from the ticket, so approving unchanged is
  // one tap.
  approve: {
    label: 'Approve',
    tone: 'primary',
    needs: 'approval',
    title: 'Approve this ticket',
    body: 'Confirm the department and priority, and set how long the fix should take.',
  },
  reconsider: {
    label: 'Reconsider',
    tone: 'danger',
    needs: 'remark',
    title: 'Send back for reconsideration',
    body: 'Say what needs rethinking — the branch reads this.',
  },
  // Local fix (Operations). Shown only when the server offers it, and it only
  // offers it for a flagged department — so no department check is needed here.
  sendToBranch: {
    label: 'Send to branch to fix',
    tone: 'secondary',
    needs: 'localFix',
    title: 'Send this to the branch',
    body: 'The branch fixes this one themselves. Set how long they have — you sign it off when it is done.',
  },
  fixedLocally: {
    label: 'Fixed locally',
    tone: 'primary',
    needs: 'remark',
    title: 'Mark this fixed',
    body: 'What did you do? Your Cluster Head reviews this before resolving it.',
  },
  resolveLocal: {
    label: 'Mark resolved',
    tone: 'primary',
    needs: 'remark',
    title: 'Resolve this ticket',
    body: 'Confirm the branch has fixed it. They can still reopen if not.',
  },
  closeLocal: {
    label: 'Close ticket',
    tone: 'primary',
    needs: null,
    title: 'Close this ticket?',
    body: 'Only do this if the issue is actually sorted. You can still reopen it later if it comes back.',
  },
  progress: {
    label: 'Update progress',
    tone: 'primary',
    needs: 'progress',
    title: 'Where has this got to?',
    body: 'Pick Done when the work is finished — your department head reviews it before the branch is told.',
  },
  // PDF §5 — replaces "Wrong department". The head moves it directly instead of
  // bouncing it back to the Cluster Head to re-route.
  reassign: {
    label: 'Re-assign to different department',
    tone: 'secondary',
    needs: 'departmentReason',
    title: 'Re-assign this ticket',
    body: 'This is not your department’s work. Pick whose it is — it leaves your queue.',
  },
  forward: {
    label: 'Forward to another department',
    tone: 'secondary',
    needs: 'departmentReason',
    title: 'Forward this ticket',
    body: 'Your part is done. Pick the department that continues it.',
  },
  resolve: {
    label: 'Mark resolved',
    tone: 'primary',
    needs: 'remark',
    title: 'Mark this resolved',
    body: 'What did you do? The branch reads this.',
  },
  close: {
    label: 'Close ticket',
    tone: 'primary',
    needs: null,
    title: 'Close this ticket?',
    body: 'This finishes it.',
  },
  reopen: {
    label: 'Reopen',
    tone: 'danger',
    needs: 'remark',
    title: 'Reopen this ticket',
    body: 'Say what is still not right.',
  },
  assign: {
    label: 'Assign',
    tone: 'primary',
    needs: 'assignee',
    title: 'Who is taking this?',
    body: 'They will see it in their queue and can update it from there.',
  },
  fix: {
    label: 'Mark as fixed',
    tone: 'primary',
    needs: 'remark',
    title: 'Mark this fixed?',
    body: 'Say what you did. Your department head reviews it before the branch is told.',
  },
  deptApprove: {
    label: 'Approve the fix',
    tone: 'primary',
    needs: 'remark',
    title: 'Approve this fix?',
    body: 'This resolves the ticket and tells the branch.',
  },
  sendBack: {
    label: 'Send back',
    tone: 'danger',
    needs: 'remark',
    title: 'Send this back?',
    body: 'It returns to the same person. Say what still needs doing.',
  },
};

/**
 * ACTION_UI, with the assign copy rewritten when someone already holds the
 * ticket. `assign` is legal from every active state deliberately — that is the
 * reassign path — but a bare "Assign" on a ticket that already has a name on it
 * tells the head nothing about which of the two they are doing.
 */
function uiFor(action, ticket) {
  const base = ACTION_UI[action];
  if (!base || action !== 'assign' || !ticket?.assigneeName) return base;
  return {
    ...base,
    label: 'Reassign',
    title: `Move this off ${ticket.assigneeName}?`,
    body: `${ticket.assigneeName} has it now. Whoever you pick takes it over, and ${ticket.assigneeName} stops seeing it.`,
  };
}

// What this person is being asked to do, when the ticket is on their desk.
// Ordered by precedence: a ticket offering several moves is named by the one
// that is genuinely a decision — approving outranks commenting on it.
//
// `comment` and `progress` are deliberately absent. Commenting is always
// available to everyone, and updating progress is something you MAY do rather
// than something the ticket is waiting on — treating either as "your move"
// would light this box up on every ticket and make it mean nothing.
const MY_TURN = {
  approve: 'At your stage for approval',
  reconsider: 'At your stage for approval',
  // Same wording as approve on purpose: a Cluster Head looking at an Open
  // ticket is at the approval stage whichever way they send it.
  sendToBranch: 'At your stage for approval',
  fixedLocally: 'With your branch — fix it and mark it done here',
  resolveLocal: 'Fixed at the branch — resolve it if you are satisfied',
  closeLocal: 'With you — close it once you are satisfied',
  resolve: 'With you — resolve it when the work is done',
  close: 'Fixed? Close it. Not fixed? Reopen it.',
  reassign: 'With you — resolve it, or move it to the right department',
  forward: 'With you — resolve it, or move it to the right department',
  reopen: 'Resolved. Reopen it if it is still not right.',
  fix: 'With you — update it, or mark it fixed when it is done.',
  deptApprove: 'Your team says this is fixed. Approve it or send it back.',
  assign: 'In your department. Take it yourself or hand it to someone.',
};

// Offered as words rather than a number box: "2 days" is what a Cluster Head is
// actually deciding, and an open field invites 5 or 5000 by accident.
const SLA_OPTIONS = [
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: '1 day', hours: 24 },
  { label: '2 days', hours: 48 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
  { label: '2 weeks', hours: 336 },
];

const SLA_DEFAULT = { Critical: '8 hours', Medium: '3 days', Low: '1 week' };

/** Timeline wording. Reads as a sentence: "<name> approved it". */
const ACTIVITY_VERB = {
  RAISED: 'raised this',
  APPROVED: 'approved it',
  SENT_BACK: 'sent it back to be reconsidered',
  REASSIGNED: 're-assigned it — wrong department',
  FORWARDED: 'forwarded it',
  PROGRESS: 'updated progress',
  RESOLVED: 'resolved it',
  CLOSED: 'closed it',
  REOPENED: 'reopened it',
  COMMENT: 'commented',
};

const TicketDetail = ({ navigation, route }) => {
  const { id, onChanged } = route.params || {};
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);

  const [actor, setActor] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(null); // { action, remark, value }
  const [preview, setPreview] = useState(null); // an attachment shown full-size
  const [toastMsg, toast] = useToast();
  const [assignees, setAssignees] = useState([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);

  const loadAssignees = useCallback(async () => {
    if (assignees.length || assigneesLoading) return;
    setAssigneesLoading(true);
    try {
      const res = await listAssignees(actor);
      setAssignees(res.assignees || []);
    } catch (e) {
      toast(e?.message || 'Could not load your team.');
    } finally {
      setAssigneesLoading(false);
    }
  }, [actor, assignees.length, assigneesLoading, toast]);

  // Name AND mobile: two people called Rahul in one department is not
  // hypothetical, and assigning to the wrong one is invisible until somebody
  // asks why nothing has happened. The mobile is the key, so this cannot clash.
  const labelFor = a => `${a.name} · ${a.mobile}`;
  const assigneeOptions = useMemo(() => assignees.map(labelFor), [assignees]);
  const mobileByLabel = useMemo(() => {
    const m = {};
    assignees.forEach(a => {
      m[labelFor(a)] = a.mobile;
    });
    return m;
  }, [assignees]);

  // "Done" appears only when the server says `fix` is actually allowed. That
  // keeps the dropdown honest for a head using progress on an unassigned
  // ticket, where finishing is not on offer — rather than showing an option
  // that fails on submit.
  const progressOptions = useMemo(() => {
    const base = ['In Progress', 'On Hold'];
    return (ticket?.actions || []).includes('fix') ? [...base, 'Done'] : base;
  }, [ticket]);

  const doneChosen = prompt?.action === 'progress' && prompt?.value === 'Done';

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const a = await buildActor({ role, subRole, location, locationArray });
        setActor(a);
        const [t, m] = await Promise.all([
          fetchTicket(a, id),
          getMeta().catch(() => null),
        ]);
        setTicket(t);
        if (m) setMeta(m);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role, subRole, location, locationArray, id],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const run = async (action, payload = {}) => {
    setBusy(true);
    try {
      const res = await actOnTicket(actor, ticket.id, action, payload);
      setPrompt(null);
      toast(res.message || 'Done.');
      await load(true);
      onChanged?.();
    } catch (e) {
      Alert.alert('That didn’t go through', e.message);
    } finally {
      setBusy(false);
    }
  };

  const start = action => {
    console.log(
      'start:',
      action,
      'ui?',
      !!ACTION_UI[action],
      'needs:',
      ACTION_UI[action]?.needs,
    );
    const ui = uiFor(action, ticket);

    if (!ui) return;

    // Fetch the team as the sheet opens, not when it is submitted — by then
    // the picker has already rendered empty and disabled. Cheap and lazy: only
    // a head opening the assign sheet ever triggers it, and loadAssignees
    // returns immediately once the list is in hand.
    if (ui.needs === 'assignee') loadAssignees();
    if (!ui.needs) {
      Alert.alert(ui.title, ui.body, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: ui.label,
          style: ui.tone === 'danger' ? 'destructive' : 'default',
          onPress: () => run(action),
        },
      ]);
      return;
    }

    setPrompt({
      action,
      remark: '',
      // Approving starts on the ticket's own department, priority and a
      // resolution time suggested by that priority — the Cluster Head is
      // confirming or correcting, not choosing from scratch. Moving it starts
      // blank, because picking a DIFFERENT one is the whole point there.
      value:
        ui.needs === 'assignee'
          ? // Prefilled on a REASSIGN so the head can see who they are taking
            // it off. Blank on a first assignment.
            ticket.assigneeName && ticket.assigneeMobile
            ? `${ticket.assigneeName} · ${ticket.assigneeMobile}`
            : ''
          : ui.needs === 'approval' || ui.needs === 'localFix'
          ? ticket.department || ''
          : ui.needs === 'progress'
          ? 'In Progress'
          : '',
      priority: ticket.priority || 'Medium',
      sla: SLA_DEFAULT[ticket.priority] || '3 days',
    });
  };

  const submitPrompt = () => {
    const { action, remark, value, priority, sla } = prompt;
    const ui = uiFor(action, ticket);

    // `comment` has no ACTION_UI entry — it is a note, not a workflow action.
    // Without this, ui.needs below throws on every Post.
    if (!ui) {
      if (!remark.trim()) return toast('Write something first.');
      return run(action, { remark: remark.trim() });
    }

    if (ui.needs === 'remark' && !remark.trim())
      return toast('Add a short reason first.');
    if (ui.needs === 'approval') {
      if (!value) return toast('Pick a department.');
      if (!sla) return toast('Set a resolution time.');
    }
    if (ui.needs === 'localFix') {
      if (!sla) return toast('Set a resolution time.');
      if (!remark.trim()) return toast('Say what the branch should do.');
    }
    if (ui.needs === 'assignee' && !value)
      return toast('Choose who takes this.');
    if (ui.needs === 'departmentReason') {
      if (!value) return toast('Pick a department.');
      // The server requires it too, but catching it here saves a round trip and
      // the reason is the whole point of the move.
      if (!remark.trim()) return toast('Say why it is moving.');
    }

    const payload = { remark: remark.trim() || undefined };
    if (ui.needs === 'approval') {
      payload.department = value;
      payload.priority = priority;
      payload.resolutionHours = SLA_OPTIONS.find(o => o.label === sla)?.hours;
    }
    if (ui.needs === 'localFix') {
      payload.priority = priority;
      payload.resolutionHours = SLA_OPTIONS.find(o => o.label === sla)?.hours;
    }
    if (ui.needs === 'assignee') {
      const assigneeMobile = mobileByLabel[value];
      if (!assigneeMobile) return toast('Choose who takes this.');
      payload.assigneeMobile = assigneeMobile;
    }
    if (ui.needs === 'departmentReason') payload.department = value;
    if (ui.needs === 'progress') {
      if (value === 'Done') {
        // Not a progress update — a hand-off. `fix` moves it to Pending
        // Approval, logs FIXED and emails the head; progress does none of that.
        if (!remark.trim()) return toast('Say what you did.');
        return run('fix', { remark: remark.trim() });
      }
      payload.toStatus = value;
    }
    run(action, payload);
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[S.screen, { alignItems: 'center', justifyContent: 'center' }]}
      >
        <ActivityIndicator size="large" color={C.green} />
      </SafeAreaView>
    );
  }

  if (error || !ticket) {
    return (
      <SafeAreaView style={S.screen} edges={['top']}>
        <DetailHeader onBack={() => navigation.goBack()} title="Ticket" />
        <View style={S.main}>
          <View style={[S.card, S.empty]}>
            <Text style={[S.bold, { color: C.red, marginBottom: 6 }]}>
              Can’t show this ticket
            </Text>
            <Text style={S.emptyText}>
              {error || 'It may have been removed.'}
            </Text>
            <Btn
              label="Try again"
              secondary
              small
              onPress={() => load()}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const actions = ticket.actions || [];
  // Does the ticket sit with THIS person? Only moves that are genuinely a
  // decision count — see MY_TURN.
  const yourMove = actions.some(a => MY_TURN[a]);
  const ui = prompt ? uiFor(prompt.action, ticket) : null;

  return (
    <SafeAreaView style={S.screen} edges={['top']}>
      <DetailHeader
        onBack={() => navigation.goBack()}
        title={ticket.id}
        // The workflow state, not displayStatus: displayStatusOf() collapses a
        // late ticket to the single word "Overdue", which would duplicate the
        // red pill beside it AND hide the stage the ticket is actually at.
        pill={ticket.status}
        overdue={ticket.overdue}
      />

      <ScrollView
        contentContainerStyle={S.main}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={C.green}
          />
        }
      >
        {/* What it is */}
        <View style={[S.card, { marginTop: 0 }]}>
          <Text style={S.ticketId}>
            {ticket.id} · {ticket.center}
          </Text>
          <Text style={[S.ticketTitle, { fontSize: 18 }]}>
            {ticket.issueType}
          </Text>
          <Text style={[S.ticketMeta, { fontSize: 13, lineHeight: 19 }]}>
            {ticket.description}
          </Text>

          <View style={S.badges}>
            <Badge tone={ticket.priority}>{ticket.priority}</Badge>
            <Badge>{ticket.department}</Badge>
            <Badge tone={ticket.status}>{ticket.status}</Badge>
            {!!ticket.overdue && <Badge tone="overdue">Overdue</Badge>}
          </View>

          {/* The status word alone doesn't say whose move it is. This does — and
              when the move is THIS person's, it says so plainly instead of
              describing the ticket in the third person.
              
              Keyed on `actions`, not on role: the server already computed what
              this actor may do, so re-deriving it here would be a second copy
              of the permission rules and a chance for the two to disagree. */}
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              backgroundColor: yourMove ? C.lowBg : C.bg,
              borderWidth: 1,
              borderColor: yourMove ? C.green2 : C.line,
            }}
          >
            <Text
              style={{
                fontFamily: yourMove ? F.semibold : F.medium,
                fontSize: 13,
                color: yourMove ? C.green : C.text,
              }}
            >
              {yourMove
                ? MY_TURN[actions.find(a => MY_TURN[a])]
                : STATUS_HINT[ticket.status] || ticket.status}
            </Text>
          </View>
        </View>

        {/* Facts */}
        <View style={S.card}>
          <Text style={[S.bold, { marginBottom: 8 }]}>Details</Text>
          <Row
            k="Raised by"
            v={`${ticket.raisedBy}${
              ticket.raisedByRole === 'SuperAdmin' ? ' (Management)' : ''
            }`}
          />
          <Row k="Raised on" v={fmt(ticket.raisedAt)} />
          <Row k="Age" v={`${ticket.age} day${ticket.age === 1 ? '' : 's'}`} />
          {/* PDF §4 — both are null until a Cluster Head approves and sets them.
              Saying so is better than an em dash, which reads like missing data
              rather than a decision nobody has made yet. */}
          <Row
            k="Resolution time"
            v={ticket.slaHours ? `${ticket.slaHours} hours` : 'Set on approval'}
          />
          <Row
            k="Due"
            v={ticket.dueAt ? fmt(ticket.dueAt) : 'Set on approval'}
            danger={ticket.overdue}
          />
          <Row k="Owner" v={ticket.owner} />
          {!!ticket.approvedByName && (
            <Row k="Approved by" v={ticket.approvedByName} />
          )}
          {/* PDF §2 — the head resolves their own work; there is no separate
              sign-off, and no assignee. */}
          {!!ticket.resolvedByName && (
            <Row k="Resolved by" v={ticket.resolvedByName} />
          )}
          {!!ticket.closedByName && (
            <Row k="Closed by" v={ticket.closedByName} />
          )}
          {ticket.reopenCount > 0 && (
            <Row k="Reopened" v={`${ticket.reopenCount}×`} danger />
          )}
          <Row
            k="Attachments"
            v={
              ticket.attachments?.length
                ? `${ticket.attachments.length} file(s)`
                : 'None'
            }
            last
          />
        </View>

        {/* Attachments — actually show them. Before, the app reported only a
            count and the API didn't even return the image bytes, so a photo a
            user attached was invisible. Images render as tappable thumbnails
            (tap for full-size); anything else shows as a file chip. */}
        {ticket.attachments?.length > 0 && (
          <View style={S.card}>
            <Text style={[S.bold, { marginBottom: 10 }]}>Attachments</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ticket.attachments.map(att =>
                att.isImage && att.src ? (
                  <TouchableOpacity
                    key={att.id}
                    onPress={() => setPreview(att)}
                    activeOpacity={0.85}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`View ${att.fileName}`}
                  >
                    <Image
                      source={{ uri: att.src }}
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 10,
                        backgroundColor: C.line,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : (
                  <View
                    key={att.id}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: C.line,
                      maxWidth: '100%',
                    }}
                  >
                    <Text style={S.tiny} numberOfLines={1}>
                      📎 {att.fileName}
                      {att.fileSize
                        ? ` · ${Math.round(att.fileSize / 1024)} KB`
                        : ''}
                    </Text>
                  </View>
                ),
              )}
            </View>
          </View>
        )}

        {/* What you can do */}
        {actions.length > 0 && (
          <View style={S.card}>
            <Text style={[S.bold, { marginBottom: 2 }]}>Your move</Text>
            <Text style={S.tiny}>This ticket is waiting on you.</Text>
            {actions.map(a => {
              // `fix` is folded into the progress dropdown as "Done". It is
              // still a real, separately-permissioned action — it just no
              // longer gets a button of its own.
              if (a === 'fix') return null;
              const cfg = uiFor(a, ticket);
              if (!cfg) return null;
              return (
                <Btn
                  key={a}
                  label={cfg.label}
                  onPress={() => start(a)}
                  disabled={busy}
                  secondary={cfg.tone === 'secondary'}
                  danger={cfg.tone === 'danger'}
                />
              );
            })}
          </View>
        )}

        {/* Timeline */}
        <View style={S.card}>
          <Text style={[S.bold, { marginBottom: 4 }]}>History</Text>
          {(ticket.activity || []).map((a, i, arr) => (
            <View
              key={i}
              style={{ flexDirection: 'row', gap: 10, paddingVertical: 10 }}
            >
              <View style={{ alignItems: 'center', width: 12 }}>
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: i === arr.length - 1 ? C.green : C.line,
                    marginTop: 5,
                  }}
                />
                {i < arr.length - 1 && (
                  <View
                    style={{
                      flex: 1,
                      width: 1.5,
                      backgroundColor: C.line,
                      marginTop: 3,
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontFamily: F.medium, fontSize: 13, color: C.text }}
                >
                  <Text style={{ fontFamily: F.semibold }}>{a.actorName}</Text>{' '}
                  {ACTIVITY_VERB[a.action] || a.action.toLowerCase()}
                  {a.toStatus && a.toStatus !== a.fromStatus
                    ? ` → ${a.toStatus}`
                    : ''}
                </Text>
                {!!a.remark && (
                  <Text style={[S.tiny, { marginTop: 3, fontStyle: 'italic' }]}>
                    “{a.remark}”
                  </Text>
                )}
                <Text style={[S.tiny, { marginTop: 2 }]}>{fmt(a.at)}</Text>
              </View>
            </View>
          ))}
          <Btn
            label="Add a comment"
            secondary
            small
            onPress={() =>
              setPrompt({ action: 'comment', remark: '', value: '' })
            }
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          />
        </View>
      </ScrollView>

      {/* Full-size image preview — tapping a thumbnail opens it here. */}
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
          onPress={() => setPreview(null)}
        >
          {!!preview?.src && (
            <Image
              source={{ uri: preview.src }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
          <Text
            style={{ color: C.white, marginTop: 14, fontSize: 13 }}
            numberOfLines={1}
          >
            {preview?.fileName} · tap to close
          </Text>
        </Pressable>
      </Modal>

      {/* Prompt sheet: reason / assignee / department / progress */}
      <Modal
        visible={!!prompt}
        transparent
        animationType="slide"
        onRequestClose={() => setPrompt(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: C.drawerOverlay,
              justifyContent: 'flex-end',
            }}
            onPress={() => !busy && setPrompt(null)}
          >
            <Pressable
              style={{
                backgroundColor: C.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 18,
                paddingBottom: 28,
              }}
            >
              {!!prompt && (
                <>
                  <Text style={[S.bold, { fontSize: 17 }]}>
                    {prompt.action === 'comment' ? 'Add a comment' : ui?.title}
                  </Text>
                  <Text style={[S.tiny, { marginTop: 4 }]}>
                    {prompt.action === 'comment'
                      ? 'Everyone who can see this ticket will read it.'
                      : ui?.body}
                  </Text>

                  {ui?.needs === 'approval' && (
                    <>
                      {!!ticket.departmentUnassigned && (
                        <View
                          style={{
                            borderWidth: 1,
                            borderColor: C.red,
                            borderRadius: 14,
                            padding: 12,
                            marginTop: 12,
                          }}
                        >
                          <Text style={[S.tiny, { color: C.red }]}>
                            The branch raised this without a department. Read
                            the description and pick who it belongs to — it
                            cannot be approved unrouted.
                          </Text>
                        </View>
                      )}
                      <Field label="Department" req>
                        <Select
                          label="Department"
                          placeholder="Pick a department"
                          value={prompt.value}
                          options={meta?.departments || []}
                          onChange={v => setPrompt({ ...prompt, value: v })}
                        />
                      </Field>
                      <Field label="Priority">
                        <Select
                          label="Priority"
                          placeholder="Pick a priority"
                          value={prompt.priority}
                          options={meta?.priorities || []}
                          onChange={v => setPrompt({ ...prompt, priority: v })}
                        />
                      </Field>
                      <Field label="Resolution time" req>
                        <Select
                          label="Resolution time"
                          placeholder="How long?"
                          value={prompt.sla}
                          options={SLA_OPTIONS.map(o => o.label)}
                          onChange={v => setPrompt({ ...prompt, sla: v })}
                        />
                      </Field>
                    </>
                  )}

                  {ui?.needs === 'localFix' && (
                    <>
                      <Field label="Priority">
                        <Select
                          label="Priority"
                          value={prompt.priority}
                          options={meta?.priorities || []}
                          onChange={v => setPrompt({ ...prompt, priority: v })}
                        />
                      </Field>
                      <Field label="Resolution time" req>
                        <Select
                          label="Resolution time"
                          placeholder="How long does the branch have?"
                          value={prompt.sla}
                          options={SLA_OPTIONS.map(o => o.label)}
                          onChange={v => setPrompt({ ...prompt, sla: v })}
                        />
                      </Field>
                    </>
                  )}

                  {ui?.needs === 'assignee' && (
                    <>
                      <Field label="Assign to" req>
                        <Select
                          label="Assign to"
                          placeholder={
                            assigneesLoading
                              ? 'Loading your team…'
                              : assigneeOptions.length
                              ? 'Choose who takes this'
                              : 'No one on your team yet'
                          }
                          value={prompt.value}
                          options={assigneeOptions}
                          onChange={v => setPrompt({ ...prompt, value: v })}
                          disabled={assigneesLoading || !assigneeOptions.length}
                        />
                      </Field>
                      {!assigneesLoading && !assigneeOptions.length && (
                        <Text style={[S.tiny, { color: C.red }]}>
                          Add someone on the My Team tab first, or resolve this
                          one yourself.
                        </Text>
                      )}
                    </>
                  )}

                  {ui?.needs === 'departmentReason' && (
                    <>
                      <Field label="Send it to" req>
                        <Select
                          label="Department"
                          placeholder="Pick a department"
                          value={prompt.value}
                          options={(meta?.departments || []).filter(
                            d => d !== ticket.department,
                          )}
                          onChange={v => setPrompt({ ...prompt, value: v })}
                        />
                      </Field>
                      <Field
                        label={
                          prompt.action === 'reassign'
                            ? 'Why is it not yours?'
                            : 'What did you do?'
                        }
                        req
                      >
                        <Input
                          multiline
                          value={prompt.remark}
                          onChangeText={t =>
                            setPrompt({ ...prompt, remark: t })
                          }
                          placeholder={
                            prompt.action === 'reassign'
                              ? 'This belongs with them because…'
                              : 'Our part is done — over to them for…'
                          }
                        />
                      </Field>
                    </>
                  )}

                  {ui?.needs === 'progress' && (
                    <>
                      <Field label="Status">
                        <Select
                          label="Status"
                          value={prompt.value}
                          options={progressOptions}
                          onChange={v => setPrompt({ ...prompt, value: v })}
                        />
                      </Field>
                      {doneChosen && (
                        <Field label="What did you do?" req>
                          <Input
                            multiline
                            value={prompt.remark}
                            onChangeText={t =>
                              setPrompt({ ...prompt, remark: t })
                            }
                            placeholder="Your department head reads this before the branch is told. Example: replaced the compressor fan, tested for an hour."
                          />
                        </Field>
                      )}
                    </>
                  )}

                  {ui?.needs !== 'departmentReason' && (
                    <Field
                      label={prompt.action === 'comment' ? 'Comment' : 'Reason'}
                    >
                      <Input
                        multiline
                        value={prompt.remark}
                        onChangeText={t => setPrompt({ ...prompt, remark: t })}
                        placeholder={
                          prompt.action === 'comment'
                            ? 'Anything the others should know'
                            : 'A line is enough — it goes in the history'
                        }
                      />
                    </Field>
                  )}

                  <View style={S.row}>
                    <View style={S.rowItem}>
                      <Btn
                        label="Cancel"
                        secondary
                        onPress={() => setPrompt(null)}
                        disabled={busy}
                      />
                    </View>
                    <View style={S.rowItem}>
                      <Btn
                        label={prompt.action === 'comment' ? 'Post' : ui?.label}
                        onPress={submitPrompt}
                        loading={busy}
                        danger={ui?.tone === 'danger'}
                      />
                    </View>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Toast message={toastMsg} />
    </SafeAreaView>
  );
};

export default TicketDetail;

// ─── bits ────────────────────────────────────────────────────────────────────

const DetailHeader = ({ onBack, title, pill, overdue }) => (
  <View
    style={{
      backgroundColor: C.green,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
    }}
  >
    <TouchableOpacity
      onPress={onBack}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: C.white, fontSize: 18 }}>‹</Text>
    </TouchableOpacity>
    <Text style={[S.headerLogo, { flex: 1 }]} numberOfLines={1}>
      {title}
    </Text>
    {!!overdue && (
      <View
        style={[
          S.headerPill,
          {
            backgroundColor: 'rgba(217,65,65,0.85)',
            borderColor: 'transparent',
          },
        ]}
      >
        <Text style={S.headerPillText}>Overdue</Text>
      </View>
    )}
    {!!pill && (
      <View style={S.headerPill}>
        <Text style={S.headerPillText}>{pill}</Text>
      </View>
    )}
  </View>
);

const Row = ({ k, v, danger, last }) => (
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 9,
      borderBottomWidth: last ? 0 : 1,
      borderBottomColor: C.line,
    }}
  >
    <Text style={[S.tiny, { fontSize: 12 }]}>{k}</Text>
    <Text
      style={{
        fontFamily: F.medium,
        fontSize: 12.5,
        color: danger ? C.red : C.text,
        flexShrink: 1,
        textAlign: 'right',
      }}
    >
      {v}
    </Text>
  </View>
);

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
