/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// TicketDetail.js
// ─────────────────────────────────────────────────────────────────────────────
// One ticket: what it is, where it has been, and what this person can do next.
//
// This is the screen the whole workflow runs through — every role acts here, and
// each sees a different set of buttons:
//
//   Cluster Head    Approve · Reject · Re-route
//   Dept Head       Assign · Wrong department · Approve fix · Send back
//   Dept User       Start work · Waiting on vendor · Mark fixed
//   Partner/raiser  Close ticket · Reopen
//
// None of that is decided here. The server sends `ticket.actions` and this
// screen renders a button per entry, labelled from ACTION_UI. A role that gains
// or loses a power needs no change in this file.
//
// Every action that changes hands asks for a reason first, and the reason lands
// in the timeline. That is the difference between an audit trail and a log.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
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

import {
  actOnTicket,
  buildActor,
  fetchAssignees,
  fetchTicket,
  getMeta,
} from './api';
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
 *   needs:   'remark' | 'assignee' | 'department' | 'progress' | null
 *   tone:    styles the button
 */
const ACTION_UI = {
  // Approving takes a department because this is the last cheap moment to fix
  // it. A partner picking the wrong one is common, and the alternative is the
  // department head reverting and the cluster head re-routing — two more steps
  // and a delay, for something visible right here. Pre-filled with whatever was
  // chosen, so leaving it alone is the default.
  approve: {
    label: 'Approve',
    tone: 'primary',
    needs: 'department',
    title: 'Approve this ticket?',
    body: 'It goes to the department head to assign. Change the department below if it was raised against the wrong one.',
  },
  reject: {
    label: 'Reject',
    tone: 'danger',
    needs: 'remark',
    title: 'Reject this ticket',
    body: 'Tell them why — they will see this.',
  },
  route: {
    label: 'Send to right department',
    tone: 'primary',
    needs: 'department',
    title: 'Re-route this ticket',
    body: 'Pick the department this should have gone to.',
  },
  assign: {
    label: 'Assign to someone',
    tone: 'primary',
    needs: 'assignee',
    title: 'Assign this ticket',
    body: 'Pick who in your department will fix it.',
  },
  revert: {
    label: 'Wrong department',
    tone: 'secondary',
    needs: 'remark',
    title: 'Send back to the Cluster Head',
    body: 'Say which department this belongs to.',
  },
  progress: {
    label: 'Update progress',
    tone: 'secondary',
    needs: 'progress',
    title: 'Update progress',
    body: 'Where has this got to?',
  },
  fix: {
    label: 'Mark fixed',
    tone: 'primary',
    needs: 'remark',
    title: 'Mark this fixed',
    body: 'What did you do? Your department head reads this before signing off.',
  },
  deptApprove: {
    label: 'Approve fix',
    tone: 'primary',
    needs: null,
    title: 'Approve this fix?',
    body: 'The person who raised it can then close it.',
  },
  sendBack: {
    label: 'Send back',
    tone: 'danger',
    needs: 'remark',
    title: 'Send this back',
    body: 'Say what is still wrong.',
  },
  close: {
    label: 'Close ticket',
    tone: 'primary',
    needs: null,
    title: 'Close this ticket?',
    body: 'This finishes it. You can’t undo a close.',
  },
  reopen: {
    label: 'Reopen',
    tone: 'danger',
    needs: 'remark',
    title: 'Reopen this ticket',
    body: 'Say what is still not right.',
  },
};

/** Timeline wording. Reads as a sentence: "<name> approved it". */
const ACTIVITY_VERB = {
  RAISED: 'raised this',
  APPROVED: 'approved it',
  REJECTED: 'rejected it',
  ROUTED: 're-routed it',
  ASSIGNED: 'assigned it',
  REVERTED: 'sent it back — wrong department',
  PROGRESS: 'updated progress',
  FIXED: 'marked it fixed',
  DEPT_APPROVED: 'approved the fix',
  SENT_BACK: 'sent the fix back',
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
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(null); // { action, remark, value }
  const [preview, setPreview] = useState(null); // an attachment shown full-size
  const [toastMsg, toast] = useToast();

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

        // Only a department head ever needs the assignee list.
        if ((t.actions || []).includes('assign')) {
          try {
            const r = await fetchAssignees(a, t.department);
            setAssignees(r?.users || []);
          } catch (_) {
            setAssignees([]);
          }
        }
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
    const ui = ACTION_UI[action];
    if (!ui) return;

    if (!ui.needs) {
      Alert.alert(ui.title, ui.body, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: ui.label,
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: () => run(action),
        },
      ]);
      return;
    }

    setPrompt({
      action,
      remark: '',
      value:
        ui.needs === 'assignee'
          ? assignees[0]?.mobile || ''
          : ui.needs === 'department'
          ? // Approving starts on the CURRENT department — the cluster head is
            // confirming or correcting, not choosing from scratch. Routing starts
            // blank, because picking a different one is the whole point there.
            action === 'approve'
            ? ticket.department || ''
            : ''
          : ui.needs === 'progress'
          ? 'In Progress'
          : '',
    });
  };

  const submitPrompt = () => {
    const { action, remark, value } = prompt;
    const ui = ACTION_UI[action];

    if (ui.needs === 'remark' && !remark.trim())
      return toast('Add a short reason first.');
    if (ui.needs === 'assignee' && !value)
      return toast('Pick who this goes to.');
    if (ui.needs === 'department' && !value) return toast('Pick a department.');

    const payload = { remark: remark.trim() || undefined };
    if (ui.needs === 'assignee') payload.assigneeMobile = value;
    if (ui.needs === 'department') payload.department = value;
    if (ui.needs === 'progress') payload.toStatus = value;
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
  const ui = prompt ? ACTION_UI[prompt.action] : null;

  return (
    <SafeAreaView style={S.screen} edges={['top']}>
      <DetailHeader
        onBack={() => navigation.goBack()}
        title={ticket.id}
        pill={ticket.displayStatus || ticket.status}
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
            <Badge tone={ticket.displayStatus || ticket.status}>
              {ticket.displayStatus || ticket.status}
            </Badge>
            {!!ticket.overdue && <Badge tone="overdue">Overdue</Badge>}
          </View>

          {/* The status word alone doesn't say whose move it is. This does. */}
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              backgroundColor: C.bg,
              borderWidth: 1,
              borderColor: C.line,
            }}
          >
            <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.text }}>
              {/* Keyed on the precise workflow state on purpose: "Open" as a
                  word is the same for a ticket awaiting approval and one
                  awaiting assignment, and this line is where that difference
                  is worth spelling out. */}
              {STATUS_HINT[ticket.status] || ticket.status}
            </Text>
          </View>
        </View>

        {/* Facts */}
        <View style={S.card}>
          <Text style={[S.bold, { marginBottom: 8 }]}>Details</Text>
          <Row
            k="Raised by"
            v={`${ticket.raisedBy} (${
              ticket.raisedByRole === 'ClusterHead' ? 'Cluster Head' : 'Partner'
            })`}
          />
          <Row k="Raised on" v={fmt(ticket.raisedAt)} />
          <Row k="Age" v={`${ticket.age} day${ticket.age === 1 ? '' : 's'}`} />
          <Row
            k="Target fix by"
            v={fmt(ticket.dueAt)}
            danger={ticket.overdue}
          />
          <Row k="Owner" v={ticket.owner} />
          {!!ticket.assigneeName && (
            <Row k="Assigned to" v={ticket.assigneeName} />
          )}
          {!!ticket.approvedByName && (
            <Row k="Approved by" v={ticket.approvedByName} />
          )}
          {!!ticket.deptApprovedByName && (
            <Row k="Fix signed off by" v={ticket.deptApprovedByName} />
          )}
          {!!ticket.closedByName && (
            <Row k="Closed by" v={ticket.closedByName} />
          )}
          {ticket.reopenCount > 0 && (
            <Row k="Reopened" v={`${ticket.reopenCount}×`} danger />
          )}
          {ticket.revertCount > 0 && (
            <Row k="Sent back" v={`${ticket.revertCount}×`} danger />
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
              const cfg = ACTION_UI[a];
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

                  {ui?.needs === 'assignee' && (
                    <Field label="Assign to">
                      <Select
                        label="Assign to"
                        placeholder={
                          assignees.length
                            ? 'Pick a team member'
                            : 'No one in your department yet'
                        }
                        value={prompt.value}
                        options={assignees.map(u => ({
                          label: u.name,
                          value: u.mobile,
                          hint: `${u.openTickets} open`,
                        }))}
                        onChange={v => setPrompt({ ...prompt, value: v })}
                        disabled={!assignees.length}
                      />
                      {!assignees.length && (
                        <Text style={[S.tiny, { marginTop: 6, color: C.red }]}>
                          Add someone to your department on the My Team tab
                          first.
                        </Text>
                      )}
                    </Field>
                  )}

                  {ui?.needs === 'department' && (
                    <Field
                      label={
                        prompt.action === 'approve'
                          ? 'Department'
                          : 'Send it to'
                      }
                    >
                      <Select
                        label="Department"
                        placeholder="Pick a department"
                        value={prompt.value}
                        // Approving keeps the current department in the list —
                        // most tickets are right, and removing it would force a
                        // change. Routing hides it, since re-routing to the same
                        // department is exactly what the revert objected to.
                        options={
                          prompt.action === 'approve'
                            ? meta?.departments || []
                            : (meta?.departments || []).filter(
                                d => d !== ticket.department,
                              )
                        }
                        onChange={v => setPrompt({ ...prompt, value: v })}
                      />
                      {prompt.action === 'approve' &&
                        prompt.value !== ticket.department && (
                          <Text
                            style={[S.tiny, { marginTop: 6, color: C.orange }]}
                          >
                            Moving this from {ticket.department} to{' '}
                            {prompt.value}.
                          </Text>
                        )}
                    </Field>
                  )}

                  {ui?.needs === 'progress' && (
                    <Field label="Status">
                      <Select
                        label="Status"
                        value={prompt.value}
                        options={['In Progress', 'Waiting for Vendor']}
                        onChange={v => setPrompt({ ...prompt, value: v })}
                      />
                    </Field>
                  )}

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
