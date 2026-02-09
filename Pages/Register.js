import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Image, ScrollView, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import {toastError, toastSuccess} from './src/components/ToastMsg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { requestRegisterOtp, verifyRegisterOtp, checkUsername, checkEmail, checkNumber } from './src/services/authService';

export default function Register({ navigation }) {
  const [form, setForm] = useState({});
  const [otpId, setOtpId] = useState('');
  const [otp, setOtp] = useState(['','','','','','']);
  const [step, setStep] = useState('form');
  const [showPassword, setShowPassword] = useState(false);
  const [pressed, setPressed] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [dobDate, setDobDate] = useState(null);
  const [available, setAvailable] = useState({
    username: null,
    email: null,
    number: null,
  });

  const RESEND_SECONDS = 60;
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  const isOtpComplete = otp.every(d => d !== '');

  const otpRefs = useRef([]);

  const validate = () => {
    const required = [
      'fname','lname','dob','gender',
      'number','email','username','password'
    ];
    return required.every(k => form[k]);  
  };

  const validators = {
    fname: v => v?.trim().length > 0,
    lname: v => v?.trim().length > 0,
    dob: v => /^\d{2}\/\d{2}\/\d{4}$/.test(v || ''),
    gender: v => v?.trim().length > 0,
    number: v => /^\d{11}$/.test(v || ''),
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ''),
    username: v => v?.trim().length >= 4,
  };

  const checkAvailability = async (type, value) => {
    setAvailable(prev => ({ ...prev, [type]: null })); // checking
    try {
      let res;

      if (type === 'username') res = await checkUsername(value);
      if (type === 'email') res = await checkEmail(value);
      if (type === 'number') res = await checkNumber(value);

      const isAvailable =
        res?.data?.available ??
        res?.data?.isAvailable ??
        res?.data?.exists === false;

      setAvailable(prev => ({
        ...prev,
        [type]: Boolean(isAvailable),
      }));
    } catch (err) {
    console.log('[number availability error]', err?.response?.data);

    setAvailable(prev => ({
      ...prev,
      [type]: null,
    }));
  }
  };

  const fieldStatus = {
    fname: validators.fname(form.fname),
    lname: validators.lname(form.lname),
    dob: validators.dob(form.dob),
    gender: validators.gender(form.gender),
    number: validators.number(form.number),
    email: validators.email(form.email),
    username: validators.username(form.username),
  };

  const FieldFeedback = ({ ok, errorLabel, successLabel }) => {
    if (ok === undefined) return null;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Ionicons
          name={ok ? 'checkmark-circle' : 'close-circle'}
          size={14}
          color={ok ? '#2ecc71' : '#e74c3c'}
          style={{ marginRight: 6 }}
        />
        <Text
          style={{
            color: ok ? '#2ecc71' : '#e74c3c',
            fontSize: 12,
          }}
        >
          {ok ? successLabel : errorLabel}
        </Text>
      </View>
    );
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

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const isPasswordValid = Object.values(passwordStatus).every(Boolean);

  const canSubmit = validate() && isPasswordValid && passwordsMatch && available.username === true &&available.email === true && available.number === true;

  const submitForm = async () => {
    if (!validate()) return toastError('Please fill in all fields');
    if (!isPasswordValid) return toastError('Password does not meet requirements');
    if (!passwordsMatch) return toastError('Passwords do not match');

    try {
      const res = await requestRegisterOtp(form.email);
      setOtpId(res.data.otpId);
      setStep('otp');

      setResendTimer(RESEND_SECONDS);
      setCanResend(false);
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to send OTP');
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
    <View style={styles.screen}>
      <View style={styles.shell}>

        <Image
          source={require('../assets/mypholens_logo.png')}
          style={styles.logo}
        />

        <View style={styles.card}>

          {step === 'form' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>SIGN UP</Text>
              <Text style={styles.subtitle}>Create an account to get started.</Text>

              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                value={form.fname || ''}
                onChangeText={v => setForm({ ...form, fname: v })}
              />
              {form.fname !== undefined && (
                <FieldFeedback
                  ok={fieldStatus.fname}
                  label="First name cannot be empty"
                  successLabel="First name looks good"
                />
              )}

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                value={form.lname || ''}
                onChangeText={v => setForm({ ...form, lname: v })}
              />
              {form.lname !== undefined && (
                <FieldFeedback
                  ok={fieldStatus.lname}
                  errorLabel="Last name cannot be empty"
                  successLabel="Last name looks good"
                />
              )}

              <Text style={styles.label}>Date of Birth</Text>
                <View
                  style={[
                    styles.input,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    },
                  ]}
                >
                  <Text style={{ color: form.dob ? '#000' : '#999', }}>
                    {form.dob || 'MM/DD/YYYY'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDobPicker(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#777"
                    />
                  </TouchableOpacity>
                </View>
                {showDobPicker && (
                  <DateTimePicker
                    value={dobDate || new Date(2005, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowDobPicker(false);

                      if (selectedDate) {
                        setDobDate(selectedDate);

                        const formatted = selectedDate.toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: 'numeric',
                        });

                        setForm({ ...form, dob: formatted });
                      }
                    }}
                  />
                )}
                {form.dob !== undefined && (
                  <FieldFeedback
                    ok={fieldStatus.dob}
                    errorLabel="Date of birth is required"
                    successLabel="Date selected"
                  />
                )}

              <Text style={styles.label}>Gender</Text>
              <View
                style={[
                  styles.input,
                  { paddingHorizontal: 0, justifyContent: 'center' },
                ]}
              >
                <Picker
                  selectedValue={form.gender ?? ''}
                  onValueChange={v => setForm({ ...form, gender: v })}
                >
                  <Picker.Item
                    label="Select gender"
                    value=""
                    enabled={false}
                    color="#999"
                  />
                  <Picker.Item label="Male" value="Male" />
                  <Picker.Item label="Female" value="Female" />
                  <Picker.Item label="Prefer not to say" value="Prefer not to say" />
                </Picker>
              </View>
              {form.gender !== undefined && (
                <FieldFeedback
                  ok={fieldStatus.gender}
                  errorLabel="Please select a gender"
                  successLabel="Gender selected"
                />
              )}

              <Text style={styles.label}>Mobile Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 11-digit mobile number (e.g. 09171234567)"
                keyboardType="phone-pad"
                value={form.number || ''}
                onChangeText={v => {
                  setForm({ ...form, number: v });
                  if (validators.number(v)) {
                    checkAvailability('number', v);
                  } else {
                    setAvailable(prev => ({ ...prev, number: null }));
                  }
                }}
              />
              {form.number !== undefined && (
                <FieldFeedback
                  ok={fieldStatus.number && available.number === true}
                  errorLabel={
                    !fieldStatus.number
                      ? 'Mobile number must be exactly 11 digits'
                      : available.number === false
                      ? 'Mobile number already registered'
                      : 'Checking mobile number...'
                  }
                  successLabel="Mobile number is available"
                />
              )}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email || ''}
                onChangeText={v => {
                  setForm({ ...form, email: v });
                  if (validators.email(v)) {
                    checkAvailability('email', v);
                  } else {
                    setAvailable(prev => ({ ...prev, email: null }));
                  }
                }}
              />
              {form.email !== undefined && (
                <FieldFeedback
                  ok={fieldStatus.email && available.email === true}
                  errorLabel={
                    !fieldStatus.email
                      ? 'Invalid email format'
                      : available.email === false
                      ? 'Email already registered'
                      : 'Checking email...'
                  }
                  successLabel="Email is available"
                />
              )}

              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter a username"
                value={form.username || ''}
                onChangeText={v => {
                  setForm({ ...form, username: v });
                  if (validators.username(v)) {
                    checkAvailability('username', v);
                  } else {
                    setAvailable(prev => ({ ...prev, username: null }));
                  }
                }}
              />
              {form.username !== undefined && (
                <FieldFeedback
                  ok={fieldStatus.username && available.username === true}
                  errorLabel={
                    !fieldStatus.username
                      ? 'Username must be at least 4 characters'
                      : available.username === false
                      ? 'Username already taken'
                      : 'Checking username...'
                  }
                  successLabel="Username is available"
                />
              )}

              <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={v => {
                      setPassword(v);
                      setForm({ ...form, password: v });
                    }}
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
                    placeholder="Confirm your password"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10, marginTop: 6 }}>
                    <Ionicons
                      name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                      color={passwordsMatch ? '#2ecc71' : '#e74c3c'}
                      size={16}
                    />
                    <Text style={{ marginLeft: 6, color: passwordsMatch ? '#2ecc71' : '#e74c3c' }}>
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
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

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  !canSubmit && styles.disabled,
                ]}
                disabled={!canSubmit}
                onPress={submitForm}
              >
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
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={ref => (otpRefs.current[i] = ref)}
                    style={styles.otpBox}
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
                      if (v && i === otp.length - 1) {
                        setTimeout(() => {
                          if (copy.every(d => d !== '')) {
                            verifyOtp();
                          }
                        }, 150);
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
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={!canResend}
                onPress={async () => {
                  try {
                    await requestRegisterOtp(form.email);
                    toastSuccess('OTP resent');

                    setOtp(['', '', '', '', '', '']);
                    setTimeout(() => {
                      otpRefs.current[0]?.focus();
                    }, 200);

                    setResendTimer(RESEND_SECONDS);
                    setCanResend(false);
                  } catch (e) {
                    toastError(e.response?.data?.message || 'Failed to resend OTP');
                  }
                }}
              >
                <Text
                  style={[
                    styles.link,
                    { color: canResend ? '#000' : '#999' },
                  ]}
                >
                  {canResend
                    ? 'Didn’t receive OTP? Resend code'
                    : `Resend available in ${resendTimer}s`}
                </Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </View>
  );
}
