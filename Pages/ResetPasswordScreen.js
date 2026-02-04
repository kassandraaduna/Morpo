import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import {toastError, toastSuccess} from './src/components/ToastMsg';

const API_URL = 'http://192.168.1.24:8000/api/auth';

export default function ResetPasswordScreen({ navigation }) {
  const [step, setStep] = useState('email'); // email | otp | reset
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['','','','','','']);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isOtpComplete = otp.every(d => d !== '');

  const requestOtp = async () => {
    if (!email) return alert('Email is required');

    try {
      setLoading(true);
      const res = await axios.post(
        `${API_URL}/request-password-reset-otp`,
        { email }
      );
      setOtpId(res.data.otpId);
      setStep('otp');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/verify-password-reset-otp`,
        {
          otpId,
          code: otp.join(''),
        }
      );
      setStep('reset');
    } catch (err) {
      alert(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword) return alert('New password is required');

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
      alert(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.shell}>

        {/* LOGO */}
        <Image
          source={require('../assets/mypholens_logo.png')}
          style={styles.logo}
        />

        {/* PINK CARD */}
        <View style={styles.card}>

          {step === 'email' && (
            <>
              <Text style={styles.title}>RESET PASSWORD</Text>
              <Text style={styles.subtitle}>Enter the email associated with youraccount and we will send you a 6-digit one-time pin to reset your password.</Text>

              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={requestOtp}>
                {loading
                  ? <ActivityIndicator />
                  : <Text style={styles.btnText}>Continue</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.title}>OTP</Text>
              <Text style={styles.subtitle}>Enter the 6-digit one-time pin sent to your email to reset your password.</Text>

              <View style={styles.otpRow}>
                {otp.map((d, i) => (
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
                style={[
                  styles.primaryBtn,
                  !isOtpComplete && styles.disabled,
                ]}
                disabled={!isOtpComplete}
                onPress={verifyOtp}
              >
                {loading
                  ? <ActivityIndicator />
                  : <Text style={styles.btnText}>Continue</Text>
                }
              </TouchableOpacity>

              <Text style={styles.link}>
                Didn’t receive OTP? Resend code.
              </Text>
            </>
          )}

          {step === 'reset' && (
            <>
              <Text style={styles.title}>ENTER NEW PASSWORD</Text>
              <Text style={styles.subtitle}>Enter the new password for your account.</Text>

              <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter new password"
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
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

              <TouchableOpacity style={styles.primaryBtn} onPress={resetPassword}>
                {loading
                  ? <ActivityIndicator />
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
