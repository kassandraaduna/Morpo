import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

import styles from './src/styles/Styles';
import { login, verifyLoginOtp, resendLoginOtp } from './src/services/authService';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';

export default function Login({ navigation }) {
  const [step, setStep] = useState('login');
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpId, setOtpId] = useState('');
  const [emailForOtp, setEmailForOtp] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pressed, setPressed] = useState(false);

  const { theme, darkMode } = useContext(ThemeContext);

  const isOtpComplete = otp.every(d => d !== '');

  /* ============ DISCLAIMER CHECK ============ */
  useEffect(() => {
    (async () => {
      const accepted = await AsyncStorage.getItem('disclaimerAccepted');
      if (!accepted) setShowDisclaimer(true);
    })();
  }, []);

  /* ============ LOGIN ============ */
  const handleLogin = async () => {
    const usernameOrEmail = String(form.usernameOrEmail || '').trim();
    const password = String(form.password || '');

    if (!usernameOrEmail || !password) {
      toastError('Please fill in all fields.');
      return;
    }

    try {
      const res = await login({ usernameOrEmail, password });

      if (res.data?.mfaRequired) {
        setOtpId(res.data.otpId);
        setEmailForOtp(res.data.email);
        setStep('otp');
        return;
      }

      const user = res.data?.data?.user;
      if (!user) throw new Error('User missing');

      await AsyncStorage.setItem('user', JSON.stringify(user));
      toastSuccess('Login successful');

      if ((user.role || '').toLowerCase() === 'instructor') {
        navigation.replace('InstructorBottomTab');
      } else {
        navigation.replace('StudentBottomTab');
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;

      if (status === 403) return toastError('Account is deactivated.');
      if (status === 401) return toastError('Incorrect credentials.');
      if (status === 404) return toastError('Account not found.');

      toastError(msg || 'Network error');
    }
  };

  /* ============ OTP ============ */
  const handleOtp = async () => {
    try {
      const code = otp.join('');
      const res = await verifyLoginOtp({ otpId, code });

      const user = res.data?.data?.user;
      if (!user) throw new Error('User missing');

      await AsyncStorage.setItem('user', JSON.stringify(user));

      if ((user.role || '').toLowerCase() === 'instructor') {
        navigation.replace('InstructorBottomTab');
      } else {
        navigation.replace('StudentBottomTab');
      }
    } catch (e) {
      toastError('Invalid OTP');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.shell}>
        <Image
          source={require('../assets/mypholens_logo.png')}
          style={styles.logo}
        />

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card },
          ]}
        >
          {/* LOGIN */}
          {step === 'login' && (
            <>
              <Text style={[styles.title, { color: theme.text }]}>
                SIGN IN
              </Text>

              <Text style={[styles.subtitle, { color: theme.subText }]}>
                Sign in to your account to get started.
              </Text>

              <Text style={[styles.label, { color: theme.subText }]}>
                Username/Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text },
                ]}
                placeholder="Enter your username/email"
                placeholderTextColor={theme.subText}
                autoCapitalize="none"
                onChangeText={v =>
                  setForm({ ...form, usernameOrEmail: v })
                }
              />

              <Text style={[styles.label, { color: theme.subText }]}>
                Password
              </Text>
              <View
                style={[
                  styles.passwordWrapper,
                  { backgroundColor: theme.card },
                ]}
              >
                <TextInput
                  style={[
                    styles.passwordInput,
                    { color: theme.text },
                  ]}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.subText}
                  secureTextEntry={!showPassword}
                  onChangeText={v =>
                    setForm({ ...form, password: v })
                  }
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
                style={styles.forgotWrapper}
                onPress={() => navigation.navigate('ResetPassword')}
              >
                <Text
                  style={[
                    styles.forgotText,
                    { color: theme.subText },
                  ]}
                >
                  Forgot password?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleLogin}
              >
                <Text style={styles.btnText}>Sign in</Text>
              </TouchableOpacity>

              <View style={styles.bottomLink}>
                <Text style={[styles.link, { color: theme.subText }]}>
                  Don’t have an account yet?
                  <Text
                    style={[
                      styles.link,
                      { fontWeight: '700', color: theme.subText },
                    ]}
                    onPress={() => navigation.navigate('Register')}
                  >
                    {' '}Sign up here
                  </Text>
                </Text>
              </View>
            </>
          )}

          {/* OTP */}
          {step === 'otp' && (
            <>
              <Text style={[styles.title, { color: theme.text }]}>
                OTP
              </Text>

              <Text style={[styles.subtitle, { color: theme.subText }]}>
                Enter the 6-digit code sent to your email
              </Text>

              <View style={styles.otpRow}>
                {otp.map((_, i) => (
                  <TextInput
                    key={i}
                    style={[
                      styles.otpBox,
                      { color: theme.text, borderColor: theme.subText },
                    ]}
                    maxLength={1}
                    keyboardType="numeric"
                    onChangeText={v => {
                      const copy = [...otp];
                      copy[i] = v;
                      setOtp(copy);
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
                onPress={handleOtp}
              >
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>

              <Text
                style={[styles.link, { color: theme.subText }]}
                onPress={() => resendLoginOtp(emailForOtp)}
              >
                Didn’t receive OTP? Resend code.
              </Text>
            </>
          )}

          {/* DISCLAIMER */}
          {showDisclaimer && (
            <View style={styles.overlay}>
              <BlurView
                intensity={70}
                tint={darkMode ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />

              <View
                style={[
                  styles.disclaimerCard,
                  { backgroundColor: theme.card },
                ]}
              >
                <Text
                  style={[
                    styles.disclaimerTitle,
                    { color: theme.text },
                  ]}
                >
                  DISCLAIMER
                </Text>

                <Text
                  style={[
                    styles.disclaimerText,
                    { color: theme.subText },
                  ]}
                >
                  THIS APPLICATION IS FOR EDUCATIONAL PURPOSES ONLY AND
                  IS NOT INTENDED FOR MEDICAL DIAGNOSIS.
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
        </View>
      </View>
    </View>
  );
}
