import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, Image, ScrollView, 
  Alert, Platform, KeyboardAvoidingView, ActivityIndicator, StyleSheet 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

import styles from './src/styles/Styles';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';
import { requestRegisterOtp, verifyRegisterOtp, checkUsername, checkEmail, checkNumber } from './src/services/authService';

export default function Register({ navigation }) {
  const { theme } = useContext(ThemeContext);
  
  // Data States (ADDED yearLevel and section)
  const [newMed, setNewMed] = useState({ fname: '', lname: '', dob: '', gender: '', yearLevel: '', section: '', number: '', email: '', username: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // OTP States
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['','','','','','']);
  const [step, setStep] = useState('form');
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [maskedEmail, setMaskedEmail] = useState('');
  const otpRefs = useRef([]);

  // UI & Loading States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [dobDate, setDobDate] = useState(null);
  
  // Validation States
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [available, setAvailable] = useState({ username: null, email: null, number: null });
  const [checking, setChecking] = useState({ username: false, email: false, number: false });
  const typingTimeout = useRef({});

  /* ================= REAL-TIME VALIDATORS ================= */
  const validateSync = (field, value) => {
    if (!value) return "This field is required.";
    switch (field) {
      case 'fname':
      case 'lname':
        return /^[A-Za-z\s\-']+$/.test(value) ? null : "Letters, spaces, hyphens, or apostrophes only.";
      case 'email':
        return /^[a-zA-Z0-9._%+-]+@(students\.nu-moa\.edu\.ph|gmail\.com|yahoo\.com)$/.test(value) ? null : "Must use valid email domains (e.g., @students.nu-moa.edu.ph, @gmail.com, @yahoo.com).";
      case 'number':
        return /^\d{11}$/.test(value) ? null : "Mobile number must be exactly 11 digits.";
      case 'username':
        return value.length < 4 ? "Username must be at least 4 characters long." : null;
      case 'section':
        return value.trim().length === 0 ? "Section is required." : null;
      case 'password':
        if (value.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(value)) return "Needs at least one uppercase letter.";
        if (!/\d/.test(value)) return "Needs at least one number.";
        if (!/[!@#$%^&*]/.test(value)) return "Needs at least one special character.";
        return null;
      case 'confirmPassword':
        return value !== newMed.password ? "Passwords do not match." : null;
      default:
        return null;
    }
  };

  /* ================= HANDLE INPUT CHANGES & DEBOUNCED API ================= */
  const handleTextChange = (field, val) => {
    const value = val.trim();
    if (field === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setNewMed(prev => ({ ...prev, [field]: value }));
    }
    
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // 1. Instant Synchronous Validation
    const error = validateSync(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));

    // 2. Debounced Asynchronous Validation (Availability Check)
    if (['username', 'email', 'number'].includes(field)) {
      setAvailable(prev => ({ ...prev, [field]: null }));
      
      if (typingTimeout.current[field]) clearTimeout(typingTimeout.current[field]);

      if (!error) {
        setChecking(prev => ({ ...prev, [field]: true }));
        typingTimeout.current[field] = setTimeout(async () => {
          try {
            let res;
            if (field === 'username') res = await checkUsername(value);
            if (field === 'email') res = await checkEmail(value);
            if (field === 'number') res = await checkNumber(value);
            
            setAvailable(prev => ({ ...prev, [field]: res.data?.available }));
          } catch (err) {
            setAvailable(prev => ({ ...prev, [field]: null }));
          } finally {
            setChecking(prev => ({ ...prev, [field]: false }));
          }
        }, 600); 
      } else {
        setChecking(prev => ({ ...prev, [field]: false }));
      }
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const val = field === 'confirmPassword' ? confirmPassword : newMed[field];
    setErrors(prev => ({ ...prev, [field]: validateSync(field, val) }));
  };

  /* ================= DYNAMIC UI STYLERS ================= */
  const getBorderStyle = (field) => {
    if (!touched[field]) return { borderColor: '#E0E0E0' };
    
    const isAsync = ['username', 'email', 'number'].includes(field);
    const hasSyncError = !!errors[field];

    if (hasSyncError) return { borderColor: '#e74c3c', backgroundColor: '#fff5f5', borderWidth: 1.5 };
    if (isAsync && available[field] === false) return { borderColor: '#e74c3c', backgroundColor: '#fff5f5', borderWidth: 1.5 };
    if (isAsync && available[field] === true) return { borderColor: '#2ecc71', borderWidth: 1.2 };
    if (!isAsync && !hasSyncError && (field === 'confirmPassword' ? confirmPassword : newMed[field])) return { borderColor: '#2ecc71', borderWidth: 1.2 };
    
    return { borderColor: '#E0E0E0' };
  };

  /* ================= SUBMIT ================= */
  const canSubmit = Object.values(newMed).every(v => v !== '') && confirmPassword !== '' &&
                    Object.values(errors).every(e => e === null) &&
                    available.username && available.email && available.number;

  const submitForm = async () => {
    // Touch all fields to show any hidden errors
    const allTouched = Object.keys(newMed).reduce((acc, k) => ({ ...acc, [k]: true }), { confirmPassword: true });
    setTouched(allTouched);

    if (!canSubmit) return toastError('Please resolve all field errors first.');

    setIsSubmitting(true);
    try {
      const res = await requestRegisterOtp(newMed.email);
      setOtpId(res.data.otpId);
      // Use masked email from backend if provided, else generate a generic one
      setMaskedEmail(res.data.maskedEmail || newMed.email.replace(/(.{2})(.*)(?=@)/, '$1***'));
      setStep('otp');
      setResendTimer(RESEND_SECONDS);
      setCanResend(false);
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsSubmitting(true);
    try {
      const res = await requestRegisterOtp(newMed.email); 
      setOtpId(res.data.otpId);
      toastSuccess('Verification code resent!');
      setResendTimer(RESEND_SECONDS);
      setCanResend(false);
      setOtp(['','','','','','']);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (error) {
      toastError(error?.response?.data?.message || 'Failed to resend code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    setIsSubmitting(true);
    try {
      await verifyRegisterOtp({ otpId, code: otp.join(''), medData: newMed });
      toastSuccess('Account created successfully');
      navigation.replace('Login');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'OTP verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!canResend && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (resendTimer === 0) setCanResend(true);
  }, [resendTimer, canResend]);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 300);
  }, [step]);

  /* ================= CUSTOM COMPONENTS ================= */
  const FieldFeedback = ({ field, successLabel }) => {
    if (!touched[field]) return null;

    const syncError = errors[field];
    const isAsync = ['username', 'email', 'number'].includes(field);
    const isAvail = available[field];
    const isCheck = checking[field];

    if (syncError) {
      return (
        <View style={localStyles.feedbackRow}>
          <Ionicons name="close-circle" size={14} color="#e74c3c" style={{ marginTop: 2 }} />
          <Text style={[localStyles.feedbackText, { color: '#e74c3c' }]}>{syncError}</Text>
        </View>
      );
    }

    if (isAsync) {
      if (isCheck) {
        return (
          <View style={localStyles.feedbackRow}>
            <ActivityIndicator size="small" color={theme.primary} style={{ transform: [{ scale: 0.7 }] }} />
            <Text style={[localStyles.feedbackText, { color: theme.subText }]}>Checking availability...</Text>
          </View>
        );
      }
      if (isAvail === false) {
        return (
          <View style={localStyles.feedbackRow}>
            <Ionicons name="close-circle" size={14} color="#e74c3c" style={{ marginTop: 2 }} />
            <Text style={[localStyles.feedbackText, { color: '#e74c3c' }]}>{`${field.charAt(0).toUpperCase() + field.slice(1)} already taken.`}</Text>
          </View>
        );
      }
      if (isAvail === true) {
        return (
          <View style={localStyles.feedbackRow}>
            <Ionicons name="checkmark-circle" size={14} color="#2ecc71" style={{ marginTop: 2 }} />
            <Text style={[localStyles.feedbackText, { color: '#2ecc71' }]}>{successLabel}</Text>
          </View>
        );
      }
    }
    return null;
  };

  const passwordRulesData = [
    { label: '8+ characters', ok: newMed.password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(newMed.password) },
    { label: 'One number', ok: /\d/.test(newMed.password) },
    { label: 'Special character (!@#$%^&*)', ok: /[!@#$%^&*]/.test(newMed.password) },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={localStyles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={localStyles.wrapper}>
          <Image
            source={require('../assets/mypholens_logo.png')}
            style={styles.logo}
          />

          <View style={[styles.card, { width: '100%', backgroundColor: theme.card, borderRadius: 25, paddingBottom: 40 }]}>
            {step === 'form' ? (
              <View>
                <Text style={[styles.title, { color: theme.text }]}>SIGN UP</Text>
                <Text style={[styles.subtitle, { color: theme.subText, marginBottom: 20 }]}>Create an account to explore MyphoLens.</Text>

                    <Text style={[styles.label, { color: theme.text }]}>First Name</Text>
                    <TextInput 
                      style={[styles.input, { color: '#000' }, getBorderStyle('fname')]} 
                      placeholder="First Name" placeholderTextColor="#999" 
                      value={newMed.fname} onBlur={() => handleBlur('fname')} onChangeText={v => handleTextChange('fname', v)} 
                    />
                    <FieldFeedback field="fname" />

                    <Text style={[styles.label, { color: theme.text }]}>Last Name</Text>
                    <TextInput 
                      style={[styles.input, { color: '#000' }, getBorderStyle('lname')]} 
                      placeholder="Last Name" placeholderTextColor="#999" 
                      value={newMed.lname} onBlur={() => handleBlur('lname')} onChangeText={v => handleTextChange('lname', v)} 
                    />
                    <FieldFeedback field="lname" />

                <View style={localStyles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.label, { color: theme.text }]}>Date of Birth</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }, getBorderStyle('dob')]} onPress={() => {setShowDobPicker(true); handleBlur('dob');}}>
                      <Text style={{ color: newMed.dob ? '#000' : '#999' }}>{newMed.dob || 'MM/DD/YYYY'}</Text>
                    </TouchableOpacity>
                    <FieldFeedback field="dob" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.text }]}>Gender</Text>
                    <View style={[styles.input, { paddingHorizontal: 0, justifyContent: 'center' }, getBorderStyle('gender')]}>
                      <Picker 
                        selectedValue={newMed.gender} 
                        onValueChange={v => { handleTextChange('gender', v); }}
                        style={{ color: newMed.gender ? '#000' : '#999', width: '100%', height: '100%' }}
                        itemStyle={{ color: '#000' }} 
                      >
                        <Picker.Item label="Select" value="" color="#999" />
                        <Picker.Item label="Male" value="Male" color="#000" />
                        <Picker.Item label="Female" value="Female" color="#000" />
                        <Picker.Item label="Prefer not to say" value="Prefer not to say" color="#000" />
                      </Picker>
                    </View>
                    <FieldFeedback field="gender" />
                  </View>
                </View>

                <View style={localStyles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.label, { color: theme.text }]}>Year Level</Text>
                    <View style={[styles.input, { paddingHorizontal: 0, justifyContent: 'center' }, getBorderStyle('yearLevel')]}>
                      <Picker 
                        selectedValue={newMed.yearLevel} 
                        onValueChange={v => { handleTextChange('yearLevel', v); }}
                        style={{ color: newMed.yearLevel ? '#000' : '#999', width: '100%', height: '100%' }}
                        itemStyle={{ color: '#000' }} 
                      >
                        <Picker.Item label="Select" value="" color="#999" />
                        <Picker.Item label="1st Year" value="1st Year" color="#000" />
                        <Picker.Item label="2nd Year" value="2nd Year" color="#000" />
                        <Picker.Item label="3rd Year" value="3rd Year" color="#000" />
                        <Picker.Item label="4th Year" value="4th Year" color="#000" />
                      </Picker>
                    </View>
                    <FieldFeedback field="yearLevel" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.text }]}>Section</Text>
                    <TextInput 
                      style={[styles.input, { color: '#000' }, getBorderStyle('section')]} 
                      placeholder="e.g. MED222" placeholderTextColor="#999" 
                      value={newMed.section} onBlur={() => handleBlur('section')} onChangeText={v => handleTextChange('section', v)} 
                    />
                    <FieldFeedback field="section" />
                  </View>
                </View>

                <Text style={[styles.label, { color: theme.text }]}>Student Email</Text>
                <TextInput 
                  style={[styles.input, { color: '#000' }, getBorderStyle('email')]} 
                  placeholder="name@students.nu-moa.edu.ph | name@gmail.com | name@yahoo.com" placeholderTextColor="#999" autoCapitalize="none" keyboardType="email-address"
                  value={newMed.email} onBlur={() => handleBlur('email')} onChangeText={v => handleTextChange('email', v.toLowerCase())} 
                />
                <FieldFeedback field="email" successLabel="Email is available." />

                <Text style={[styles.label, { color: theme.text }]}>Mobile Number</Text>
                <TextInput 
                  style={[styles.input, { color: '#000' }, getBorderStyle('number')]} 
                  placeholder="0917XXXXXXX" placeholderTextColor="#999" keyboardType="numeric" maxLength={11}
                  value={newMed.number} onBlur={() => handleBlur('number')} onChangeText={v => handleTextChange('number', v)} 
                />
                <FieldFeedback field="number" successLabel="Mobile number is available." />

                <Text style={[styles.label, { color: theme.text }]}>Username</Text>
                <TextInput 
                  style={[styles.input, { color: '#000' }, getBorderStyle('username')]} 
                  placeholder="Create Username" placeholderTextColor="#999" autoCapitalize="none"
                  value={newMed.username} onBlur={() => handleBlur('username')} onChangeText={v => handleTextChange('username', v)} 
                />
                <FieldFeedback field="username" successLabel="Username is available." />

                <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                <View style={[styles.passwordWrapper, getBorderStyle('password')]}>
                  <TextInput
                    style={[styles.passwordInput, { color: '#000', flex: 1, paddingLeft: 15 }]}
                    placeholder="Create Password" placeholderTextColor="#999" secureTextEntry={!showPassword}
                    value={newMed.password} onBlur={() => handleBlur('password')} onChangeText={v => handleTextChange('password', v)}
                  />
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
                  </TouchableOpacity>
                </View>
                
                <View style={localStyles.checklistContainer}>
                  {passwordRulesData.map((rule, idx) => (
                    <View key={idx} style={localStyles.checklistRow}>
                      <Ionicons name={rule.ok ? "checkmark-circle" : "close-circle"} size={14} color={rule.ok ? "#2ecc71" : (touched.password ? "#e74c3c" : "#999")} style={{ marginTop: 1 }} />
                      <Text style={[localStyles.checklistText, { color: rule.ok ? "#2ecc71" : (touched.password ? "#e74c3c" : "#999") }]}>{rule.label}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.label, { color: theme.text }]}>Confirm Password</Text>
                <View style={[styles.passwordWrapper, getBorderStyle('confirmPassword')]}>
                  <TextInput
                    style={[styles.passwordInput, { color: '#000', flex: 1, paddingLeft: 15 }]}
                    placeholder="Repeat Password" placeholderTextColor="#999" secureTextEntry={!showConfirmPassword}
                    value={confirmPassword} onBlur={() => handleBlur('confirmPassword')} onChangeText={v => handleTextChange('confirmPassword', v)}
                  />
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
                  </TouchableOpacity>
                </View>
                <FieldFeedback field="confirmPassword" />

                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 30 }, (!canSubmit || isSubmitting) && styles.disabled]} onPress={submitForm} disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign Up</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={[styles.title, { textAlign: 'center', color: theme.text }]}>Verify Your Email</Text>
                <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: 20, color: theme.subText }]}>A 6-digit OTP is sent to {maskedEmail}</Text>
                <View style={localStyles.otpContainer}>
                  {otp.map((digit, i) => (
                    <TextInput 
                      key={i} 
                      ref={ref => (otpRefs.current[i] = ref)} 
                      style={[localStyles.otpBox, { backgroundColor: theme.bg, color: theme.text }]} 
                      keyboardType="numeric" maxLength={1} value={digit}
                      onKeyPress={({ nativeEvent }) => {
                        if (nativeEvent.key === 'Backspace' && digit === '' && i > 0) {
                          otpRefs.current[i - 1]?.focus();
                        }
                      }}
                      onChangeText={v => {
                        const copy = [...otp]; copy[i] = v; setOtp(copy);
                        if (v && i < 5) otpRefs.current[i + 1]?.focus();
                      }}
                    />
                  ))}
                </View>
                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 25 }, (!otp.every(d => d !== '') || isSubmitting) && styles.disabled]} onPress={verifyOtp} disabled={!otp.every(d => d !== '') || isSubmitting}>
                   {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify Account</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleResend} disabled={isSubmitting || !canResend} style={{ marginTop: 20 }}>
                  <Text style={{ textAlign: 'center', color: canResend ? theme.primary : '#999', fontWeight: 'bold' }}>
                    {canResend ? 'Resend Code' : `Resend code in ${resendTimer}s`}
                  </Text>
                </TouchableOpacity>

              </View>
            )}

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 25 }}>
              <Text style={[styles.link, { textAlign: 'center', color: theme.subText }]}>
                Already have an account? <Text style={{ fontWeight: 'bold', color: theme.primary }}>Login here</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showDobPicker && (
        <DateTimePicker
          value={dobDate || new Date(2005, 0, 1)}
          mode="date" display="default"
          onChange={(event, selectedDate) => {
            setShowDobPicker(false);
            if (selectedDate) {
              setDobDate(selectedDate);
              const formatted = selectedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
              handleTextChange('dob', formatted);
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: 'transparent' },
  wrapper: { paddingHorizontal: 20, alignItems: 'center', width: '100%', paddingBottom: 40 },
  row: { flexDirection: 'row', width: '100%' },
  
  // Feedback layout fixes
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -6, marginBottom: 12, paddingHorizontal: 8 },
  feedbackText: { fontSize: 11, marginLeft: 6, flex: 1, fontWeight: '600', marginTop: 1 },
  
  // Checklist layout
  checklistContainer: { marginLeft: 10, marginBottom: 15, marginTop: -4 },
  checklistRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  checklistText: { fontSize: 11, marginLeft: 6, fontWeight: '600', flex: 1, marginTop: 1 },

  // OTP Layout Fix
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  otpBox: { width: 45, height: 50, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: 'bold' }
});