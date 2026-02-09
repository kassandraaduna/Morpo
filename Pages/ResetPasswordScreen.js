import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';

const API_URL = 'http://192.168.1.24:8000/api/auth';

export default function ResetPasswordScreen({ navigation }) {
  const RESEND_SECONDS = 60;

  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  const { theme } = useContext(ThemeContext);
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef([]);
  const [email, setEmail] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['','','','','','']);
  const [otpVerified, setOtpVerified] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  const isOtpComplete = otp.every(d => d !== '');

  const requestOtp = async () => {
    if (!email) return toastError('Email is required');

    try {
      setLoading(true);
      const res = await axios.post(
        `${API_URL}/request-password-reset-otp`,
        { email }
      );

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

      const res = await axios.post(
        `${API_URL}/verify-password-reset-otp`,
        {
          otpId,
          code: otp.join(''),
        }
      );

      if (res.data?.message === 'OTP verified') {
        setOtpVerified(true);
        setStep('reset');
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!otpVerified) {
      return toastError('OTP not verified');
    }

    if (!isPasswordValid) {
      return toastError('Password does not meet requirements');
    }

    if (!passwordsMatch) {
      return toastError('Passwords do not match');
    }

    try {
      setLoading(true);

      await axios.post(
        `${API_URL}/verify-password-reset-otp`,
        {
          otpId,
          code: otp.join(''),
          newPassword,
        }
      );

      toastSuccess('Password updated successfully');
      navigation.replace('Login');

    } catch (err) {
      toastError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    return () => {
      setOtp(['','','','','','']);
      setOtpId('');
      setOtpVerified(false);
      setNewPassword('');
      setStep('email');
    };
  }, []);

  useEffect(() => {
  if (!canResend && resendTimer > 0) {
    const timer = setTimeout(() => {
      setResendTimer(t => t - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }

  if (resendTimer === 0) {
    setCanResend(true);
  }
}, [resendTimer, canResend]);

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 300);
    }
  }, [step]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.shell, { backgroundColor: theme.bg }]}>

        {/* LOGO */}
        <Image
          source={require('../assets/mypholens_logo.png')}
          style={styles.logo}
        />

        {/* CARD */}
        <View style={[styles.card, { backgroundColor: theme.card }]}
        >

          {step === 'email' && (
            <>
              <Text style={[styles.title, { color: theme.text }]}>
                RESET PASSWORD
              </Text>

              <Text style={[styles.subtitle, { color: theme.subText }]}>
                Enter the email associated with your account and we will send you a 6-digit one-time pin to reset your password.
              </Text>

              <Text style={[styles.label, { color: theme.text }]}>
                Email Address
              </Text>

              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.search },
                ]}
                placeholder="Enter your email"
                placeholderTextColor={theme.subText}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={requestOtp}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.btnText}>Continue</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={[styles.title, { color: theme.text }]}>
                OTP
              </Text>

              <Text style={[styles.subtitle, { color: theme.subText }]}>
                Enter the 6-digit one-time pin sent to your email.
              </Text>

              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={ref => (otpRefs.current[i] = ref)}
                    style={[
                      styles.otpBox,
                      { backgroundColor: theme.search, color: theme.text },
                    ]}
                    value={digit}
                    maxLength={1}
                    keyboardType="numeric"
                    textAlign="center"
                    onChangeText={v => {
                      const copy = [...otp];
                      copy[i] = v;
                      setOtp(copy);

                      if (v && i < otp.length - 1) {
                        otpRefs.current[i + 1]?.focus();
                      }
                    }}
                    onKeyPress={({ nativeEvent }) => {
                      if (
                        nativeEvent.key === 'Backspace' &&
                        otp[i] === '' &&
                        i > 0
                      ) {
                        otpRefs.current[i - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </View>

              <TouchableOpacity
                disabled={!canResend}
                onPress={async () => {
                  try {
                    await axios.post(
                      `${API_URL}/resend-password-reset-otp`,
                      { email }
                    );

                    toastSuccess('OTP resent');
                    setResendTimer(RESEND_SECONDS);
                    setCanResend(false);

                  } catch (err) {
                    toastError(err.response?.data?.message || 'Failed to resend OTP');
                  }
                }}
              >
                <Text
                  style={[
                    styles.link,
                    { color: canResend ? theme.primary : theme.subText }
                  ]}
                >
                  {canResend
                    ? 'Didn’t receive OTP? Resend code'
                    : `Resend available in ${resendTimer}s`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  !isOtpComplete && styles.disabled,
                ]}
                disabled={!isOtpComplete}
                onPress={verifyOtp}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.btnText}>Continue</Text>
                }
              </TouchableOpacity>

            </>
          )}

          {step === 'reset' && (
            <>
              <Text style={[styles.title, { color: theme.text }]}>
                ENTER NEW PASSWORD
              </Text>

              <Text style={[styles.subtitle, { color: theme.subText }]}>
                Enter the new password for your account.
              </Text>

              <Text style={[styles.label, { color: theme.text }]}>
                Password
              </Text>

              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    { backgroundColor: theme.search, color: theme.text },
                  ]}
                  placeholder="Enter new password"
                  placeholderTextColor={theme.subText}
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(p => !p)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.subText}
                  />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 12 }}>
                {[
                  ['At least 8 characters', passwordChecks.length],
                  ['One uppercase letter', passwordChecks.upper],
                  ['One number', passwordChecks.number],
                  ['One special character (!@#$%^&*)', passwordChecks.special],
                ].map(([label, ok], i) => (
                  <View
                    key={i}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}
                  >
                    <Ionicons
                      name={ok ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={ok ? '#22c55e' : '#ef4444'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ color: theme.subText, fontSize: 13 }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>
                Confirm Password
              </Text>

              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    { backgroundColor: theme.search, color: theme.text },
                  ]}
                  placeholder="Confirm new password"
                  placeholderTextColor={theme.subText}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(p => !p)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.subText}
                  />
                </TouchableOpacity>
              </View>

              {confirmPassword.length > 0 && !passwordsMatch && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color="#ef4444"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: '#ef4444', fontSize: 13 }}>
                    Passwords do not match
                  </Text>
                </View>
              )}

              {passwordsMatch && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#22c55e"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: '#22c55e', fontSize: 13 }}>
                    Passwords match
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  !canSubmitPassword && styles.disabled,
                ]}
                disabled={!canSubmitPassword}
                onPress={resetPassword}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.btnText}>Continue</Text>
                }
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </View>
  );
}
