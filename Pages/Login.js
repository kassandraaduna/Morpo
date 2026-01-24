import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, useWindowDimensions, ScrollView, KeyboardAvoidingView, Modal, } from 'react-native';
import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.18:8000';

function Login({ navigation }) {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width, height) / 400;

  const [step, setStep] = useState('login');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ===== DISCLAIMER STATE =====
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  // ===== OTP STATE =====
  const [otpData, setOtpData] = useState({
    otp: '',
    otpId: '',
    maskedEmail: '',
    email: '',
    expiresAt: ''
  });

  // ===== LOGIN HANDLER =====
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        usernameOrEmail: email.trim(),
        password: password.trim(),
      });

      if (response.data?.mfaRequired) {
        setOtpData({
          otp: '',
          otpId: response.data.otpId,
          maskedEmail: response.data.maskedEmail,
          email: response.data.email,
          expiresAt: response.data.expiresAt
        });
        setStep('otp');
      } else {
        Alert.alert('Success', 'Login successful!');
        navigation.replace('Homepage');
      }
    } catch (error) {
      Alert.alert(
        'Login Error',
        error.response?.data?.message || 'Login failed'
      );
    } finally {
      setLoading(false);
    }
  };

  // ===== OTP VERIFY =====
  const handleVerifyOtp = async () => {
    if (!otpData.otp.trim()) {
      Alert.alert('Error', 'Please enter OTP');
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/verify-login-otp`,
        {
          otpId: otpData.otpId,
          code: otpData.otp
        }
      );

      Alert.alert('Success', 'Login successful!');
      navigation.replace('Homepage');
    } catch (error) {
      Alert.alert(
        'Verification Error',
        error.response?.data?.message || 'OTP verification failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);

    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/resend-login-otp`,
        { otpId: otpData.otpId }
      );
      Alert.alert('Success', 'OTP sent to ' + otpData.maskedEmail);
    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to resend OTP'
      );
    } finally {
      setLoading(false);
    }
  };

  const goBackToLogin = () => {
    setStep('login');
    setEmail('');
    setPassword('');
    setOtpData({
      otp: '',
      otpId: '',
      maskedEmail: '',
      email: '',
      expiresAt: ''
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* LOGO */}
        <View style={[styles.logoBox, { width: 80 * scale, height: 80 * scale }]}>
          <Text style={styles.logoText}>LOGO</Text>
        </View>

        {step === 'login' ? (
          <>
            <Text style={[styles.heading, { fontSize: 24 * scale }]}>SIGN IN</Text>
            <Text style={styles.subheading}>
              SIGN IN TO YOUR ACCOUNT TO GET STARTED.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity>
              <Text style={styles.forgotPassword}>FORGOT PASSWORD?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              style={styles.signInButton}
              disabled={loading}
            >
              <Text style={styles.signInButtonText}>
                {loading ? 'SIGNING IN...' : 'SIGN IN'}
              </Text>
            </TouchableOpacity>

            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>DON'T HAVE AN ACCOUNT YET? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.signUpLink}>SIGN UP HERE.</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heading}>VERIFY OTP</Text>
            <Text style={styles.subheading}>
              Enter the OTP sent to {otpData.maskedEmail}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              value={otpData.otp}
              onChangeText={(text) =>
                setOtpData({ ...otpData, otp: text })
              }
              keyboardType="number-pad"
            />

            <TouchableOpacity
              onPress={handleVerifyOtp}
              style={styles.signInButton}
            >
              <Text style={styles.signInButtonText}>VERIFY OTP</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleResendOtp}>
              <Text style={styles.signUpLink}>RESEND OTP</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={goBackToLogin}>
              <Text style={styles.signUpLink}>← BACK TO LOGIN</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ===== DISCLAIMER MODAL ===== */}
        <Modal visible={showDisclaimer} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>

              <Text style={styles.modalTitle}>DISCLAIMER</Text>

              <ScrollView style={{ maxHeight: 200 }}>
                <Text style={styles.modalText}>
                  This application is intended to be an aid for learning only and
                  is not designed for clinical diagnosis or medical decision-making,
                  nor intended to replace traditional classroom and laboratory
                  learning practices.
                </Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setDisclaimerChecked(!disclaimerChecked)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    disclaimerChecked && styles.checkboxChecked
                  ]}
                />
                <Text style={styles.checkboxText}>
                  I understand and agree
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={!disclaimerChecked}
                onPress={() => {
                  setShowDisclaimer(false);
                  setDisclaimerChecked(false);
                }}
                style={[
                  styles.continueButton,
                  { opacity: disclaimerChecked ? 1 : 0.5 }
                ]}
              >
                <Text style={styles.continueText}>CONTINUE</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { alignItems: 'center', padding: 20 },
  logoBox: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: { fontWeight: 'bold' },
  heading: { fontWeight: 'bold', fontSize: 22, marginTop: 10 },
  subheading: { color: '#666', marginBottom: 20, textAlign: 'center' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 15,
  },
  forgotPassword: {
    color: '#007AFF',
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  signInButton: {
    width: '100%',
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  signInButtonText: { fontWeight: '600' },
  signUpContainer: {
    flexDirection: 'row',
    marginTop: 30,
  },
  signUpText: { color: '#666' },
  signUpLink: { color: '#007AFF', fontWeight: '600' },

  // ===== MODAL STYLES =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 12,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#000',
  },
  checkboxText: {
    fontSize: 12,
  },
  continueButton: {
    marginTop: 20,
    borderWidth: 1,
    padding: 10,
    borderRadius: 6,
  },
  continueText: {
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default Login;
