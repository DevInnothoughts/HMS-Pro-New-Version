/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
// RaiseTicket.js
// ─────────────────────────────────────────────────────────────────────────────
// The mockup's "Raise a New Ticket" card, field for field:
//
//   Center       select        ← the person's own branch(es), not all 40
//   Department   select   ┐ .row — side by side, as in the CSS
//   Priority     select   ┘
//   Issue Type   select        ← depends on Department (issueMap)
//   Describe     textarea
//   Photo/proof  file
//
// Used by Partners (requirement: "Raise ticket will have same structure and
// fields as shown in attached file") and by Cluster Heads for branches with no
// partner (requirement 7).
//
// This is a BODY, not a screen. TicketingHome owns the SafeAreaView, the header
// and the bottom tab bar, and renders this inside them — so the tab bar is
// always there to get back with.
//
// Two changes from the mockup, both deliberate:
//
//  • Center lists only the branches this login owns. The mockup hardcodes seven
//    centers; a Baner partner filing against Nashik would be a bug, and the
//    server rejects it anyway, so the picker shouldn't offer it.
//    testing, wrong in a real branch's hands.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';

import {
  getAllBranches,
  getClusterHeadEmailForBranch,
  getMyEmail,
  raiseTicket,
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
import pickPhoto, { isPhotoPickerAvailable } from './imagePicker';
import { TICKET_ROLE } from './roles';
import { C, F, S } from './theme';

const RaiseTicket = ({ meta, actor, ticketRole, onDone }) => {
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);

  const isSuperAdmin = ticketRole === TICKET_ROLE.SUPER_ADMIN;

  // A SuperAdmin can raise for any branch and has no home branch, so their own
  // locationArray may not list every center. For them the dropdown is filled
  // from the company-wide branch list (Firestore HHCLocations, same source
  // AddUserForm uses); everyone else picks only from the branches they own.
  const [allBranches, setAllBranches] = useState([]);
  useEffect(() => {
    if (isSuperAdmin) {
      getAllBranches().then(setAllBranches);
    }
  }, [isSuperAdmin]);

  // Only the branches this login is responsible for.
  // Copy before touching it: locationArray comes straight from Redux, and
  // Redux Toolkit freezes state with Immer — unshift on the live array throws.
  const centers = useMemo(() => {
    if (isSuperAdmin && allBranches.length) return allBranches;
    const list = Array.isArray(locationArray) ? [...locationArray] : [];
    if (location) list.unshift(location);
    return [...new Set(list.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [isSuperAdmin, allBranches, location, locationArray]);

  const departments = meta?.departments || [];
  const priorities = meta?.priorities || ['Critical', 'High', 'Medium', 'Low'];

  const [center, setCenter] = useState(location || centers[0] || '');
  const [department, setDepartment] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, toast] = useToast();

  // Default to the first department once meta lands.
  useEffect(() => {
    if (!department && departments.length) setDepartment(departments[0]);
  }, [departments, department]);

  // Issue types follow the department — refreshIssueTypes() in the mockup —
  // with "Other" always appended as the escape hatch for anything the fixed
  // list doesn't cover. The department's own types come first; "Other" last.
  // When it's chosen, the description carries the real detail (already required,
  // and the placeholder prompts for it), so a ticket is never just "Other".
  const OTHER = 'Other';
  const issueTypes = useMemo(() => {
    const forDept = meta?.issueMap?.[department] || [];
    return department ? [...forDept, OTHER] : [];
  }, [meta, department]);

  const isOther = issueType === OTHER;

  useEffect(() => {
    if (issueTypes.length && !issueTypes.includes(issueType))
      setIssueType(issueTypes[0]);
    if (!issueTypes.length) setIssueType('');
  }, [issueTypes, issueType]);

  const attachPhoto = async () => {
    if (!isPhotoPickerAvailable()) {
      Alert.alert(
        'Photo attachments not enabled',
        'The image picker module isn’t installed in this build yet, so photos can’t be attached. ' +
          'Everything else on this form works — you can submit without one.',
      );
      return;
    }
    try {
      const p = await pickPhoto();
      if (p) setPhoto(p);
    } catch (e) {
      Alert.alert('Could not attach photo', e.message);
    }
  };

  const submit = async () => {
    if (!center) return toast('Select the center this issue belongs to.');
    if (!department) return toast('Select a department.');
    if (!issueType) return toast('Select an issue type.');
    if (!description.trim())
      return toast('Please describe the issue before submitting.');
    if (!actor?.actorMobile)
      return toast('You are signed out. Please log in again.');

    setSubmitting(true);
    try {
      // Emails for the people the backend can't look up itself (they live in
      // Firestore): the raiser's own address, and the Cluster Head who approves
      // this branch. The backend stores them on the ticket and notifies at the
      // right steps. Both are best-effort — an empty string just means that
      // person won't be emailed.
      const [raisedByEmail, clusterHeadEmail] = await Promise.all([
        getMyEmail(),
        getClusterHeadEmailForBranch(center),
      ]);
      const res = await raiseTicket(actor, {
        center,
        department,
        priority,
        issueType,
        description: description.trim(),
        raisedByEmail,
        clusterHeadEmail,
        attachment: photo
          ? {
              fileName: photo.fileName,
              mimeType: photo.mimeType,
              fileSize: photo.fileSize,
              dataUrl: photo.dataUrl,
            }
          : null,
      });
      setDescription('');
      setPhoto(null);
      onDone?.(res);
    } catch (e) {
      Alert.alert('Ticket not submitted', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={S.main}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[S.card, { marginTop: 0 }]}>
            <Text style={S.bold}>Raise a New Ticket</Text>
            <Text style={[S.tiny, { marginTop: 4 }]}>
              {ticketRole === TICKET_ROLE.CLUSTER_HEAD
                ? 'You are raising this as Cluster Head, so it skips approval and goes to the department head.'
                : 'This will be visible to your Cluster Head, who approves it before work starts.'}
            </Text>

            <Field label="Center">
              <Select
                label="Center"
                placeholder="Select a center"
                value={center}
                options={centers}
                onChange={setCenter}
              />
            </Field>

            {/* .row — Department and Priority share a line */}
            <View style={S.row}>
              <View style={S.rowItem}>
                <Field label="Department">
                  <Select
                    label="Department"
                    placeholder="Select"
                    value={department}
                    options={departments}
                    onChange={setDepartment}
                  />
                </Field>
              </View>
              <View style={S.rowItem}>
                <Field label="Priority">
                  <Select
                    label="Priority"
                    placeholder="Select"
                    value={priority}
                    options={priorities}
                    onChange={setPriority}
                  />
                </Field>
              </View>
            </View>

            {/* Priority drives the SLA clock, so say so rather than leaving it
                as an unexplained dropdown. */}
            {!!priority && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <Badge tone={priority}>{priority}</Badge>
                <Text style={S.tiny}>{SLA_COPY[priority]}</Text>
              </View>
            )}

            <Field label="Issue Type">
              <Select
                label="Issue Type"
                placeholder={
                  department
                    ? 'Select an issue type'
                    : 'Pick a department first'
                }
                value={issueType}
                options={issueTypes}
                onChange={setIssueType}
                disabled={!issueTypes.length}
              />
            </Field>

            <Field
              label={
                isOther
                  ? 'Describe the issue (what is it?)'
                  : 'Describe the issue'
              }
            >
              <Input
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder={
                  isOther
                    ? 'Since you chose “Other”, say what the issue is here — e.g. “Signboard outside the clinic has fallen and is blocking the entrance.”'
                    : 'Example: AC in reception is not cooling since morning. Patients are complaining.'
                }
              />
            </Field>

            <Field label="Photo / proof">
              {photo ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: C.line,
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: C.white,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: F.regular,
                      fontSize: 13,
                      color: C.text,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {photo.fileName}
                  </Text>
                  <Btn
                    label="Remove"
                    secondary
                    small
                    onPress={() => setPhoto(null)}
                  />
                </View>
              ) : (
                <Btn
                  label="Attach a photo"
                  secondary
                  onPress={attachPhoto}
                  style={{ marginTop: 0 }}
                />
              )}
            </Field>

            <Btn
              label="Submit Ticket"
              onPress={submit}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast message={toastMsg} />
    </>
  );
};

export default RaiseTicket;

// Mirrors CONFIG.SLA_HOURS in ticketingModel.js. If you retune the server,
// retune these words — they are a promise to the person filing the ticket.
const SLA_COPY = {
  Critical: 'Target fix within 8 hours',
  High: 'Target fix within 1 day',
  Medium: 'Target fix within 3 days',
  Low: 'Target fix within 7 days',
};
