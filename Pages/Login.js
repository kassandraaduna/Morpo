import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Image,} from 'react-native';
import { login, verifyLoginOtp, resendLoginOtp } from './src/services/authService';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import {toastError, toastSuccess} from './src/components/ToastMsg';

export default function Login({ navigation }) {
  const [step, setStep] = useState('login');
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpId, setOtpId] = useState('');
  const [emailForOtp, setEmailForOtp] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isOtpComplete = otp.every(d => d !== '');

  useEffect(() => {
    (async () => {
      const accepted = await AsyncStorage.getItem('disclaimerAccepted');
      if (!accepted) setShowDisclaimer(true);
    })();
  }, []);

  const handleLogin = async () => {
    const usernameOrEmail = String(form.usernameOrEmail || '').trim();
    const password = String(form.password || '');

    if (!usernameOrEmail || !password) {
      toastError('Please fill in all fieds.');
      return;
    }
  
    try {
      console.log('LOGIN PAYLOAD', {
        usernameOrEmail,
        password,
      });
      
      const res = await login({ usernameOrEmail, password });
  
      // MFA flow
      if (res.data?.mfaRequired) {
        setOtpId(res.data.otpId);
        setEmailForOtp(res.data.email);
        setStep('otp');
        return;
      }
  
      const user = res.data?.data?.user;
      if (!user) throw new Error('User missing');
  
      await AsyncStorage.setItem('user', JSON.stringify(user));
      navigation.replace('MainTabs');
  
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;

      if (status === 403 && msg?.toLowerCase().includes('Too many login attempts')) {
        toastError('Account is deactivated. Please contact admin.');
        return;
      }
      if (status === 401) {
        toastError('Incorrect username or password.');
        return;
      }
      if (status === 404) {
        toastError('Account does not exist.');
        return;
      }
      toastError(msg || 'Network error');
    }
    
  };

  const handleOtp = async () => {
    try {
      const code = otp.join('');
  
      const res = await verifyLoginOtp({
        otpId,
        code,
      });
  
      const user = res.data?.data?.user;
      if (!user) throw new Error('User data missing after OTP');
  
      await AsyncStorage.setItem('user', JSON.stringify(user));
      routeAfterLogin(user);
  
    } catch (e) {
      Alert.alert(
        'Invalid OTP',
        e.response?.data?.message || 'OTP verification failed'
      );
    }
  };

  const routeAfterLogin = (user) => {
    if (user.mustChangePassword) {
      navigation.replace('ResetPassword');
      return;
    }
  
    if ((user.role || '').toLowerCase() === 'instructor') {
      navigation.replace('InstructorHomepage');
      return;
    }
  
    toastSuccess('Login successful');
    navigation.replace('MainTabs');
  };  

  return (
    <View style={styles.screen}>
      <View style={styles.shell}>

        <Image source={require('../assets/mypholens_logo.png')} style={styles.logo} />

        <View style={styles.card}>

          {step === 'login' && (
            <>
              <Text style={styles.title}>SIGN IN</Text>
              <Text style={styles.subtitle}>
                Sign in to your account to get started.
              </Text>

              <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your username/email"
                  autoCapitalize="none"
                  onChangeText={v =>
                    setForm({ ...form, usernameOrEmail: v })
                  }
                />

              <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    onChangeText={v =>
                      setForm({ ...form, password: v })
                    }
                  />

                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(prev => !prev)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#777"
                    />
                  </TouchableOpacity>
                </View>

              <TouchableOpacity
                style={styles.forgotWrapper}
                onPress={() => navigation.navigate('ResetPassword')}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
                <Text style={styles.btnText}>Sign in</Text>
              </TouchableOpacity>

            <View style={styles.bottomLink}>
              <Text style={styles.link}>
                  Don't have an account yet?
                  <Text
                    style={[
                      styles.link,
                      { fontWeight: '700', 
                        opacity: pressed ? 0.5 : 1 }, 
                        pressed && { textDecorationLine: 'underline' }
                    ]}
                    onPress={() => navigation.navigate('Register')}
                    onPressIn={() => setPressed(true)}
                    onPressOut={() => setPressed(false)}
                  >
                    {' '}Sign up here
                  </Text>
                </Text>
              </View>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.title}>OTP</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit one-time pin sent to your email
              </Text>

              <View style={styles.otpRow}>
                {otp.map((_, i) => (
                  <TextInput
                    key={i}
                    style={styles.otpBox}
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
                style={[styles.primaryBtn, !isOtpComplete && styles.disabled]}
                disabled={!isOtpComplete}
                onPress={handleOtp}
              >
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>

              <Text
                style={styles.link}
                onPress={() => resendLoginOtp(emailForOtp)}
              >
                Didn’t receive OTP? Resend code.
              </Text>
            </>
          )}

          {showDisclaimer && (
            <View style={styles.overlay}>
              <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />

              <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerTitle}>DISCLAIMER</Text>
                <Text style={styles.disclaimerText}>
                  THIS APPLICATION IS INTENDED FOR EDUCATIONAL PURPOSES ONLY AND IS
                  NOT DESIGNED FOR CLINICAL DIAGNOSIS OR MEDICAL DECISION-MAKING.
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
