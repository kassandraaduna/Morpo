import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';
import api from './src/services/api';

export default function ChangePassword({ navigation }) {
    const RESEND_SECONDS = 60;
    const { theme } = useContext(ThemeContext);
    const [user, setUser] = useState(null);
    const [step, setStep] = useState('request');
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [canResend, setCanResend] = useState(true);
    const [otpId, setOtpId] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpVerified, setOtpVerified] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const otpRefs = useRef([]);
    const isOtpComplete = otp.every(d => d !== '');

    useEffect(() => {
        const fetchUser = async () => {
            const raw = await AsyncStorage.getItem('user');
            if (raw) setUser(JSON.parse(raw));
        };
        fetchUser();
    }, []);

    const handleOtpChange = (value, index) => {
        const copy = [...otp];
        copy[index] = value;
        setOtp(copy);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpBackspace = (key, index) => {
        if (key === 'Backspace' && otp[index] === '' && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const requestOtp = async () => {
        if (!user?.email) return toastError('Email not found. Please relogin.');
        try {
            setLoading(true);
            const res = await api.post('/auth/request-password-reset-otp', { email: user.email });
            setOtpId(res.data.otpId);
            setStep('otp');
            setResendTimer(RESEND_SECONDS);
            setCanResend(false);
            toastSuccess('OTP sent to your email');
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
            const res = await api.post('/auth/verify-password-reset-otp', {
                otpId,
                code: otp.join(''),
            });

            if (res.data?.message === 'OTP verified') {
                setOtpVerified(true);
                setStep('reset');
            }
        } catch (err) {
            toastError(err.response?.data?.message || 'Invalid OTP');
            setOtp(['', '', '', '', '', '']);
            setTimeout(() => otpRefs.current[0]?.focus(), 150);
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        if (!otpVerified) return toastError('OTP not verified');
        if (!isPasswordValid) return toastError('Password does not meet requirements');
        if (!passwordsMatch) return toastError('Passwords do not match');

        try {
            setLoading(true);
            await api.post('/auth/verify-password-reset-otp', {
                otpId,
                code: otp.join(''),
                newPassword,
            });

            toastSuccess('Password changed successfully');
            navigation.goBack();
        } catch (err) {
            toastError(err.response?.data?.message || 'Password update failed');
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
        if (!canResend && resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
            return () => clearTimeout(timer);
        }
        if (resendTimer === 0) setCanResend(true);
    }, [resendTimer, canResend]);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />

            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={localStyles.headerTitle}>Change Password</Text>
                        <Text style={localStyles.headerSubtitle}>Change your account password</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
                <View style={[localStyles.card, { backgroundColor: theme.card }]}>
                    
                    {step === 'request' && (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <View style={localStyles.shieldIcon}>
                                <Ionicons name="shield-checkmark" size={50} color="#10b981" />
                            </View>
                            <Text style={[localStyles.cardTitle, { color: theme.text }]}>Secure Password Change</Text>
                            <Text style={localStyles.cardSubtitle}>
                                To protect your account, we will send a 6-digit verification code to your registered email address:
                            </Text>
                            <View style={localStyles.emailBox}>
                                <Ionicons name="mail" size={18} color="#153c2a" style={{ marginRight: 8 }} />
                                <Text style={localStyles.emailText}>{user?.email}</Text>
                            </View>

                            <TouchableOpacity style={localStyles.primaryBtn} onPress={requestOtp} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.btnText}>Send OTP Code</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 'otp' && (
                        <View>
                            <Text style={[localStyles.cardTitle, { color: theme.text, textAlign: 'center' }]}>Verify OTP</Text>
                            <Text style={[localStyles.cardSubtitle, { textAlign: 'center', marginBottom: 25 }]}>
                                We've sent a 6-digit code to <Text style={{ fontWeight: 'bold' }}>{user?.email}</Text>
                            </Text>

                            <View style={localStyles.otpContainer}>
                                {otp.map((digit, i) => (
                                    <TextInput
                                        key={i}
                                        ref={ref => (otpRefs.current[i] = ref)}
                                        style={[localStyles.otpBox, { backgroundColor: theme.bg, color: theme.text }]}
                                        value={digit}
                                        maxLength={1}
                                        keyboardType="numeric"
                                        textAlign="center"
                                        onChangeText={v => handleOtpChange(v, i)}
                                        onKeyPress={({ nativeEvent }) => handleOtpBackspace(nativeEvent.key, i)}
                                    />
                                ))}
                            </View>

                            <TouchableOpacity 
                                style={[localStyles.primaryBtn, (!isOtpComplete || loading) && { opacity: 0.6 }]} 
                                disabled={!isOtpComplete || loading} 
                                onPress={verifyOtp}
                            >
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.btnText}>Verify Code</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity disabled={!canResend || loading} onPress={requestOtp} style={{ marginTop: 20, alignItems: 'center' }}>
                                <Text style={{ color: canResend ? '#10b981' : '#94A3B8', fontWeight: 'bold' }}>
                                    {canResend ? 'Resend Code' : `Resend available in ${resendTimer}s`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 'reset' && (
                        <View>
                            <Text style={[localStyles.cardTitle, { color: theme.text, marginBottom: 20 }]}>Create New Password</Text>
                            
                            <Text style={localStyles.label}>New Password</Text>
                            <View style={[localStyles.inputWrapper, { backgroundColor: theme.bg }]}>
                                <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={[localStyles.input, { color: theme.text }]}
                                    placeholder="Enter new password"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry={!showPassword}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>

                            <View style={localStyles.checklistContainer}>
                                {[
                                    ['At least 8 characters', passwordChecks.length],
                                    ['One uppercase letter', passwordChecks.upper],
                                    ['One number', passwordChecks.number],
                                    ['Special character (!@#$%^&*)', passwordChecks.special],
                                ].map(([label, ok], i) => (
                                    <View key={i} style={localStyles.checklistRow}>
                                        <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={14} color={ok ? '#10b981' : '#EF4444'} />
                                        <Text style={[localStyles.checklistText, { color: ok ? '#10b981' : '#EF4444' }]}>{label}</Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={localStyles.label}>Confirm Password</Text>
                            <View style={[localStyles.inputWrapper, { backgroundColor: theme.bg }]}>
                                <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={[localStyles.input, { color: theme.text }]}
                                    placeholder="Confirm new password"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>

                            {confirmPassword.length > 0 && (
                                <View style={[localStyles.checklistRow, { marginTop: 10 }]}>
                                    <Ionicons name={passwordsMatch ? 'checkmark-circle' : 'close-circle'} size={14} color={passwordsMatch ? '#10b981' : '#EF4444'} />
                                    <Text style={[localStyles.checklistText, { color: passwordsMatch ? '#10b981' : '#EF4444' }]}>
                                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity 
                                style={[localStyles.primaryBtn, { marginTop: 30 }, (!canSubmitPassword || loading) && { opacity: 0.6 }]} 
                                disabled={!canSubmitPassword || loading} 
                                onPress={resetPassword}
                            >
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.btnText}>Save New Password</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const localStyles = StyleSheet.create({
    header: { 
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, 
        paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 15 },
    headerSubtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },

    card: { padding: 25, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    shieldIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#e7f8f2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    cardTitle: { fontSize: 20, fontWeight: '900', marginBottom: 10 },
    cardSubtitle: { fontSize: 13, color: '#64748B', lineHeight: 20, textAlign: 'center', marginBottom: 15 },
    emailBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e7f8f2', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, marginBottom: 25 },
    emailText: { fontSize: 14, fontWeight: 'bold', color: '#153c2a' },

    primaryBtn: { backgroundColor: '#153c2a', height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center', width: '100%', elevation: 2 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

    otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 25 },
    otpBox: { width: 45, height: 55, borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: 'bold', elevation: 1 },

    label: { fontSize: 13, fontWeight: '800', color: '#64748B', marginBottom: 6, marginLeft: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 55, borderRadius: 15, paddingHorizontal: 15, marginBottom: 15 },
    input: { flex: 1, fontSize: 15, fontWeight: '600', borderRadius: 15, },

    checklistContainer: { marginBottom: 20, marginTop: 5 },
    checklistRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    checklistText: { fontSize: 12, marginLeft: 8, fontWeight: '600' }
});