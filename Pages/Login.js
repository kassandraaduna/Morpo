import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login, verifyLoginOtp, resendLoginOtp } from '../Pages/src/services/authService';
import { toastError, toastSuccess } from '../Pages/src/components/ToastMsg';
import { ThemeContext } from '../Pages/src/context/ThemeContext';

const RESEND_SECONDS = 60;

export default function Login({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const { width } = useWindowDimensions();

  // ─── Responsive Scaling Calculations ─────────────────────────────
  const baseWidth = 375;
  const scale = width / baseWidth;
  const normalize = (size) => Math.round(size * Math.min(scale, 1.2));

  // ─── Step: 'login' | 'otp' ───────────────────────────────────────
  const [step, setStep] = useState('login');

  // ─── Login Form State ────────────────────────────────────────────
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // ─── Input Focus States ──────────────────────────────────────────
  const [focusedField, setFocusedField] = useState(null);

  // ─── OTP Verification State ──────────────────────────────────────
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpId, setOtpId] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const otpRefs = useRef([]);

  // ─── Resend Timer State ──────────────────────────────────────────
  const [resendTimer, setResendTimer] = useState(0);

  // ─── Disclaimer Modal State ──────────────────────────────────────
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // ─── Resend Countdown Effect ─────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ─── Auto-focus First OTP Box ────────────────────────────────────
  useEffect(() => {
    if (step === 'otp') {
      const timeout = setTimeout(() => otpRefs.current[0]?.focus(), 300);
      return () => clearTimeout(timeout);
    }
  }, [step]);

  // ─── Route After Successful Login ────────────────────────────────
  const routeAfterLogin = async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    if (user?.role?.toLowerCase() === 'instructor') {
      navigation.replace('InstructorBottomTab');
    } else {
      navigation.replace('StudentBottomTab');
    }
  };

  // ─── LOGIN HANDLER ───────────────────────────────────────────────
  const handleLogin = async () => {
    const input = form.usernameOrEmail.trim();
    const pass = form.password;

    if (!input || !pass) {
      toastError('Please fill in all fields.');
      return;
    }

    try {
      setLoginLoading(true);
      const res = await login({ usernameOrEmail: input, password: pass });

      const payload = res.data?.data || res.data || {};

      const needsOtp =
        payload.requireOtp ||
        payload.requiresOtp ||
        payload.requireOTP ||
        payload.requiresOTP ||
        payload.otpRequired ||
        payload.isFirstLogin ||
        (payload.otpId && !payload.user && !payload.token);

      if (needsOtp) {
        setOtpId(payload.otpId || '');
        setOtpEmail(payload.email || input);
        setStep('otp');
        setResendTimer(RESEND_SECONDS);
        toastSuccess('Verification OTP sent to your email.');
        return;
      }

      if (payload.user || payload.token) {
        const userObj = payload.user || payload;
        await routeAfterLogin(userObj);
      } else {
        toastError('Unexpected response from server. Please try again.');
      }
    } catch (error) {
      const errPayload =
        error?.response?.data?.data || error?.response?.data || {};
      const errorMessage = (errPayload.message || '').toLowerCase();

      const needsOtpInErr =
        errPayload.requireOtp ||
        errPayload.requiresOtp ||
        errPayload.requireOTP ||
        errPayload.requiresOTP ||
        errPayload.otpRequired ||
        errPayload.isFirstLogin ||
        (errPayload.otpId && !errPayload.user && !errPayload.token);

      if (needsOtpInErr) {
        setOtpId(errPayload.otpId || '');
        setOtpEmail(errPayload.email || input);
        setStep('otp');
        setResendTimer(RESEND_SECONDS);
        toastSuccess('Verification OTP sent to your email.');
      } else if (
        error?.response?.status === 404 ||
        errorMessage.includes('not found') ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('no user')
      ) {
        toastError('Account not found. Please create an account first.');
      } else {
        toastError(errPayload.message || 'Invalid username or password.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // ─── VERIFY OTP HANDLER ──────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      toastError('Please enter the full 6-digit OTP.');
      return;
    }

    try {
      setOtpLoading(true);
      const res = await verifyLoginOtp({ otpId, code, email: otpEmail });
      const payload = res.data?.data || res.data || {};

      if (payload.user || payload.token) {
        toastSuccess('Login successful!');
        const userObj = payload.user || payload;
        await routeAfterLogin(userObj);
      } else {
        toastError('Verification failed. Please try again.');
      }
    } catch (error) {
      const errPayload =
        error?.response?.data?.data || error?.response?.data || {};
      toastError(errPayload.message || 'Invalid OTP code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // ─── RESEND OTP HANDLER ──────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    if (!otpEmail) {
      toastError('Missing email for resend. Please login again.');
      return;
    }

    try {
      const res = await resendLoginOtp(otpEmail);
      const payload = res.data?.data || res.data || {};

      if (payload.otpId) setOtpId(payload.otpId);
      setOtp(['', '', '', '', '', '']);
      setResendTimer(RESEND_SECONDS);
      toastSuccess('A new OTP has been sent.');
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (error) {
      const errPayload =
        error?.response?.data?.data || error?.response?.data || {};
      toastError(errPayload.message || 'Failed to resend code.');
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

  const responsivePaddingHorizontal = Math.max(20, Math.round(width * 0.06));
  const otpBoxWidth = Math.floor((width - (responsivePaddingHorizontal * 2) - 25) / 6);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[localStyles.container, { backgroundColor: theme.bg || '#F8F9FA' }]}
    >
      {/* ─── DISCLAIMER MODAL ─────────────────────────────────────── */}
      <Modal
        visible={showDisclaimer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisclaimer(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.disclaimerCard, { width: Math.min(width - 48, 400) }]}>
            <Text style={localStyles.disclaimerTitle}>DISCLAIMER</Text>
            <Text style={localStyles.disclaimerBody}>
              THIS APPLICATION IS INTENDED FOR EDUCATIONAL PURPOSES ONLY AND IS NOT
              DESIGNED FOR MEDICAL DIAGNOSIS.
            </Text>
            <TouchableOpacity
              style={localStyles.disclaimerBtn}
              onPress={() => setShowDisclaimer(false)}
              activeOpacity={0.85}
            >
              <Text style={localStyles.disclaimerBtnText}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[
          localStyles.scrollContent,
          { paddingHorizontal: responsivePaddingHorizontal },
          step === 'otp' ? localStyles.otpScrollContent : localStyles.loginScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'login' ? (
          /* ─── STEP 1: LOGIN ACCOUNT SCREEN ─────────────────────── */
          <View style={[localStyles.formContainer, { maxWidth: 450, alignSelf: 'center', width: '100%' }]}>
            <View style={localStyles.logoContainer}>
              <Image
                source={require('../assets/mypholens_logo.png')}
                style={[
                  localStyles.logo,
                  { width: Math.min(width * 0.85, 330), height: Math.min(width * 0.42, 160) },
                ]}
              />
            </View>

            <Text style={[localStyles.heading, { fontSize: normalize(28) }]}>Login Account</Text>
            <Text style={[localStyles.subHeading, { fontSize: normalize(14) }]}>
              Sign in to your account to get started.
            </Text>

            {/* Username / Email Input */}
            <Text style={[localStyles.label, { fontSize: normalize(13) }]}>Username / Email</Text>
            <View
              style={[
                localStyles.inputWrapper,
                focusedField === 'username' && localStyles.inputWrapperActive,
              ]}
            >
              <TextInput
                style={[localStyles.input, { fontSize: normalize(14) }]}
                placeholder="Enter your username or email"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                value={form.usernameOrEmail}
                onChangeText={(val) => setForm({ ...form, usernameOrEmail: val })}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password Input */}
            <Text style={[localStyles.label, { fontSize: normalize(13) }]}>Password</Text>
            <View
              style={[
                localStyles.inputWrapper,
                focusedField === 'password' && localStyles.inputWrapperActive,
              ]}
            >
              <TextInput
                style={[localStyles.input, { flex: 1, fontSize: normalize(14) }]}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={form.password}
                onChangeText={(val) => setForm({ ...form, password: val })}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
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

            {/* Forgot Password */}
            <TouchableOpacity
              style={localStyles.forgotWrapper}
              onPress={() => navigation.navigate('ResetPassword')}
            >
              <Text style={[localStyles.forgotText, { fontSize: normalize(13) }]}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={localStyles.primaryBtn}
              onPress={handleLogin}
              disabled={loginLoading}
              activeOpacity={0.85}
            >
              {loginLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[localStyles.primaryBtnText, { fontSize: normalize(16) }]}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={localStyles.footerRow}>
              <Text style={[localStyles.footerText, { fontSize: normalize(13) }]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[localStyles.footerLink, { fontSize: normalize(13) }]}>Sign up here.</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ─── STEP 2: VERIFY OTP SCREEN ────────────────────────── */
          <View style={[localStyles.formContainer, { maxWidth: 450, alignSelf: 'center', width: '100%' }]}>
            <TouchableOpacity
              style={localStyles.backButton}
              onPress={() => setStep('login')}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={[localStyles.heading, { fontSize: normalize(28) }]}>Verify OTP</Text>
            <Text style={[localStyles.subHeading, { fontSize: normalize(14) }]}>
              Enter the 6-digit one-time pin sent to your email to reset your
              password.
            </Text>

            <View style={localStyles.otpContainer}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => (otpRefs.current[idx] = el)}
                  style={[
                    localStyles.otpBox,
                    { width: Math.min(otpBoxWidth, 55), fontSize: normalize(18) },
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

            <TouchableOpacity
              style={localStyles.primaryBtn}
              onPress={handleVerifyOtp}
              disabled={otpLoading}
              activeOpacity={0.85}
            >
              {otpLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[localStyles.primaryBtnText, { fontSize: normalize(16) }]}>Verify</Text>
              )}
            </TouchableOpacity>

            <View style={localStyles.resendWrapper}>
              <Text style={[localStyles.resendText, { fontSize: normalize(13) }]}>Didn't get code? </Text>
              {resendTimer > 0 ? (
                <Text style={[localStyles.resendDisabled, { fontSize: normalize(13) }]}>
                  Resend available in {resendTimer}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOtp}>
                  <Text style={[localStyles.resendLink, { fontSize: normalize(13) }]}>Resend now</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={localStyles.tryAnotherBtn}
              onPress={() => setStep('login')}
            >
              <Text style={[localStyles.tryAnotherText, { fontSize: normalize(13) }]}>Try another email</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loginScrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 60,
    justifyContent: 'flex-start',
  },
  otpScrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 60,
    justifyContent: 'flex-start',
  },
  formContainer: {
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 0,
  },
  logo: {
    resizeMode: 'contain',
  },
  heading: {
    fontWeight: '900',
    color: '#153c2a',
    marginBottom: 4,
  },
  subHeading: {
    color: '#1e293b',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
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
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputWrapperActive: {
    borderColor: '#153c2a',
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    color: '#0F172A',
  },
  eyeIcon: {
    padding: 6,
  },
  forgotWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontWeight: '800',
    color: '#153c2a',
  },
  primaryBtn: {
    backgroundColor: '#153c2a',
    height: 54,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#1e293b',
  },
  footerLink: {
    fontWeight: '800',
    color: '#153c2a',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#4E7D5B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    color: '#64748B',
  },
  resendDisabled: {
    fontWeight: '700',
    color: '#64748B',
  },
  resendLink: {
    fontWeight: '800',
    color: '#153c2a',
  },
  tryAnotherBtn: {
    alignSelf: 'center',
    marginTop: 18,
  },
  tryAnotherText: {
    fontWeight: '600',
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  disclaimerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  disclaimerBody: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  disclaimerBtn: {
    backgroundColor: '#153c2a',
    borderRadius: 10,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  disclaimerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});