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
  const { theme } = useContext(ThemeContext);
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef([]);
  const [email, setEmail] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['','','','','','']);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/verify-password-reset-otp`, {
        otpId,
        code: otp.join(''),
      });
      setStep('reset');
    } catch (err) {
      toastError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword) return toastError('New password is required');

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

                      // Move to next input automatically
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

              <Text style={[styles.link, { color: theme.subText }]}>
                Didn’t receive OTP? Resend code.
              </Text>
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

              <TouchableOpacity
                style={styles.primaryBtn}
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
