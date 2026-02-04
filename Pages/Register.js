import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Image, ScrollView, Alert,} from 'react-native';
import { requestRegisterOtp, verifyRegisterOtp } from './src/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import {toastError, toastSuccess} from './src/components/ToastMsg';

export default function Register({ navigation }) {
  const [form, setForm] = useState({});
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['','','','','','']);
  const [step, setStep] = useState('form');
  const [showPassword, setShowPassword] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isOtpComplete = otp.every(d => d !== '');

  const validate = () => {
    const required = [
      'fname','lname','dob','gender',
      'number','email','username','password'
    ];
    return required.every(k => form[k]);  
  };

  const passwordRules = {
    length: v => v.length >= 8,
    uppercase: v => /[A-Z]/.test(v),
    number: v => /\d/.test(v),
    special: v => /[!@#$%^&*]/.test(v),
  };    

  const passwordStatus = {
    length: passwordRules.length(password),
    uppercase: passwordRules.uppercase(password),
    number: passwordRules.number(password),
    special: passwordRules.special(password),
  };  

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const submitForm = async () => {
    if (!validate()) {
      return Alert.alert('Error', 'Please fill in all fields');
    }
  
    try {
      const res = await requestRegisterOtp(form.email);
      setOtpId(res.data.otpId);
      setStep('otp');
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.message || 'Failed to send OTP'
      );
    }
  };

  const verifyOtp = async () => {
    try {
      const code = otp.join('');

      await verifyRegisterOtp({
        otpId,
        code,
        medData: form,
      });

      toastSuccess('Account created successfully');
      navigation.replace('Login');      

    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.message || 'OTP verification failed'
      );
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

          {step === 'form' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>SIGN UP</Text>
              <Text style={styles.subtitle}>Create an account to get started.</Text>

              <Text style={styles.label}>First Name</Text>
              <TextInput style={styles.input}
                placeholder="Enter your first name"
                onChangeText={v => setForm({ ...form, fname: v })}
              />

              <Text style={styles.label}>Last Name</Text>
              <TextInput style={styles.input}
                placeholder="Enter your last name"
                onChangeText={v => setForm({ ...form, lname: v })}
              />

              <Text style={styles.label}>Date of Birth</Text>
              <TextInput style={styles.input}
                placeholder="MM/DD/YYYY"
                onChangeText={v => setForm({ ...form, dob: v })}
              />

              <Text style={styles.label}>Gender</Text>
              <TextInput style={styles.input}
                placeholder="Select gender"
                onChangeText={v => setForm({ ...form, gender: v })}
              />

              <Text style={styles.label}>Mobile Number</Text>
              <TextInput style={styles.input}
                placeholder="Enter 11-digit mobile number"
                keyboardType="phone-pad"
                onChangeText={v => setForm({ ...form, number: v })}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={v => setForm({ ...form, email: v })}
              />

              <Text style={styles.label}>Username</Text>
              <TextInput style={styles.input}
                placeholder="Enter a username"
                onChangeText={v => setForm({ ...form, username: v })}
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
                  {Object.entries({
                    'At least 8 characters': passwordStatus.length,
                    'One capital letter': passwordStatus.uppercase,
                    'One number': passwordStatus.number,
                    'One special character (!@#$%^&*)': passwordStatus.special,
                  }).map(([label, ok]) => (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10, marginTop: 5 }}>
                      <Ionicons
                        name={ok ? 'checkmark-circle' : 'close-circle'}
                        color={ok ? '#2ecc71' : '#e74c3c'}
                        size={16}
                      />
                      <Text style={{ marginLeft: 6, color: ok ? '#2ecc71' : '#e74c3c' }}>
                        {label}
                      </Text>
                    </View>
                  ))}

              <Text style={styles.label}>Confirm Password</Text>
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
                {confirmPassword.length > 0 && (
                  <Text style={{ color: passwordsMatch ? '#2ecc71' : '#e74c3c' }}>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </Text>
                )}

                <Text style={styles.terms}>
                  By signing up, you agree to our
                  <Text
                    style={[
                      styles.terms,
                      { fontWeight: '700', 
                        opacity: pressed ? 0.5 : 1 }, 
                        pressed && { textDecorationLine: 'underline' }
                    ]}
                    //onPress={() => navigation.navigate('Login')}
                    onPressIn={() => setPressed(true)}
                    onPressOut={() => setPressed(false)}
                  >
                    {' '}Terms and Conditions
                  </Text>
                  {' '}and
                  <Text
                    style={[
                      styles.terms,
                      { fontWeight: '700', 
                        opacity: pressed ? 0.5 : 1 }, 
                        pressed && { textDecorationLine: 'underline' }
                    ]}
                    //onPress={() => navigation.navigate('Login')}
                    onPressIn={() => setPressed(true)}
                    onPressOut={() => setPressed(false)}
                  >
                    {' '}Privacy Policy
                  </Text>
                </Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={submitForm}>
                <Text style={styles.btnText}>Sign Up</Text>
              </TouchableOpacity>

              <View style={styles.bottomLink}>
              <Text style={styles.link}>
                  Already have an account?
                  <Text
                    style={[
                      styles.link,
                      { fontWeight: '700', 
                        opacity: pressed ? 0.5 : 1 }, 
                        pressed && { textDecorationLine: 'underline' }
                    ]}
                    onPress={() => navigation.navigate('Login')}
                    onPressIn={() => setPressed(true)}
                    onPressOut={() => setPressed(false)}
                  >
                    {' '}Sign in here
                  </Text>
                </Text>
              </View>

            </ScrollView>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.title}>OTP</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit one-time pin sent to your email
              </Text>

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
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>

              <Text style={styles.link}>
                Didn’t receive OTP? Resend code.
              </Text>
            </>
          )}

        </View>
      </View>
    </View>
  );
}
