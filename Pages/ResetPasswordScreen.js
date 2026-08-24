import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Dimensions, StatusBar,} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../Pages/src/context/ThemeContext';
import { toastError, toastSuccess } from '../Pages/src/components/ToastMsg';
import api from '../Pages/src/services/api';

const { width } = Dimensions.get('window');
const RESEND_SECONDS = 60;

export default function ResetPasswordScreen({ navigation }) {
  const { theme } = useContext(ThemeContext);

  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');

  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const otpRefs = useRef([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [activeField, setActiveField] = useState(null);

  const passwordRules = {
    length: (pass) => pass.length >= 8,
    upper: (pass) => /[A-Z]/.test(pass),
    number: (pass) => /\d/.test(pass),
    special: (pass) => /[!@#$%^&*]/.test(pass),
  };

  const passwordChecks = {
    length: passwordRules.length(newPassword),
    upper: passwordRules.upper(newPassword),
    number: passwordRules.number(newPassword),
    special: passwordRules.special(newPassword),
  };

  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  useEffect(() => {
    if (!canResend && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (resendTimer === 0) setCanResend(true);
  }, [resendTimer, canResend]);

  useEffect(() => {
    if (step === 'otp') {
      const timeout = setTimeout(() => otpRefs.current[0]?.focus(), 300);
      return () => clearTimeout(timeout);
    }
  }, [step]);

  const handleEmailChange = (val) => {
    setEmail(val);
    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
  };

  const handleNewPasswordChange = (val) => {
    setNewPassword(val);
    const isPassValid = passwordRules.length(val) && passwordRules.upper(val) && passwordRules.number(val) && passwordRules.special(val);
    if (errors.newPassword && isPassValid) {
        setErrors((prev) => ({ ...prev, newPassword: null }));
    }
    if (confirmPassword.length > 0) {
        setErrors((prev) => ({
            ...prev,
            confirmPassword: val !== confirmPassword ? 'Passwords do not match.' : null
        }));
    }
  };

  const handleConfirmPasswordChange = (val) => {
    setConfirmPassword(val);
    setErrors((prev) => ({
        ...prev,
        confirmPassword: val !== newPassword ? 'Passwords do not match.' : null
    }));
  };

  const requestOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrors({ email: 'Please enter your username or email.' });
      return;
    }
    setErrors({});
    setLoading(true);
    
    try {
      const res = await api.post('/auth/request-password-reset-otp', {
        email: normalizedEmail,
      });

      if (res.data?.otpId) {
        setOtpId(res.data.otpId);
      }
      toastSuccess('A 6-digit verification code has been sent.');
      setStep('otp');
      setResendTimer(RESEND_SECONDS);
      setCanResend(false);
    } catch (error) {
      console.error('Request OTP Error:', error?.response?.data || error.message);
      const serverMsg = error?.response?.data?.message;
      toastError(serverMsg || 'Could not find a registered account with that email.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const codeStr = otp.join('').trim();
    if (codeStr.length < 6) {
      toastError('Please enter the full 6-digit OTP.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    const VERIFY_ENDPOINTS = [
      {
        url: '/auth/verify-password-reset-otp',
        payload: { email: normalizedEmail, code: codeStr, otp: codeStr, otpId },
      },
      {
        url: '/auth/verify-reset-otp',
        payload: { email: normalizedEmail, code: codeStr, otp: codeStr, otpId },
      },
      {
        url: '/auth/verify-email-otp',
        payload: { email: normalizedEmail, code: codeStr, otp: codeStr, purpose: 'reset-password', otpId },
      },
    ];

    let isSuccess = false;
    let serverErrorMessage = null;

    for (const endpoint of VERIFY_ENDPOINTS) {
      try {
        const res = await api.post(endpoint.url, endpoint.payload);
        if (res.status === 200 || res.status === 201) {
          isSuccess = true;
          break;
        }
      } catch (error) {
        const status = error?.response?.status;
        const msg = error?.response?.data?.message;
        if (status && status !== 404) {
          serverErrorMessage = msg || 'Invalid verification code.';
          break;
        }
      }
    }

    setLoading(false);

    if (isSuccess) {
      setOtpVerified(true);
      toastSuccess('OTP verified! Please create your new password.');
      setStep('password');
    } else {
      toastError(
        serverErrorMessage || 'Invalid verification code. Please check your email and try again.'
      );
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      const res = await api.post('/auth/resend-password-reset-otp', {
        email: normalizedEmail,
      });
      if (res.data?.otpId) setOtpId(res.data.otpId);
      toastSuccess('A new verification code has been sent.');
      setResendTimer(RESEND_SECONDS);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (error) {
      toastError(error?.response?.data?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!otpVerified) {
      toastError('OTP has not been verified.');
      return;
    }

    const newErrors = {};
    if (!isPasswordValid) newErrors.newPassword = 'Please ensure all password requirements are met.';
    if (confirmPassword.length === 0 || !passwordsMatch) newErrors.confirmPassword = 'Passwords do not match.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const normalizedEmail = email.trim().toLowerCase();
    const codeStr = otp.join('').trim();
    setLoading(true);

    try {
      await api.post('/auth/verify-password-reset-otp', {
        email: normalizedEmail,
        otpId,
        code: codeStr,
        otp: codeStr,
        newPassword,
        password: newPassword,
      });

      toastSuccess('Password reset successfully! Please sign in.');
      navigation.replace('Login');
    } catch (error) {
      console.error('Reset Password Error:', error?.response?.data || error.message);
      toastError(
        error?.response?.data?.message ||
          'Could not reset password. Please verify your OTP and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

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

  const handleBackPress = () => {
    if (step === 'password') {
      setStep('otp');
    } else if (step === 'otp') {
      setStep('email');
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[localStyles.container, { backgroundColor: theme.bg || '#F8F9FA' }]}
    >
      <View style={[localStyles.headerWrapper, { backgroundColor: theme.bg || '#F8F9FA' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" />
        <View style={localStyles.headerContainer}>
          <TouchableOpacity
            style={localStyles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={localStyles.heading}>
            {step === 'email'
              ? 'Reset Password'
              : step === 'otp'
              ? 'Verify OTP'
              : 'Create New Password'}
          </Text>
          <Text style={localStyles.subHeading}>
            {step === 'email'
              ? 'Enter the email associated with your account and we will send you a 6-digit one-time pin to reset your password.'
              : step === 'otp'
              ? 'Enter the 6-digit one-time pin sent to your email to reset your password.'
              : 'Enter your new password below. Make sure it meets all security requirements.'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={localStyles.formContainer}>
          {step === 'email' && (
            <View style={{ width: '100%' }}>
              <Text style={localStyles.label}>Email</Text>
              <View style={[
                  localStyles.inputWrapper,
                  errors.email && localStyles.inputError,
                  activeField === 'email' && localStyles.inputActive
              ]}>
                <TextInput
                  style={localStyles.input}
                  placeholder="Enter your registered email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={handleEmailChange}
                  onFocus={() => setActiveField('email')}
                  onBlur={() => setActiveField(null)}
                />
              </View>
              {errors.email ? <Text style={localStyles.errorText}>{errors.email}</Text> : null}

              <TouchableOpacity
                style={localStyles.primaryBtn}
                onPress={requestOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={localStyles.primaryBtnText}>Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={localStyles.footerLinkWrapper}
                onPress={() => navigation.replace('Login')}
              >
                <Text style={localStyles.footerLinkText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'otp' && (
            <View style={{ width: '100%' }}>
              <View style={localStyles.otpContainer}>
                {otp.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    style={[
                      localStyles.otpBox,
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
                onPress={verifyOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={localStyles.primaryBtnText}>Verify</Text>
                )}
              </TouchableOpacity>

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

              <TouchableOpacity
                style={localStyles.tryAnotherBtn}
                onPress={() => setStep('email')}
              >
                <Text style={localStyles.tryAnotherText}>Try another email</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'password' && (
            <View style={{ width: '100%' }}>
              <Text style={localStyles.label}>New Password</Text>
              <View style={[
                  localStyles.inputWrapper,
                  errors.newPassword && localStyles.inputError,
                  activeField === 'newPassword' && localStyles.inputActive
              ]}>
                <TextInput
                  style={[localStyles.input, { flex: 1 }]}
                  placeholder="Enter your new password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={handleNewPasswordChange}
                  onFocus={() => setActiveField('newPassword')}
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
              {errors.newPassword ? <Text style={localStyles.errorText}>{errors.newPassword}</Text> : null}

              <Text style={localStyles.label}>Confirm Password</Text>
              <View style={[
                  localStyles.inputWrapper,
                  errors.confirmPassword && localStyles.inputError,
                  activeField === 'confirmPassword' && localStyles.inputActive
              ]}>
                <TextInput
                  style={[localStyles.input, { flex: 1 }]}
                  placeholder="Confirm your new password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
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
              {errors.confirmPassword ? <Text style={localStyles.errorText}>{errors.confirmPassword}</Text> : null}

              <View style={localStyles.checklistContainer}>
                <View style={localStyles.checklistRow}>
                  <Ionicons name={passwordChecks.length ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordChecks.length ? '#10B981' : '#94A3B8'} />
                  <Text style={localStyles.checklistText}>At least 8 characters long</Text>
                </View>
                <View style={localStyles.checklistRow}>
                  <Ionicons name={passwordChecks.upper ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordChecks.upper ? '#10B981' : '#94A3B8'} />
                  <Text style={localStyles.checklistText}>One uppercase letter (A-Z)</Text>
                </View>
                <View style={localStyles.checklistRow}>
                  <Ionicons name={passwordChecks.number ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordChecks.number ? '#10B981' : '#94A3B8'} />
                  <Text style={localStyles.checklistText}>At least one number (0-9)</Text>
                </View>
                <View style={localStyles.checklistRow}>
                  <Ionicons name={passwordChecks.special ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={passwordChecks.special ? '#10B981' : '#94A3B8'} />
                  <Text style={localStyles.checklistText}>One special character (!@#$%^&*)</Text>
                </View>
              </View>

              <TouchableOpacity
                style={localStyles.primaryBtn}
                onPress={resetPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={localStyles.primaryBtnText}>Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={localStyles.footerLinkWrapper}
                onPress={() => navigation.replace('Login')}
              >
                <Text style={localStyles.footerLinkText}>Back to Login</Text>
              </TouchableOpacity>
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
  headerWrapper: {
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
  },
  headerContainer: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 60,
    paddingBottom: 16,
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
    alignItems: 'center', 
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  formContainer: {
    width: '100%',
    maxWidth: 520, 
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
    marginTop: 2,
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
  footerLinkWrapper: {
    alignSelf: 'center',
    marginTop: 28,
  },
  footerLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 12,
    marginBottom: 24,
  },
  otpBox: {
    width: Math.min((Math.min(width, 520) - 48 - 40) / 6, 60),
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
  tryAnotherBtn: {
    alignSelf: 'center',
    marginTop: 18,
  },
  tryAnotherText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  checklistContainer: {
    marginBottom: 16,
    marginTop: 5,
    paddingHorizontal: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checklistText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginLeft: 8,
  },
});