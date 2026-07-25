// ═══════════════════════════════════════════════════════════════════════════
//  Requisition detail — the whole life of one MRF on a single screen.
//
//  Layout, top to bottom, in the order someone actually reads it:
//    1. Status + what happens next  (why am I looking at this?)
//    2. The position at a glance    (position, count, where, target date)
//    3. Offer letters               (one card per position filled)
//    4. The MRF itself              (collapsed — reference, not the daily need)
//    5. History                     (the audit trail)
//    6. Actions                     (buttons the SERVER said this person has)
//
//  As with tickets, the buttons come from the server's `actions` array. The app
//  never decides what someone may do — it renders what it is told, so the two
//  sides cannot disagree.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
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
  actOnRequest,
  addOffer,
  buildActor,
  fetchDepartmentUsers,
  fetchRequest,
  replaceOffer,
  updateOffer,
} from './api';
import pickPhoto, { isPhotoPickerAvailable } from '../ticketing/imagePicker';
import {
  NEXT_STEP,
  STATUS_TONE,
  TICKET_ROLE,
  resolveTicketRole,
} from './roles';
import {
  Badge,
  Btn,
  DateField,
  Field,
  Input,
  Select,
  Toast,
  useToast,
} from '../ticketing/components';
import { C, F, S } from '../ticketing/theme';

const fmt = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const m = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${dt.getDate()} ${m[dt.getMonth()]} ${dt.getFullYear()}`;
};

const Row = ({ k, v, last, danger }) =>
  v === null || v === undefined || v === '' ? null : (
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

// The MRF is long and read rarely, so it starts folded away.
const Collapsible = ({ title, children, open, onToggle }) => (
  <View style={[S.card, { paddingVertical: 0 }]}>
    <TouchableOpacity
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <Text style={S.bold}>{title}</Text>
      <Text style={{ color: C.muted, fontSize: 16 }}>{open ? '−' : '+'}</Text>
    </TouchableOpacity>
    {open && <View style={{ paddingBottom: 12 }}>{children}</View>}
  </View>
);

const RequestDetail = ({ route, navigation }) => {
  const id = route?.params?.id;
  const role = useSelector(state => state.location.role);
  const subRole = useSelector(state => state.location.subRole);
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);
  const ticketRole = resolveTicketRole(role, subRole);

  const [actor, setActor] = useState(null);
  const [req, setReq] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showMRF, setShowMRF] = useState(false);
  const [prompt, setPrompt] = useState(null); // { kind, ... }
  const [toastMsg, toast] = useToast();

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const a = await buildActor({ role, subRole, location, locationArray });
        setActor(a);
        const data = await fetchRequest(a, id);
        setReq(data);
        // The assignee picker is only needed by a head, so only they fetch it.
        if (
          ticketRole === TICKET_ROLE.DEPT_HEAD ||
          ticketRole === TICKET_ROLE.SUPER_ADMIN
        ) {
          fetchDepartmentUsers(a)
            .then(r => setAssignees(r.users || []))
            .catch(() => setAssignees([]));
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, role, subRole, location, locationArray, ticketRole],
  );

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action, payload = {}) => {
    setBusy(true);
    try {
      const res = await actOnRequest(actor, id, action, payload);
      setPrompt(null);
      await load(true);
      toast(res.message || 'Done.');
    } catch (e) {
      Alert.alert('Could not complete that', e.message);
    } finally {
      setBusy(false);
    }
  };

  const doOffer = async (payload, offerId, mode) => {
    setBusy(true);
    try {
      const res =
        mode === 'replace'
          ? await replaceOffer(actor, id, offerId, payload)
          : offerId
          ? await updateOffer(actor, id, offerId, payload)
          : await addOffer(actor, id, payload);
      setPrompt(null);
      await load(true);
      toast(res.message || 'Saved.');
    } catch (e) {
      Alert.alert('Could not save that', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={S.screen} edges={['top']}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="large" color={C.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !req) {
    return (
      <SafeAreaView style={S.screen} edges={['top']}>
        <View style={S.main}>
          <View style={[S.card, S.empty]}>
            <Text style={S.emptyText}>
              {error || 'That requisition could not be loaded.'}
            </Text>
          </View>
          <Btn label="Go back" secondary onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const actions = req.actions || [];
  const offers = req.offers || [];
  const liveOffers = offers.filter(o => o.status !== 'Replaced');

  return (
    <SafeAreaView style={S.screen} edges={['top']}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: C.white, fontSize: 22, lineHeight: 24 }}>
            ‹
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={S.headerLogo} numberOfLines={1}>
            {req.id} · {req.position}
          </Text>
        </View>
      </View>

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
        {/* 1. Where it stands */}
        <View
          style={[
            S.card,
            {
              borderLeftWidth: 3,
              borderLeftColor: req.overdue ? C.red : C.green,
              marginTop: 0,
            },
          ]}
        >
          <View style={S.split}>
            <Badge tone={STATUS_TONE[req.status]}>{req.status}</Badge>
            {req.overdue && <Badge tone="overdue">Overdue</Badge>}
          </View>
          <Text style={[S.bold, { marginTop: 10 }]}>
            {NEXT_STEP[req.status] || req.status}
          </Text>
          <Text style={[S.tiny, { marginTop: 3 }]}>
            {req.numberOfPositions} position
            {req.numberOfPositions === 1 ? '' : 's'} · {req.positionsFilled}{' '}
            filled · {req.positionsRemaining} remaining
          </Text>
        </View>

        {/* 2. At a glance */}
        <View style={S.card}>
          <Row k="Position" v={req.position} />
          <Row k="Department" v={req.forDepartment} />
          <Row k="Unit" v={req.unit} />
          <Row k="Location" v={req.location} />
          <Row k="Type" v={req.employmentType} />
          <Row k="Raised by" v={`${req.raisedBy} · ${fmt(req.raisedAt)}`} />
          <Row k="With" v={req.assigneeName} />
          <Row
            k="Target close"
            v={req.targetCloseDate ? fmt(req.targetCloseDate) : null}
            danger={req.overdue}
          />
          <Row
            k="Days left"
            v={
              req.daysLeft === null || req.daysLeft === undefined
                ? null
                : `${req.daysLeft} day${req.daysLeft === 1 ? '' : 's'}`
            }
            danger={req.daysLeft !== null && req.daysLeft < 0}
          />
          <Row k="Progress" v={req.progressStage} />
          <Row k="Reviewed by" v={req.reviewedBy} />
          <Row k="Outcome" v={req.closeOutcome} />
          <Row
            k="Closed by"
            v={req.closedBy ? `${req.closedBy} · ${fmt(req.closedAt)}` : null}
            last
          />
        </View>

        {(!!req.reviewRemark || !!req.closeRemark) && (
          <View
            style={[S.card, { borderLeftWidth: 3, borderLeftColor: C.orange }]}
          >
            <Text style={S.tiny}>
              {req.closeRemark ? 'Closing note' : 'Review comment'}
            </Text>
            <Text
              style={{
                fontFamily: F.medium,
                fontSize: 12.5,
                color: C.text,
                marginTop: 4,
              }}
            >
              {req.closeRemark || req.reviewRemark}
            </Text>
          </View>
        )}

        {/* 3. Offer letters */}
        {(offers.length > 0 || actions.includes('addOffer')) && (
          <>
            <View style={S.listTitle}>
              <Text style={S.listTitleText}>Offer letters</Text>
              <Text style={S.tiny}>
                {liveOffers.length} of {req.numberOfPositions}
              </Text>
            </View>

            {offers.map((o, i) => {
              const replaced = o.status === 'Replaced';
              return (
                <View
                  key={o.offerId}
                  style={[
                    S.card,
                    { marginTop: 0, marginBottom: 10 },
                    replaced && { opacity: 0.6, borderStyle: 'dashed' },
                  ]}
                >
                  <View style={S.split}>
                    <Text style={S.bold}>{o.label || `Position ${i + 1}`}</Text>
                    <Badge
                      tone={
                        replaced
                          ? 'Closed'
                          : o.joiningDate
                          ? 'Resolved'
                          : 'Assigned'
                      }
                    >
                      {replaced
                        ? 'Replaced'
                        : o.joiningDate
                        ? 'Joined'
                        : 'Offer out'}
                    </Badge>
                  </View>
                  <Text style={[S.tiny, { marginTop: 6 }]}>
                    Offered {fmt(o.offerDate)}
                    {o.joiningDate ? ` · joins ${fmt(o.joiningDate)}` : ''}
                    {o.addedBy ? ` · by ${o.addedBy}` : ''}
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    {!!o.offerLetterUrl && (
                      <Btn
                        label="View letter"
                        small
                        secondary
                        onPress={() =>
                          Linking.openURL(o.offerLetterUrl).catch(() =>
                            Alert.alert(
                              'Could not open',
                              'The offer letter link could not be opened.',
                            ),
                          )
                        }
                      />
                    )}
                    {!replaced &&
                      !o.joiningDate &&
                      actions.includes('addOffer') && (
                        <>
                          <Btn
                            label="Record joining"
                            small
                            onPress={() =>
                              setPrompt({
                                kind: 'joining',
                                offerId: o.offerId,
                                label: o.label,
                              })
                            }
                          />
                          <Btn
                            label="Replace"
                            small
                            secondary
                            onPress={() =>
                              setPrompt({
                                kind: 'replace',
                                offerId: o.offerId,
                                label: o.label,
                              })
                            }
                          />
                        </>
                      )}
                  </View>
                </View>
              );
            })}

            {actions.includes('addOffer') &&
              liveOffers.length < req.numberOfPositions && (
                <Btn
                  label="＋ Add offer letter"
                  secondary
                  onPress={() => setPrompt({ kind: 'offer' })}
                  style={{ marginTop: 0 }}
                />
              )}
          </>
        )}

        {/* 4. The form itself */}
        <View style={{ marginTop: 6 }}>
          <Collapsible
            title="The requisition form"
            open={showMRF}
            onToggle={() => setShowMRF(v => !v)}
          >
            <Row k="Minimum qualification" v={req.minQualification} />
            <Row k="Minimum experience" v={req.minExperience} />
            <Row k="Industry preference" v={req.industryPreference} />
            <Row k="Skill sets" v={req.skillSets} />
            <Row k="Reporting to" v={req.reportingTo} />
            <Row k="Salary range" v={req.salaryRange} />
            <Row k="Job profile" v={req.jobProfile} />
            <Row k="Reason" v={req.reasonForRecruitment} />
            <Row k="Currently handled by" v={req.currentHandler} />
            <Row k="Requisition date" v={fmt(req.requisitionDate)} last />
          </Collapsible>
        </View>

        {/* 5. History */}
        {!!req.activity?.length && (
          <>
            <View style={S.listTitle}>
              <Text style={S.listTitleText}>History</Text>
            </View>
            <View style={S.card}>
              {req.activity.map((a, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    marginBottom: i === req.activity.length - 1 ? 0 : 14,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      marginTop: 5,
                      backgroundColor:
                        i === req.activity.length - 1 ? C.green : C.line,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: F.semibold,
                        fontSize: 13,
                        color: C.text,
                      }}
                    >
                      {a.action.replace(/_/g, ' ').toLowerCase()}
                      <Text style={{ fontFamily: F.regular, color: C.muted }}>
                        {a.actorName ? ` · ${a.actorName}` : ''}
                      </Text>
                    </Text>
                    {!!a.remark && (
                      <Text style={[S.tiny, { marginTop: 2 }]}>{a.remark}</Text>
                    )}
                    <Text style={[S.tiny, { marginTop: 2 }]}>{fmt(a.at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 6. What you can do */}
        {actions.filter(a => a !== 'addOffer').length > 0 && (
          <>
            <View style={S.listTitle}>
              <Text style={S.listTitleText}>Your move</Text>
            </View>
            <View style={S.card}>
              {actions.includes('approve') && (
                <Btn
                  label="Approve & assign"
                  onPress={() => setPrompt({ kind: 'approve' })}
                />
              )}
              {actions.includes('reject') && (
                <Btn
                  label="Reject"
                  danger
                  onPress={() => setPrompt({ kind: 'reject' })}
                  style={{ marginTop: 10 }}
                />
              )}
              {actions.includes('progress') && (
                <Btn
                  label="Update progress"
                  onPress={() => setPrompt({ kind: 'progress' })}
                  style={{ marginTop: 10 }}
                />
              )}
              {actions.includes('reassign') && (
                <Btn
                  label="Reassign"
                  secondary
                  onPress={() => setPrompt({ kind: 'reassign' })}
                  style={{ marginTop: 10 }}
                />
              )}
              {actions.includes('retarget') && (
                <Btn
                  label="Change target date"
                  secondary
                  onPress={() => setPrompt({ kind: 'retarget' })}
                  style={{ marginTop: 10 }}
                />
              )}
              {actions.includes('close') && (
                <Btn
                  label="Close requisition"
                  onPress={() =>
                    setPrompt({
                      kind: 'close',
                      filled: req.positionsFilled,
                      wanted: req.numberOfPositions,
                    })
                  }
                  style={{ marginTop: 10 }}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      <PromptSheet
        prompt={prompt}
        busy={busy}
        assignees={assignees}
        meta={{
          stages: [
            'Sourcing',
            'Screening',
            'Interviewing',
            'Selection',
            'Offer',
            'Joining',
          ],
        }}
        onClose={() => !busy && setPrompt(null)}
        onSubmit={(action, payload, offerId, mode) =>
          action === 'offer'
            ? doOffer(payload, offerId, mode)
            : act(action, payload)
        }
      />
      <Toast message={toastMsg} />
    </SafeAreaView>
  );
};

// ─── The action sheet ────────────────────────────────────────────────────────
// One sheet handles every action. Each `kind` decides which fields show, so the
// person only ever sees what that specific decision needs.
const PromptSheet = ({ prompt, busy, assignees, meta, onClose, onSubmit }) => {
  const [remark, setRemark] = useState('');
  const [assignee, setAssignee] = useState('');
  const [days, setDays] = useState('30');
  const [stage, setStage] = useState('');
  const [offerDate, setOfferDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [joiningDate, setJoiningDate] = useState('');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [outcome, setOutcome] = useState('');

  useEffect(() => {
    if (prompt) {
      setRemark('');
      setAssignee('');
      setDays('30');
      setStage('');
      setOfferDate(new Date().toISOString().slice(0, 10));
      setJoiningDate('');
      setLabel(prompt.label || '');
      setFile(null);
      // Default to what the record supports, so the common case is one tap.
      // Default to what the record supports: a part-filled requisition is
      // "Partially Filled"; one with nobody joined can only be "Not Filled",
      // which the person must choose deliberately.
      setOutcome(
        prompt.kind === 'close' && prompt.filled > 0 ? 'Partially Filled' : '',
      );
    }
  }, [prompt]);

  if (!prompt) return null;

  const k = prompt.kind;
  const userOptions = (assignees || [])
    .filter(
      u =>
        u.ticket_role === 'Department User' ||
        u.ticket_role === 'Department Head',
    )
    .map(u => `${u.name} · ${u.mobile}`);

  const pickFile = async () => {
    if (!isPhotoPickerAvailable()) {
      Alert.alert(
        'File picker not enabled',
        'The picker module is not installed in this build yet, so the letter cannot be attached. You can still record the offer date.',
      );
      return;
    }
    try {
      const f = await pickPhoto();
      if (f) setFile(f);
    } catch (e) {
      Alert.alert('Could not attach', e.message);
    }
  };

  const titles = {
    approve: 'Approve and assign',
    reject: 'Reject this requisition',
    progress: 'Update progress',
    reassign: 'Reassign',
    retarget: 'Change the target date',
    close: 'Close the requisition',
    offer: 'Add an offer letter',
    joining: 'Record joining',
    replace: 'Replace this offer letter',
  };

  const submit = () => {
    if (k === 'approve') {
      const mobile = (assignee.split('·')[1] || '').trim();
      if (!mobile)
        return Alert.alert('Choose a person', 'Pick who will work on this.');
      onSubmit('approve', {
        assigneeMobile: mobile,
        targetDays: parseInt(days, 10) || 30,
        remark,
      });
    } else if (k === 'reject') {
      if (!remark.trim())
        return Alert.alert(
          'Comment needed',
          'Explain why this is being rejected.',
        );
      onSubmit('reject', { remark });
    } else if (k === 'progress') {
      if (!remark.trim())
        return Alert.alert('Note needed', 'Describe the progress.');
      onSubmit('progress', { remark, progressStage: stage });
    } else if (k === 'reassign') {
      const mobile = (assignee.split('·')[1] || '').trim();
      if (!mobile)
        return Alert.alert('Choose a person', 'Pick who to reassign this to.');
      onSubmit('reassign', { assigneeMobile: mobile });
    } else if (k === 'retarget') {
      onSubmit('retarget', { targetDays: parseInt(days, 10) || 30 });
    } else if (k === 'close') {
      if (!outcome) {
        return Alert.alert(
          'What does closing mean here?',
          'Choose the outcome before closing.',
        );
      }
      if (outcome === 'Not Filled' && !remark.trim()) {
        return Alert.alert(
          'Reason needed',
          'Add a short reason for closing without filling it.',
        );
      }
      onSubmit('close', { remark, outcome });
    } else if (k === 'offer') {
      onSubmit(
        'offer',
        { offerDate, label, remark, offerLetter: file },
        null,
        'add',
      );
    } else if (k === 'joining') {
      if (!joiningDate.trim())
        return Alert.alert('Date needed', 'Give the joining date.');
      onSubmit('offer', { joiningDate }, prompt.offerId, 'update');
    } else if (k === 'replace') {
      onSubmit(
        'offer',
        { offerDate, label, remark, offerLetter: file },
        prompt.offerId,
        'replace',
      );
    }
  };

  // Rendered as an absolutely-positioned overlay rather than a <Modal>.
  //
  // The sheet contains a Select (Assign to / Stage / Outcome) and a date field,
  // and a Modal opened inside another Modal is unreliable on the New
  // Architecture — it can silently fail to present, which shows as a blank
  // screen with nothing logged to explain it. Staying in one view tree removes
  // that whole class of problem, and behaves the same to the person using it.
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        elevation: 100,
      }}
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
          onPress={onClose}
        >
          <Pressable
            style={{
              backgroundColor: C.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 28,
            }}
          >
            {/* Scrollable, because the date field expands a calendar in place
                and can push the sheet past the screen on a short device.
                The cap is a PIXEL height from the real window: a percentage
                maxHeight here depends on the parent having a resolved height,
                and when it doesn't the ScrollView collapses to nothing — a
                blank sheet with no error to explain it. */}
            <ScrollView
              style={{
                maxHeight: Math.round(Dimensions.get('window').height * 0.72),
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[S.bold, { marginBottom: 12 }]}>{titles[k]}</Text>

              {(k === 'approve' || k === 'reassign') && (
                <Field label="Assign to">
                  <Select
                    label="Assign to"
                    placeholder="Choose someone in the department"
                    value={assignee}
                    options={userOptions}
                    onChange={setAssignee}
                  />
                </Field>
              )}

              {(k === 'approve' || k === 'retarget') && (
                <Field label="Days to close the position">
                  <Input
                    value={days}
                    onChangeText={setDays}
                    keyboardType="number-pad"
                    placeholder="30"
                  />
                </Field>
              )}

              {k === 'progress' && (
                <Field label="Stage">
                  <Select
                    label="Stage"
                    placeholder="Where has this got to?"
                    value={stage}
                    options={meta.stages}
                    onChange={setStage}
                  />
                </Field>
              )}

              {(k === 'offer' || k === 'replace') && (
                <>
                  <Field label="Label (optional)">
                    <Input
                      value={label}
                      onChangeText={setLabel}
                      placeholder="e.g. Position 2"
                    />
                  </Field>
                  <Field label="Offer date">
                    <DateField
                      label="Offer date"
                      value={offerDate}
                      onChange={setOfferDate}
                      placeholder="When was the letter issued?"
                    />
                  </Field>
                  <Field label="Offer letter">
                    <Btn
                      label={
                        file
                          ? `Attached: ${file.fileName}`
                          : 'Attach the signed letter'
                      }
                      secondary
                      small
                      onPress={pickFile}
                    />
                  </Field>
                </>
              )}

              {k === 'close' && (
                <>
                  {prompt.filled === 0 ? (
                    <View
                      style={{
                        backgroundColor: C.overdueBg,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: F.semibold,
                          fontSize: 13,
                          color: C.red,
                        }}
                      >
                        No joining date on record
                      </Text>
                      <Text style={[S.tiny, { marginTop: 3 }]}>
                        Nothing here shows anyone joined, so this can only be
                        closed as not filled. If someone did join, add the offer
                        letter and joining date first — otherwise the dashboard
                        will keep reporting 0 of {prompt.wanted} filled.
                      </Text>
                    </View>
                  ) : (
                    <Text style={[S.tiny, { marginBottom: 12 }]}>
                      {prompt.filled} of {prompt.wanted} position
                      {prompt.wanted === 1 ? '' : 's'} recorded as joined.
                      Closing now ends the search for the{' '}
                      {prompt.wanted - prompt.filled} still open.
                    </Text>
                  )}
                  <Field label="Outcome">
                    <Select
                      label="Outcome"
                      placeholder="What does closing this mean?"
                      value={outcome}
                      // A fully-filled requisition closes itself, so this sheet
                      // only ever opens on one that is unfilled or part-filled —
                      // "Filled" is not an outcome it can honestly offer.
                      options={
                        prompt.filled === 0
                          ? ['Not Filled']
                          : ['Partially Filled', 'Not Filled']
                      }
                      onChange={setOutcome}
                    />
                  </Field>
                </>
              )}

              {k === 'joining' && (
                <Field label="Joining date">
                  <DateField
                    label="Joining date"
                    value={joiningDate}
                    onChange={setJoiningDate}
                    placeholder="When does this person start?"
                  />
                </Field>
              )}

              {k !== 'joining' && k !== 'retarget' && (
                <Field
                  label={
                    k === 'reject' ? 'Reason (required)' : 'Note (optional)'
                  }
                >
                  <Input
                    multiline
                    value={remark}
                    onChangeText={setRemark}
                    placeholder={
                      k === 'reject'
                        ? 'Explain why, so the Cluster Head knows what to change.'
                        : 'Anything worth recording.'
                    }
                  />
                </Field>
              )}

              <Btn
                label="Confirm"
                onPress={submit}
                loading={busy}
                disabled={busy}
              />
              <Btn
                label="Cancel"
                secondary
                onPress={onClose}
                style={{ marginTop: 10 }}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
};

export default RequestDetail;
