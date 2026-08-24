import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, KeyboardAvoidingView, ActivityIndicator, StyleSheet, Modal, Dimensions, StatusBar,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { requestRegisterOtp, verifyRegisterOtp, checkUsername, checkEmail, checkNumber,} from './src/services/authService';

const { width } = Dimensions.get('window');
const RESEND_SECONDS = 60;

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Register({ navigation }) {
  const { theme } = useContext(ThemeContext);

  // ─── Step: 'form' | 'otp' ────────────────────────────────────────
  const [step, setStep] = useState('form');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Form Data State ─────────────────────────────────────────────
  const [newMed, setNewMed] = useState({
    fname: '',
    lname: '',
    dob: '',
    gender: '',
    yearLevel: '1',
    section: 'A',
    number: '',
    email: '',
    username: '',
    password: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');

  // ─── Real-Time Error, Active Field & Checking States ─────────────
  const [errors, setErrors] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [checking, setChecking] = useState({ username: false, email: false, number: false });

  // Refs for tracking active async search requests and fast typing timeouts
  const abortControllers = useRef({});
  const typingTimeout = useRef({});

  // ─── UI & Interaction States ─────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);

  // ─── Advanced Calendar States (Year, Month, Day Picker) ───────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMode, setCalendarMode] = useState('days'); // 'days' | 'months' | 'years'
  const [calendarYear, setCalendarYear] = useState(2004);
  const [calendarMonth, setCalendarMonth] = useState(0); // 0 = Jan
  const [selectedDay, setSelectedDay] = useState(1);

  // ─── Input Field Refs for Keyboard Navigation ────────────────────
  const fnameRef = useRef(null);
  const lnameRef = useRef(null);
  const emailRef = useRef(null);
  const numberRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // ─── OTP States ──────────────────────────────────────────────────
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const otpRefs = useRef([]);

  // ─── Resend Timer Effect ─────────────────────────────────────────
  useEffect(() => {
    if (!canResend && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (resendTimer === 0) setCanResend(true);
  }, [resendTimer, canResend]);

  // ─── Auto-focus First OTP Box ────────────────────────────────────
  useEffect(() => {
    if (step === 'otp') {
      const timeout = setTimeout(() => otpRefs.current[0]?.focus(), 300);
      return () => clearTimeout(timeout);
    }
  }, [step]);

  // ─── SYNCHRONOUS FIELD VALIDATION ────────────────────────────────
  const validateSync = useCallback((field, value, allValues = newMed, cPass = confirmPassword) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (!trimmed) return "This field is required.";

    switch (field) {
      case 'fname':
      case 'lname':
        return /^[A-Za-z\s-']+$/.test(trimmed)
          ? null
          : "Letters, spaces, hyphens, or apostrophes only.";

      case 'dob':
      case 'gender':
        return null;

      case 'email':
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)
          ? null
          : "Please enter a valid email address.";

      case 'number':
        return /^\d{11}$/.test(trimmed)
          ? null
          : "Mobile number must be exactly 11 digits.";

      case 'username':
        return trimmed.length < 4
          ? "Username must be at least 4 characters long."
          : null;

      case 'password':
        if (value.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(value)) return "Needs at least one uppercase letter.";
        if (!/\d/.test(value)) return "Needs at least one number.";
        if (!/[!@#$%^&*]/.test(value)) return "Needs at least one special character (!@#$%^&*).";
        return null;

      case 'confirmPassword':
        return cPass !== allValues.password ? "Passwords do not match." : null;

      default:
        return null;
    }
  }, [newMed, confirmPassword]);

  const verifyAvailability = useCallback(async (field, val) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    if (field === 'email' && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return;
    if (field === 'number' && trimmed.length !== 11) return;
    if (field === 'username' && trimmed.length < 4) return;

    if (abortControllers.current[field]) {
      abortControllers.current[field].abort();
    }
    const controller = new AbortController();
    abortControllers.current[field] = controller;

    setChecking((prev) => ({ ...prev, [field]: true }));
    try {
      let res;
      if (field === 'username') {
        res = await checkUsername(trimmed, { signal: controller.signal });
      } else if (field === 'email') {
        res = await checkEmail(trimmed, { signal: controller.signal });
      } else if (field === 'number') {
        res = await checkNumber(trimmed, { signal: controller.signal });
      }

      const isTaken =
        res?.data?.exists === true ||
        res?.data?.taken === true ||
        res?.data?.inUse === true ||
        res?.data?.available === false;

      if (isTaken) {
        const label =
          field === 'email'
            ? 'student email is already registered'
            : field === 'number'
            ? 'mobile number is already in use'
            : 'username is already taken';

        setErrors((prev) => ({ ...prev, [field]: `This ${label}.` }));
      } else {
        setErrors((prev) => {
          const copy = { ...prev };
          if (copy[field]?.includes('already')) delete copy[field];
          return copy;
        });
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      const msg = err?.response?.data?.message || '';
      const lower = msg.toLowerCase();
      if (
        lower.includes('use') ||
        lower.includes('exist') ||
        lower.includes('taken') ||
        lower.includes('already') ||
        err?.response?.status === 400 ||
        err?.response?.status === 409
      ) {
        const fallback =
          field === 'email'
            ? 'This student email is already registered.'
            : field === 'number'
            ? 'This mobile number is already in use.'
            : 'This username is already taken.';
        setErrors((prev) => ({ ...prev, [field]: msg || fallback }));
      }
    } finally {
      setChecking((prev) => ({ ...prev, [field]: false }));
    }
  }, []);

  // ─── Input Handlers with 200ms Fast Debounce ─────────────────────
  const handleTextChange = (field, val) => {
    const value = field === 'password' || field === 'confirmPassword' ? val : val.trimStart();

    if (field === 'confirmPassword') {
      setConfirmPassword(value);
      const err = validateSync('confirmPassword', value, newMed, value);
      setErrors((prev) => ({ ...prev, confirmPassword: err }));
    } else {
      const updated = { ...newMed, [field]: value };
      setNewMed(updated);

      const err = validateSync(field, value, updated, confirmPassword);
      setErrors((prev) => ({ ...prev, [field]: err }));

      if (!err && ['username', 'email', 'number'].includes(field)) {
        if (typingTimeout.current[field]) clearTimeout(typingTimeout.current[field]);
        typingTimeout.current[field] = setTimeout(() => {
          verifyAvailability(field, value);
        }, 200);
      }

      if (field === 'password') {
        setErrors((prev) => ({
          ...prev,
          confirmPassword: validateSync('confirmPassword', confirmPassword, updated, confirmPassword),
        }));
      }
    }
  };

  const handleSelectGender = (genderVal) => {
    const updated = { ...newMed, gender: genderVal };
    setNewMed(updated);
    setErrors((prev) => ({ ...prev, gender: validateSync('gender', genderVal, updated) }));
    setShowGenderModal(false);
  };

  const confirmSelectedDate = () => {
    const formatted = `${String(calendarMonth + 1).padStart(2, '0')}/${String(
      selectedDay
    ).padStart(2, '0')}/${calendarYear}`;
    const updated = { ...newMed, dob: formatted };
    setNewMed(updated);
    setErrors((prev) => ({ ...prev, dob: validateSync('dob', formatted, updated) }));
    setShowDatePicker(false);
    setCalendarMode('days');
  };

  // ─── Form Submission Validation ──────────────────────────────────
  const validateForm = () => {
    const fields = [
      'fname',
      'lname',
      'dob',
      'gender',
      'email',
      'number',
      'username',
      'password',
      'confirmPassword',
    ];
    const newErrors = {};
    let isValid = true;

    fields.forEach((field) => {
      const val = field === 'confirmPassword' ? confirmPassword : newMed[field];
      const error = validateSync(field, val, newMed, confirmPassword);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    if (
      errors.email?.includes('already') ||
      errors.number?.includes('already') ||
      errors.username?.includes('already')
    ) {
      isValid = false;
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));

    if (!isValid) {
      toastError('Please fix all form errors before proceeding.');
    }
    return isValid;
  };

  // ─── SIGN UP / REQUEST OTP HANDLER ───────────────────────────────
  const handleSignUp = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const res = await requestRegisterOtp(newMed.email);
      if (res.data?.otpId) {
        setOtpId(res.data.otpId);
      }
      toastSuccess('Verification code sent to your email!');
      setStep('otp');
      setResendTimer(RESEND_SECONDS);
      setCanResend(false);
    } catch (error) {
      const backendMsg = error?.response?.data?.message || '';
      const lowerMsg = backendMsg.toLowerCase();

      if (lowerMsg.includes('email') && (lowerMsg.includes('use') || lowerMsg.includes('exist') || lowerMsg.includes('taken') || lowerMsg.includes('already'))) {
        setErrors((prev) => ({ ...prev, email: 'This student email is already registered.' }));
      } else if (lowerMsg.includes('username') && (lowerMsg.includes('use') || lowerMsg.includes('exist') || lowerMsg.includes('taken') || lowerMsg.includes('already'))) {
        setErrors((prev) => ({ ...prev, username: 'This username is already taken.' }));
      } else if ((lowerMsg.includes('mobile') || lowerMsg.includes('number')) && (lowerMsg.includes('use') || lowerMsg.includes('exist') || lowerMsg.includes('taken') || lowerMsg.includes('already'))) {
        setErrors((prev) => ({ ...prev, number: 'This mobile number is already in use.' }));
      }

      toastError(backendMsg || 'Failed to send verification code. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── VERIFY OTP HANDLER ──────────────────────────────────────────
  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      toastError('Please enter the full 6-digit OTP.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyRegisterOtp({
        otpId,
        code,
        medData: newMed,
      });
      toastSuccess('Account created successfully!');
      navigation.replace('Login');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'OTP verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── RESEND OTP HANDLER ──────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend) return;
    setIsSubmitting(true);
    try {
      const res = await requestRegisterOtp(newMed.email);
      if (res.data?.otpId) setOtpId(res.data.otpId);
      toastSuccess('Verification code resent!');
      setResendTimer(RESEND_SECONDS);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (error) {
      toastError(error?.response?.data?.message || 'Failed to resend code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── OTP Digit Handlers ──────────────────────────────────────────
  const handleOtpChange = (value, index) => {
    const copy = [...otp];
    copy[index] = value;
    setOtp(copy);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpBackspace = (key, index) => {
    if (key === 'Backspace' && otp[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ─── PROPER CALENDAR GRID RENDERER ───────────────────────────────
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const renderCalendarGrid = () => {
    if (calendarMode === 'years') {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let y = currentYear - 80; y <= currentYear; y++) {
        years.push(y);
      }
      return (
        <View style={localStyles.yearGridContainer}>
          {years.reverse().map((yr) => (
            <TouchableOpacity
              key={yr}
              style={[localStyles.yearCell, calendarYear === yr && localStyles.cellSelected]}
              onPress={() => {
                setCalendarYear(yr);
                setCalendarMode('days');
              }}
            >
              <Text style={[localStyles.yearText, calendarYear === yr && localStyles.cellTextSelected]}>
                {yr}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (calendarMode === 'months') {
      return (
        <View style={localStyles.monthGridContainer}>
          {MONTH_NAMES.map((mName, mIdx) => (
            <TouchableOpacity
              key={mName}
              style={[localStyles.monthCell, calendarMonth === mIdx && localStyles.cellSelected]}
              onPress={() => {
                setCalendarMonth(mIdx);
                setCalendarMode('days');
              }}
            >
              <Text style={[localStyles.monthText, calendarMonth === mIdx && localStyles.cellTextSelected]}>
                {mName.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    const totalDays = getDaysInMonth(calendarYear, calendarMonth);
    const firstDayIndex = getFirstDayOfMonth(calendarYear, calendarMonth);
    const gridItems = [];

    for (let i = 0; i < firstDayIndex; i++) {
      gridItems.push(<View key={`empty-${i}`} style={localStyles.dayCell} />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const isSelected = selectedDay === d;
      gridItems.push(
        <TouchableOpacity
          key={`day-${d}`}
          style={[localStyles.dayCell, isSelected && localStyles.cellSelected]}
          onPress={() => setSelectedDay(d)}
        >
          <Text style={[localStyles.dayText, isSelected && localStyles.cellTextSelected]}>
            {d}
          </Text>
        </TouchableOpacity>
      );
    }

    return <View style={localStyles.daysGridContainer}>{gridItems}</View>;
  };

  const passwordRulesData = [
    { label: '8+ characters', ok: newMed.password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(newMed.password) },
    { label: 'One number', ok: /\d/.test(newMed.password) },
    { label: 'Special character (!@#$%^&*)', ok: /[!@#$%^&*]/.test(newMed.password) },
  ];

  const otpBoxWidth = Math.floor((width - 48 - 40) / 6);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[localStyles.container, { backgroundColor: theme.bg || '#F8F9FA' }]}
    >
      {/* ─── CALENDAR MODAL ────────────────────────────────────────── */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDatePicker(false);
          setCalendarMode('days');
        }}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.calendarCard}>
            <View style={localStyles.calendarHeader}>
              {calendarMode === 'days' ? (
                <>
                  <TouchableOpacity onPress={handlePrevMonth} style={localStyles.navBtn}>
                    <Ionicons name="chevron-back" size={20} color="#153c2a" />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity onPress={() => setCalendarMode('months')}>
                      <Text style={localStyles.monthYearText}>{MONTH_NAMES[calendarMonth]}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCalendarMode('years')}>
                      <Text style={localStyles.monthYearText}>{calendarYear}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={handleNextMonth} style={localStyles.navBtn}>
                    <Ionicons name="chevron-forward" size={20} color="#153c2a" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={localStyles.backToDaysBtn}
                  onPress={() => setCalendarMode('days')}
                >
                  <Ionicons name="arrow-back" size={16} color="#153c2a" />
                  <Text style={localStyles.backToDaysText}>Back to Calendar</Text>
                </TouchableOpacity>
              )}
            </View>

            {calendarMode === 'days' && (
              <View style={localStyles.daysOfWeekRow}>
                {DAYS_OF_WEEK.map((day) => (
                  <Text key={day} style={localStyles.dayOfWeekText}>
                    {day}
                  </Text>
                ))}
              </View>
            )}

            <ScrollView
              style={{ maxHeight: 290 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={calendarMode !== 'days' ? { paddingVertical: 10 } : undefined}
            >
              {renderCalendarGrid()}
            </ScrollView>

            <View style={localStyles.calendarActionRow}>
              <TouchableOpacity
                style={[localStyles.calendarBtn, localStyles.calendarBtnCancel]}
                onPress={() => {
                  setShowDatePicker(false);
                  setCalendarMode('days');
                }}
              >
                <Text style={localStyles.calendarBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[localStyles.calendarBtn, localStyles.calendarBtnConfirm]}
                onPress={confirmSelectedDate}
              >
                <Text style={localStyles.calendarBtnConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── GENDER SELECTION MODAL ───────────────────────────────── */}
      <Modal
        visible={showGenderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <TouchableOpacity
          style={localStyles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowGenderModal(false)}
        >
          <View style={localStyles.modalCard}>
            <Text style={localStyles.modalTitle}>Select Gender</Text>
            {GENDER_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item}
                style={localStyles.modalOption}
                onPress={() => handleSelectGender(item)}
              >
                <Text
                  style={[
                    localStyles.modalOptionText,
                    newMed.gender === item && localStyles.modalOptionSelected,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── STICKY TOP HEADER BLOCK (Constrained Width Container) ── */}
      <View style={[localStyles.headerContainer, { backgroundColor: theme.bg || '#F8F9FA' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" />
        <View style={localStyles.maxContentWidth}>
          <TouchableOpacity
            style={localStyles.backButton}
            onPress={() => (step === 'otp' ? setStep('form') : navigation.goBack())}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={localStyles.heading}>
            {step === 'form' ? 'Create Account' : 'Verify OTP'}
          </Text>
          <Text style={localStyles.subHeading}>
            {step === 'form'
              ? 'Create an account to explore MyphoLens'
              : `Enter the 6-digit one-time pin sent to ${newMed.email} to complete your registration.`}
          </Text>
        </View>
      </View>

      {/* ─── SCROLLABLE CONTENT AREA (Constrained Width Container) ── */}
      <ScrollView
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={localStyles.maxContentWidth}>
          {step === 'form' ? (
            <View style={localStyles.formContainer}>
              {/* First Name */}
              <Text style={localStyles.label}>First Name</Text>
              <View
                style={[
                  localStyles.inputWrapper,
                  errors.fname && localStyles.inputError,
                  activeField === 'fname' && localStyles.inputActive,
                ]}
              >
                <TextInput
                  ref={fnameRef}
                  style={localStyles.input}
                  placeholder="Enter your first name"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="next"
                  onSubmitEditing={() => lnameRef.current?.focus()}
                  value={newMed.fname}
                  onChangeText={(val) => handleTextChange('fname', val)}
                  onFocus={() => setActiveField('fname')}
                  onBlur={() => setActiveField(null)}
                />
              </View>
              {errors.fname ? <Text style={localStyles.errorText}>{errors.fname}</Text> : null}

              {/* Last Name */}
              <Text style={localStyles.label}>Last Name</Text>
              <View
                style={[
                  localStyles.inputWrapper,
                  errors.lname && localStyles.inputError,
                  activeField === 'lname' && localStyles.inputActive,
                ]}
              >
                <TextInput
                  ref={lnameRef}
                  style={localStyles.input}
                  placeholder="Enter your last name"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="done"
                  onSubmitEditing={() => setShowDatePicker(true)}
                  value={newMed.lname}
                  onChangeText={(val) => handleTextChange('lname', val)}
                  onFocus={() => setActiveField('lname')}
                  onBlur={() => setActiveField(null)}
                />
              </View>
              {errors.lname ? <Text style={localStyles.errorText}>{errors.lname}</Text> : null}

              {/* Date of Birth */}
              <Text style={localStyles.label}>Date of Birth</Text>
              <TouchableOpacity
                style={[localStyles.inputWrapper, errors.dob && localStyles.inputError]}
                activeOpacity={0.8}
                onPress={() => setShowDatePicker(true)}
              >
                <Text
                  style={[
                    localStyles.input,
                    !newMed.dob && { color: '#94A3B8' },
                    { textAlignVertical: 'center' },
                  ]}
                >
                  {newMed.dob || 'MM/DD/YYYY'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#64748B" style={{ padding: 6 }} />
              </TouchableOpacity>
              {errors.dob ? <Text style={localStyles.errorText}>{errors.dob}</Text> : null}

              {/* Gender */}
              <Text style={localStyles.label}>Gender</Text>
              <TouchableOpacity
                style={[localStyles.inputWrapper, errors.gender && localStyles.inputError]}
                activeOpacity={0.8}
                onPress={() => setShowGenderModal(true)}
              >
                <Text
                  style={[
                    localStyles.input,
                    !newMed.gender && { color: '#94A3B8' },
                    { textAlignVertical: 'center' },
                  ]}
                >
                  {newMed.gender || 'Select'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748B" style={{ padding: 6 }} />
              </TouchableOpacity>
              {errors.gender ? <Text style={localStyles.errorText}>{errors.gender}</Text> : null}

              {/* Student Email */}
              <Text style={localStyles.label}>Student Email</Text>
              <View
                style={[
                  localStyles.inputWrapper,
                  errors.email && localStyles.inputError,
                  activeField === 'email' && localStyles.inputActive,
                ]}
              >
                <TextInput
                  ref={emailRef}
                  style={localStyles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => numberRef.current?.focus()}
                  value={newMed.email}
                  onChangeText={(val) => handleTextChange('email', val)}
                  onFocus={() => setActiveField('email')}
                  onBlur={() => setActiveField(null)}
                />
                {checking.email ? <ActivityIndicator size="small" color="#153c2a" /> : null}
              </View>
              {errors.email ? <Text style={localStyles.errorText}>{errors.email}</Text> : null}

              {/* Mobile Number */}
              <Text style={localStyles.label}>Mobile Number</Text>
              <View
                style={[
                  localStyles.inputWrapper,
                  errors.number && localStyles.inputError,
                  activeField === 'number' && localStyles.inputActive,
                ]}
              >
                <TextInput
                  ref={numberRef}
                  style={localStyles.input}
                  placeholder="09XXXXXXXXX"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={11}
                  returnKeyType="next"
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  value={newMed.number}
                  onChangeText={(val) => handleTextChange('number', val)}
                  onFocus={() => setActiveField('number')}
                  onBlur={() => setActiveField(null)}
                />
                {checking.number ? <ActivityIndicator size="small" color="#153c2a" /> : null}
              </View>
              {errors.number ? <Text style={localStyles.errorText}>{errors.number}</Text> : null}

              {/* Username */}
              <Text style={localStyles.label}>Username</Text>
              <View
                style={[
                  localStyles.inputWrapper,
                  errors.username && localStyles.inputError,
                  activeField === 'username' && localStyles.inputActive,
                ]}
              >
                <TextInput
                  ref={usernameRef}
                  style={localStyles.input}
                  placeholder="Enter your username"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  value={newMed.username}
                  onChangeText={(val) => handleTextChange('username', val)}
                  onFocus={() => setActiveField('username')}
                  onBlur={() => setActiveField(null)}
                />
                {checking.username ? <ActivityIndicator size="small" color="#153c2a" /> : null}
              </View>
              {errors.username ? <Text style={localStyles.errorText}>{errors.username}</Text> : null}

              {/* Password */}
              <Text style={localStyles.label}>Password</Text>
              <View
                style={[
                  localStyles.inputWrapper,
                  errors.password && localStyles.inputError,
                  activeField === 'password' && localStyles.inputActive,
                ]}
              >
                <TextInput
                  ref={passwordRef}
                  style={[localStyles.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  value={newMed.password}
                  onChangeText={(val) => handleTextChange('password', val)}
                  onFocus={() => setActiveField('password')}
                  onBlur={() => setActiveField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={localStyles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={localStyles.errorText}>{errors.password}</Text> : null}

              {/* Password Requirement Checklist */}
              <View style={localStyles.checklistContainer}>
                {passwordRulesData.map((rule, idx) => (
                  <View key={idx} style={localStyles.checklistRow}>
                    <Ionicons
                      name={rule.ok ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={rule.ok ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={[localStyles.checklistText, { color: rule.ok ? '#10B981' : '#64748B' }]}>
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Confirm Password */}
              <Text style={localStyles.label}>Confirm Password</Text>
              <View
                style={[
                  localStyles.inputWrapper,
                  errors.confirmPassword && localStyles.inputError,
                  activeField === 'confirmPassword' && localStyles.inputActive,
                ]}
              >
                <TextInput
                  ref={confirmPasswordRef}
                  style={[localStyles.input, { flex: 1 }]}
                  placeholder="Confirm Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignUp}
                  value={confirmPassword}
                  onChangeText={(val) => handleTextChange('confirmPassword', val)}
                  onFocus={() => setActiveField('confirmPassword')}
                  onBlur={() => setActiveField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={localStyles.eyeIcon}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? (
                <Text style={localStyles.errorText}>{errors.confirmPassword}</Text>
              ) : null}

              {/* Sign Up Button */}
              <TouchableOpacity
                style={localStyles.primaryBtn}
                onPress={handleSignUp}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={localStyles.primaryBtnText}>Sign up</Text>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <View style={localStyles.footerRow}>
                <Text style={localStyles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.replace('Login')}>
                  <Text style={localStyles.footerLink}>Login here.</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ─── STEP 2: VERIFY OTP SCREEN ────────────────────────── */
            <View style={localStyles.formContainer}>
              {/* 6-Digit OTP Grid */}
              <View style={localStyles.otpContainer}>
                {otp.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    style={[
                      localStyles.otpBox,
                      { width: otpBoxWidth },
                      digit !== '' && localStyles.otpBoxActive,
                    ]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(val) => handleOtpChange(val, idx)}
                    onKeyPress={({ nativeEvent }) =>
                      handleOtpBackspace(nativeEvent.key, idx)
                    }
                  />
                ))}
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                style={localStyles.primaryBtn}
                onPress={verifyOtp}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={localStyles.primaryBtnText}>Verify</Text>
                )}
              </TouchableOpacity>

              {/* Resend Code Option */}
              <View style={localStyles.resendWrapper}>
                <Text style={localStyles.resendText}>Didn't get code? </Text>
                {!canResend ? (
                  <Text style={localStyles.resendDisabled}>
                    Resend available in {resendTimer}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={localStyles.resendLink}>Resend now</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  maxContentWidth: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 60,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4E7D5B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '900',
    color: '#153c2a',
    marginBottom: 4,
  },
  subHeading: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  inputActive: {
    borderColor: '#153c2a',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 12,
    marginTop: -2,
    marginLeft: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeIcon: {
    padding: 6,
  },
  primaryBtn: {
    backgroundColor: '#153c2a',
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
    color: '#1e293b',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#153c2a',
  },
  checklistContainer: {
    marginLeft: 4,
    marginBottom: 14,
    marginTop: -2,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  checklistText: {
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '700',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 12,
    marginBottom: 24,
  },
  otpBox: {
    height: 52,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  otpBoxActive: {
    borderColor: '#153c2a',
    borderWidth: 1.5,
  },
  resendWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 13,
    color: '#64748B',
  },
  resendDisabled: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#153c2a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#153c2a',
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  modalOptionSelected: {
    color: '#153c2a',
    fontWeight: '800',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#153c2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E7F5EE',
    borderRadius: 8,
  },
  navBtn: {
    padding: 8,
    backgroundColor: '#E7F5EE',
    borderRadius: 10,
  },
  backToDaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E7F5EE',
    borderRadius: 8,
  },
  backToDaysText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#153c2a',
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayOfWeekText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  daysGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 10,
  },
  cellSelected: {
    backgroundColor: '#153c2a',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  yearGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  yearCell: {
    width: '30%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  monthGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  monthCell: {
    width: '30%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  calendarActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  calendarBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarBtnCancel: {
    backgroundColor: '#F1F5F9',
  },
  calendarBtnConfirm: {
    backgroundColor: '#153c2a',
  },
  calendarBtnCancelText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  calendarBtnConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});