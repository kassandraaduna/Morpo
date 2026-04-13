import React, { useState, useContext, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, 
  ScrollView, KeyboardAvoidingView, Platform, StyleSheet 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import styles from './src/styles/Styles';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';

const API_URL = 'http://192.168.1.24:8000/api/auth';

export default function ResetPasswordScreen({ navigation }) {
  const RESEND_SECONDS = 60;
  const { theme } = useContext(ThemeContext);

  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  
  // Timers & Resend
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // Data States
  const [email, setEmail] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);

  // Password States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const otpRefs = useRef([]);
  const isOtpComplete = otp.every(d => d !== '');

  /* ================= OTP HANDLERS ================= */
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

  /* ================= API ACTIONS ================= */
  const requestOtp = async () => {
    if (!email) return toastError('Email is required');

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/request-password-reset-otp`, { email });

      setOtpId(res.data.otpId);
      setStep('otp');
      setResendTimer(RESEND_SECONDS);
      setCanResend(false);

    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!isOtpComplete) return;

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/verify-password-reset-otp`, {
        otpId,
        code: otp.join(''),
      });

      if (res.data?.message === 'OTP verified') {
        setOtpVerified(true);
        setStep('reset');
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!otpVerified) return toastError('OTP not verified');
    if (!isPasswordValid) return toastError('Password does not meet requirements');
    if (!passwordsMatch) return toastError('Passwords do not match');

    try {
      setLoading(true);
      await axios.post(`${API_URL}/verify-password-reset-otp`, {
        otpId,
        code: otp.join(''),
        newPassword,
      });

      toastSuccess('Password updated successfully');
      navigation.replace('Login');

    } catch (err) {
      toastError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  /* ================= VALIDATION LOGIC ================= */
  const passwordRules = {
    length: pass => pass.length >= 8,
    upper: pass => /[A-Z]/.test(pass),
    number: pass => /\d/.test(pass),
    special: pass => /[!@#$%^&*]/.test(pass),
  };

  const passwordChecks = {
    length: passwordRules.length(newPassword),
    upper: passwordRules.upper(newPassword),
    number: passwordRules.number(newPassword),
    special: passwordRules.special(newPassword),
  };

  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const canSubmitPassword = isPasswordValid && passwordsMatch;

  /* ================= EFFECTS ================= */
  useEffect(() => {
    return () => {
      setOtp(['', '', '', '', '', '']);
      setOtpId('');
      setOtpVerified(false);
      setNewPassword('');
      setStep('email');
    };
  }, []);

  useEffect(() => {
    if (!canResend && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (resendTimer === 0) setCanResend(true);
  }, [resendTimer, canResend]);

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    }
  }, [step]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={localStyles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={localStyles.wrapper}>
          <Image
            source={require('../assets/mypholens_logo.png')}
            style={styles.logo}
          />

          <View style={[styles.card, { backgroundColor: theme.card, borderRadius: 24, width: '100%', padding: 20 }]}>

            {/* ── STEP 1: EMAIL ── */}
            {step === 'email' && (
              <View>
                <Text style={[styles.title, { color: theme.text }]}>RESET PASSWORD</Text>
                <Text style={[styles.subtitle, { color: theme.subText, marginBottom: 20 }]}>
                  Enter the email associated with your account and we will send you a 6-digit one-time pin to reset your password.
                </Text>

                <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: '#E0E0E0', borderWidth: 1 }]}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />

                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }, loading && styles.disabled]} onPress={requestOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={{ marginTop: 25, alignItems: 'center' }} onPress={() => navigation.goBack()}>
                  <Text style={[styles.link, { color: theme.subText }]}>Back to login</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 'otp' && (
              <View>
                <Text style={[styles.title, { color: theme.text, textAlign: 'center' }]}>VERIFY OTP</Text>
                <Text style={[styles.subtitle, { color: theme.subText, textAlign: 'center', marginBottom: 20 }]}>
                  Enter the 6-digit code sent to <Text style={{ fontWeight: '700' }}>{email}</Text>
                </Text>

                <View style={localStyles.otpContainer}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={ref => (otpRefs.current[i] = ref)}
                      style={[localStyles.otpBox, { backgroundColor: theme.bg, color: theme.text }]}
                      value={digit}
                      maxLength={1}
                      keyboardType="numeric"
                      textAlign="center"
                      onChangeText={v => handleOtpChange(v, i)}
                      onKeyPress={({ nativeEvent }) => handleOtpBackspace(nativeEvent.key, i)}
                    />
                  ))}
                </View>

                <TouchableOpacity style={[styles.primaryBtn, (!isOtpComplete || loading) && styles.disabled, { marginTop: 25 }]} disabled={!isOtpComplete || loading} onPress={verifyOtp}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify Code</Text>}
                </TouchableOpacity>

                <TouchableOpacity disabled={!canResend || loading} onPress={requestOtp} style={{ marginTop: 20, alignItems: 'center' }}>
                  <Text style={[styles.link, { color: canResend ? theme.primary : '#999', fontWeight: 'bold' }]}>
                    {canResend ? 'Resend Code' : `Resend available in ${resendTimer}s`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={{ marginTop: 25, alignItems: 'center' }} onPress={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setResendTimer(0); }}>
                  <Text style={[styles.link, { color: theme.subText }]}>Change Email</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 3: RESET PASSWORD ── */}
            {step === 'reset' && (
              <View>
                <Text style={[styles.title, { color: theme.text }]}>ENTER NEW PASSWORD</Text>
                <Text style={[styles.subtitle, { color: theme.subText, marginBottom: 20 }]}>
                  Enter the new password for your account.
                </Text>

                <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                <View style={[styles.passwordWrapper, { borderColor: '#E0E0E0' }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: theme.text, flex: 1, paddingLeft: 15 }]}
                    placeholder="Enter new password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(p => !p)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
                  </TouchableOpacity>
                </View>

                <View style={localStyles.checklistContainer}>
                  {[
                    ['At least 8 characters', passwordChecks.length],
                    ['One uppercase letter', passwordChecks.upper],
                    ['One number', passwordChecks.number],
                    ['Special character (!@#$%^&*)', passwordChecks.special],
                  ].map(([label, ok], i) => (
                    <View key={i} style={localStyles.checklistRow}>
                      <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={14} color={ok ? '#2ecc71' : '#e74c3c'} style={{ marginTop: 1 }} />
                      <Text style={[localStyles.checklistText, { color: ok ? '#2ecc71' : '#e74c3c' }]}>{label}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.label, { color: theme.text }]}>Confirm Password</Text>
                <View style={[styles.passwordWrapper, { borderColor: '#E0E0E0' }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: theme.text, flex: 1, paddingLeft: 15 }]}
                    placeholder="Confirm new password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(p => !p)}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
                  </TouchableOpacity>
                </View>

                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <View style={[localStyles.checklistRow, { marginLeft: 5 }]}>
                    <Ionicons name={passwordsMatch ? 'checkmark-circle' : 'close-circle'} size={14} color={passwordsMatch ? '#2ecc71' : '#e74c3c'} />
                    <Text style={[localStyles.checklistText, { color: passwordsMatch ? '#2ecc71' : '#e74c3c' }]}>
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 30 }, (!canSubmitPassword || loading) && styles.disabled]} disabled={!canSubmitPassword || loading} onPress={resetPassword}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: 'transparent' },
  wrapper: { paddingHorizontal: 20, alignItems: 'center', width: '100%', paddingBottom: 40 },
  logo: { width: 140, height: 140, resizeMode: 'contain', marginTop: 40, marginBottom: 10 },
  
  // OTP Layout Fix
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  otpBox: { width: 45, height: 50, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: 'bold' },

  // Checklist layout
  checklistContainer: { marginLeft: 10, marginBottom: 15, marginTop: -4 },
  checklistRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  checklistText: { fontSize: 11, marginLeft: 6, fontWeight: '600', flex: 1, marginTop: 1 }
});