// ═══════════════════════════════════════════════════════════════════════════
//  Raise MRF — the Manpower Requisition Form (HRM-F-2.1-01)
//
//  The paper form has sixteen fields. Presented as one flat scroll that would
//  read as a wall of inputs, so it is grouped into four labelled sections that
//  follow how the form is actually thought about:
//
//    1. The position   what and where, how many
//    2. The candidate  qualification, experience, skills
//    3. The role       reporting line, salary, job profile
//
//  The paper form's signature block (HOD / MD & CEO / HR Head) is deliberately
//  NOT reproduced. Those were typed names — unverified, and no substitute for
//  the real thing. The approval that counts is the workflow's: when the HR head
//  approves, the system records their name, mobile, role, the exact time and
//  their remark, in an append-only trail. Asking someone to also type a name
//  would add three fields and capture nothing.
//
//  Only Position, Department and Location are enforced — the rest of the paper
//  form is often filled in over a day, and refusing to save a draft-quality
//  requisition would push people back to email.
// ═══════════════════════════════════════════════════════════════════════════

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

import { getAllBranches, submitMRF } from './api';
import { TICKET_ROLE } from './roles';
import {
  Btn,
  Field,
  Input,
  Select,
  Toast,
  useToast,
} from '../ticketing/components';
import { C, F, S } from '../ticketing/theme';

// A titled block of fields, with a hairline rule — enough structure to scan by,
// without turning the form into a wizard the user has to click through.
const Section = ({ n, title, hint, children }) => (
  <View style={{ marginTop: 18 }}>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: C.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: C.white, fontSize: 11, fontFamily: F.semibold }}>
          {n}
        </Text>
      </View>
      <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>
        {title}
      </Text>
    </View>
    {!!hint && (
      <Text style={[S.tiny, { marginLeft: 30, marginBottom: 8 }]}>{hint}</Text>
    )}
    <View style={[S.card, { marginTop: 8 }]}>{children}</View>
  </View>
);

const RaiseMRF = ({ meta, actor, ticketRole, onDone, onCancel }) => {
  const location = useSelector(state => state.location.value);
  const locationArray = useSelector(state => state.location.locationArray);

  const isSuperAdmin = ticketRole === TICKET_ROLE.SUPER_ADMIN;

  // A SuperAdmin has no home branch, so their picker is filled from the
  // company-wide list; everyone else picks from the branches they own.
  const [allBranches, setAllBranches] = useState([]);
  useEffect(() => {
    if (isSuperAdmin) getAllBranches().then(setAllBranches);
  }, [isSuperAdmin]);

  const centers = useMemo(() => {
    if (isSuperAdmin && allBranches.length) return allBranches;
    const list = Array.isArray(locationArray) ? [...locationArray] : [];
    if (location) list.unshift(location);
    return [...new Set(list.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [isSuperAdmin, allBranches, location, locationArray]);

  const departments = meta?.departments || [];
  const employmentTypes = meta?.employmentTypes || ['Payroll', 'Contract'];

  // 1. The position
  const [position, setPosition] = useState('');
  const [numberOfPositions, setNumberOfPositions] = useState('1');
  const [city, setCity] = useState('');
  const [forDepartment, setForDepartment] = useState('');
  const [center, setCenter] = useState(location || '');
  const [employmentType, setEmploymentType] = useState('Payroll');

  // 2. The candidate
  const [minQualification, setMinQualification] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [industryPreference, setIndustryPreference] = useState('');
  const [skillSets, setSkillSets] = useState('');

  // 3. The role
  const [reportingTo, setReportingTo] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [jobProfile, setJobProfile] = useState('');
  const [currentHandler, setCurrentHandler] = useState('');
  const [reasonForRecruitment, setReasonForRecruitment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toastMsg] = useToast();

  useEffect(() => {
    if (!center && centers.length) setCenter(centers[0]);
  }, [centers, center]);

  useEffect(() => {
    if (!forDepartment && departments.length) setForDepartment(departments[0]);
  }, [departments, forDepartment]);

  const submit = async () => {
    if (!position.trim()) {
      Alert.alert('Position needed', 'Enter the position you are hiring for.');
      return;
    }
    if (!center) {
      Alert.alert('Unit needed', 'Choose the clinic this position is for.');
      return;
    }
    if (!forDepartment) {
      Alert.alert(
        'Department needed',
        'Choose the department this position belongs to.',
      );
      return;
    }
    const count = parseInt(numberOfPositions, 10);
    if (!count || count < 1) {
      Alert.alert('Check the count', 'Number of positions must be at least 1.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitMRF(actor, {
        position: position.trim(),
        numberOfPositions: count,
        unit: center, // the clinic — scopes visibility
        location: city.trim(), // the city, free text
        forDepartment,
        employmentType,
        minQualification: minQualification.trim(),
        minExperience: minExperience.trim(),
        industryPreference: industryPreference.trim(),
        reportingTo: reportingTo.trim(),
        salaryRange: salaryRange.trim(),
        reasonForRecruitment: reasonForRecruitment.trim(),
        skillSets: skillSets.trim(),
        jobProfile: jobProfile.trim(),
        currentHandler: currentHandler.trim(),
        requisitionDate: new Date().toISOString().slice(0, 10),
      });
      onDone?.(res);
    } catch (e) {
      Alert.alert('Requisition not submitted', e.message);
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
          <View
            style={[S.card, { borderLeftWidth: 3, borderLeftColor: C.green }]}
          >
            <Text style={S.bold}>Manpower Requisition</Text>
            <Text style={[S.tiny, { marginTop: 4 }]}>
              This goes to the HR department for review. Form HRM-F-2.1-01.
            </Text>
          </View>

          <Section
            n="1"
            title="The position"
            hint="What you need, where, and how many."
          >
            <Field label="Position">
              <Input
                value={position}
                onChangeText={setPosition}
                placeholder="e.g. Staff Nurse"
              />
            </Field>
            <Field label="Number of positions">
              <Input
                value={numberOfPositions}
                onChangeText={setNumberOfPositions}
                keyboardType="number-pad"
                placeholder="1"
              />
            </Field>
            <Field label="Department">
              <Select
                label="Department"
                placeholder="Which department is this role in?"
                value={forDepartment}
                options={departments}
                onChange={setForDepartment}
              />
            </Field>
            {/* Unit is the clinic, picked from the company's branch list — it
                is what scopes who sees this requisition, so it can't be typed.
                Location is the city, free text, exactly as the paper form has
                it ("Pune"). */}
            <Field label="Unit">
              <Select
                label="Unit"
                placeholder="Which clinic is this for?"
                value={center}
                options={centers}
                onChange={setCenter}
              />
            </Field>
            <Field label="Location">
              <Input
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Pune"
              />
            </Field>
            <Field label="Payroll or contract">
              <Select
                label="Payroll or contract"
                placeholder="Select"
                value={employmentType}
                options={employmentTypes}
                onChange={setEmploymentType}
              />
            </Field>
          </Section>

          <Section
            n="2"
            title="Who you're looking for"
            hint="What HR will screen candidates against."
          >
            <Field label="Minimum qualification">
              <Input
                value={minQualification}
                onChangeText={setMinQualification}
                placeholder="e.g. B.Sc Nursing"
              />
            </Field>
            <Field label="Minimum experience">
              <Input
                value={minExperience}
                onChangeText={setMinExperience}
                placeholder="e.g. 2–4 years, or Fresher"
              />
            </Field>
            <Field label="Industry preference">
              <Input
                value={industryPreference}
                onChangeText={setIndustryPreference}
                placeholder="e.g. Hospital / Healthcare"
              />
            </Field>
            <Field label="Skill sets required">
              <Input
                multiline
                value={skillSets}
                onChangeText={setSkillSets}
                placeholder="e.g. IPD care, IV administration, patient monitoring"
              />
            </Field>
          </Section>

          <Section
            n="3"
            title="The role"
            hint="Reporting line, pay band, and what the job involves."
          >
            <Field label="Reporting to">
              <Input
                value={reportingTo}
                onChangeText={setReportingTo}
                placeholder="e.g. Nursing Supervisor"
              />
            </Field>
            <Field label="Salary range">
              <Input
                value={salaryRange}
                onChangeText={setSalaryRange}
                placeholder="e.g. 3.0 – 4.2 LPA"
              />
            </Field>
            <Field label="Job profile">
              <Input
                multiline
                value={jobProfile}
                onChangeText={setJobProfile}
                placeholder="What this person will actually do day to day."
              />
            </Field>
            <Field label="Reason for recruitment">
              <Input
                multiline
                value={reasonForRecruitment}
                onChangeText={setReasonForRecruitment}
                placeholder="e.g. New ward opening, or replacement for a resignation."
              />
            </Field>
            <Field label="Who currently handles this role">
              <Input
                value={currentHandler}
                onChangeText={setCurrentHandler}
                placeholder="e.g. Vacant, or the person covering it now"
              />
            </Field>
          </Section>

          <View style={{ marginTop: 20 }}>
            <Btn
              label="Submit to HR"
              onPress={submit}
              loading={submitting}
              disabled={submitting}
            />
            {!!onCancel && (
              <Btn
                label="Cancel"
                secondary
                onPress={onCancel}
                style={{ marginTop: 10 }}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast message={toastMsg} />
    </>
  );
};

export default RaiseMRF;
