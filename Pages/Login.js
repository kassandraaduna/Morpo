import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

import styles from './src/styles/Styles';
import { login, verifyLoginOtp, resendLoginOtp } from './src/services/authService';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';

const RESEND_SECONDS = 60;

export default function Login({ navigation }) {
  const { theme, darkMode } = useContext(ThemeContext);

  // ─── Step: 'login' | 'otp' ───────────────────────────────────────
  const [step, setStep] = useState('login');

  // ─── Login form ───────────────────────────────────────────────────
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // ─── OTP ──────────────────────────────────────────────────────────
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpId, setOtpId] = useState('');
  const [otpEmail, setOtpEmail] = useState('');   // full email for resend
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const otpRefs = useRef([]);

  // ─── Resend timer ─────────────────────────────────────────────────
  const [resendTimer, setResendTimer] = useState(0);
  const isOtpComplete = otp.every(d => d !== '');

  // ─── Disclaimer ───────────────────────────────────────────────────
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // ─── Disclaimer check on mount ───────────────────────────────────
  useEffect(() => {
    (async () => {
      const accepted = await AsyncStorage.getItem('disclaimerAccepted');
      if (!accepted) setShowDisclaimer(true);
    })();
  }, []);

  // ─── Resend countdown ────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ─── Auto-focus first OTP box when step changes ──────────────────
  useEffect(() => {
    if (step === 'otp') {
      const timeout = setTimeout(() => otpRefs.current[0]?.focus(), 300);
      return () => clearTimeout(timeout);
    }
  }, [step]);

  // ─── Route after successful login ──
  const routeAfterLogin = async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));

    if (user.mustChangePassword) {
      navigation.replace('ChangePassword', { user });
      return;
    }

    const role = String(user.role || '').toLowerCase();

    if (role === 'instructor') {
      navigation.replace('InstructorBottomTab');
    } else if (role === 'student') {
      navigation.replace('StudentBottomTab');
    } else {
      toastError('This account does not have mobile access. Please use the web portal.');
    }
  };


  // ─── LOGIN ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const input = form.usernameOrEmail.trim();
    const pass  = form.password;

    if (!input || !pass) {
      toastError('Please enter your username/email and password.');
      return;
    }

    try {
      setLoginLoading(true);
      const res = await login({ usernameOrEmail: input, password: pass });

      // MFA required (periodic re-verification or pending email)
      if (res.data?.mfaRequired) {
        setOtpId(res.data.otpId || '');
        setOtpEmail(res.data.email || '');
        setMaskedEmail(res.data.maskedEmail || '');
        setOtp(['', '', '', '', '', '']);
        setResendTimer(RESEND_SECONDS);
        setStep('otp');

        if (res.data.pendingEmailVerification) {
          toastSuccess('Verify your new email to continue.');
        }
        return;
      }

      const user = res.data?.data?.user;
      if (!user) throw new Error('User data missing from response.');
      await routeAfterLogin(user);

    } catch (err) {
      const status  = err?.response?.status;
      const message = err?.response?.data?.message || 'Login failed. Please try again.';

      if (status === 403) {
        // Deactivated account (includes auto-deactivation after 3 failed attempts)
        toastError(message);
      } else if (status === 401) {
        toastError(message);
      } else if (status === 429) {
        toastError(message);
      } else {
        toastError(message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // ─── VERIFY OTP ──────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return;

    try {
      setOtpLoading(true);
      const res = await verifyLoginOtp({ otpId, code });

      const user = res.data?.data?.user;
      if (!user) throw new Error('User data missing from OTP response.');
      await routeAfterLogin(user);

    } catch (err) {
      const message = err?.response?.data?.message || 'Invalid code. Please try again.';
      toastError(message);
      // Clear OTP and refocus on error (mirrors web behavior)
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } finally {
      setOtpLoading(false);
    }
  };

  // ─── RESEND OTP ───────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    if (!otpEmail) {
      toastError('Missing email for resend. Please login again.');
      return;
    }

    try {
      const res = await resendLoginOtp(otpEmail);
      // Update otpId in case backend issues a new one
      if (res.data?.otpId) setOtpId(res.data.otpId);
      if (res.data?.maskedEmail) setMaskedEmail(res.data.maskedEmail);

      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
      setResendTimer(RESEND_SECONDS);
      toastSuccess('Verification code resent!');
    } catch (err) {
      toastError(err?.response?.data?.message || 'Failed to resend code.');
    }
  };

  // ─── OTP digit change helper ──────────────────────────────────────
  const handleOtpChange = (value, index) => {
    const copy = [...otp];
    copy[index] = value;
    setOtp(copy);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when last box is filled
    if (value && index === 5) {
      const complete = copy.every(d => d !== '');
      if (complete) {
        setTimeout(() => handleVerifyOtp(), 150);
      }
    }
  };

  const handleOtpBackspace = (key, index) => {
    if (key === 'Backspace' && otp[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={localStyles.wrapper}>
          <Image
            source={require('../assets/mypholens_logo.png')}
            style={styles.logo}
          />

          <View style={[styles.card, { backgroundColor: theme.card, borderRadius: 24, width: '100%', padding: 20 }]}>

            {/* ── LOGIN STEP ── */}
            {step === 'login' && (
              <View>
                <Text style={[styles.title, { color: theme.text }]}>SIGN IN</Text>
                <Text style={[styles.subtitle, { color: theme.subText, marginBottom: 20 }]}>
                  Sign in to your account to get started.
                </Text>

                <Text style={[styles.label, { color: theme.subText }]}>
                  Username / Email
                </Text>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter your username or email"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={form.usernameOrEmail}
                  onChangeText={v => setForm(p => ({ ...p, usernameOrEmail: v }))}
                />

                <Text style={[styles.label, { color: theme.subText }]}>
                  Password
                </Text>
                <View style={[styles.passwordWrapper, { borderColor: '#E0E0E0' }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: theme.text, flex: 1, paddingLeft: 15 }]}
                    placeholder="Enter your password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    value={form.password}
                    onChangeText={v => setForm(p => ({ ...p, password: v }))}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(p => !p)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#777"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', marginTop: 10, marginBottom: 15 }}
                  onPress={() => navigation.navigate('ResetPassword')}
                >
                  <Text style={[styles.forgotText, { color: theme.subText }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, loginLoading && styles.disabled]}
                  disabled={loginLoading}
                  onPress={handleLogin}
                >
                  {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign in</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={{ marginTop: 25 }} onPress={() => navigation.navigate('Register')}>
                  <Text style={[styles.link, { color: theme.subText, textAlign: 'center' }]}>
                    Don't have an account yet?{' '}
                    <Text style={{ fontWeight: 'bold', color: theme.primary }}>
                      Sign up here
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── OTP STEP ── */}
            {step === 'otp' && (
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
                      onKeyPress={({ nativeEvent }) => handleOtpBackspace(nativeEvent.key, i)}
                      onChangeText={v => handleOtpChange(v, i)}
                    />
                  ))}
                </View>
                
                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 25 }, (!isOtpComplete || otpLoading) && styles.disabled]} onPress={handleVerifyOtp} disabled={!isOtpComplete || otpLoading}>
                   {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify Account</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleResendOtp} disabled={otpLoading || resendTimer > 0} style={{ marginTop: 20 }}>
                  <Text style={{ textAlign: 'center', color: resendTimer > 0 ? '#999' : theme.primary, fontWeight: 'bold' }}>
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 25, alignItems: 'center' }}
                  onPress={() => {
                    setStep('login');
                    setOtp(['', '', '', '', '', '']);
                    setOtpId('');
                    setOtpEmail('');
                    setMaskedEmail('');
                    setResendTimer(0);
                  }}
                >
                  <Text style={[styles.link, { color: theme.subText }]}>
                    Back to login
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </ScrollView>

      {/* ── DISCLAIMER OVERLAY ── */}
      {showDisclaimer && (
        <View style={localStyles.overlay}>
          <BlurView
            intensity={70}
            tint={darkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.disclaimerCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.disclaimerTitle, { color: theme.text }]}>
              DISCLAIMER
            </Text>
            <Text style={[styles.disclaimerText, { color: theme.subText }]}>
              THIS APPLICATION IS FOR EDUCATIONAL PURPOSES ONLY AND IS NOT
              INTENDED FOR MEDICAL DIAGNOSIS.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={async () => {
                await AsyncStorage.setItem('disclaimerAccepted', 'true');
                setShowDisclaimer(false);
              }}
            >
              <Text style={styles.btnText}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, alignItems: 'center', width: '100%', paddingBottom: 40 },
  logo: { width: 140, height: 140, resizeMode: 'contain', marginTop: 40, marginBottom: 10 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  otpBox: { width: 45, height: 50, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, textAlign: 'center', fontSize: 20, fontWeight: 'bold' }
});