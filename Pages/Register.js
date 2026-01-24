import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    StyleSheet, 
    Alert, 
    ScrollView
} from 'react-native';
import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.18:8000';

function Register({ navigation }) {
    const [step, setStep] = useState('form');
    const [isLoading, setIsLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        fname: "",
        lname: "",
        dob: "",
        gender: "",
        number: "",
        email: "",
        username: "",
        password: "",
        confirmPassword: ""
    });

    const [otpData, setOtpData] = useState({
        otp: "",
        otpId: "",
        maskedEmail: "",
        expiresAt: ""
    });

    const handleRequestOtp = async () => {
        console.log('Sign Up button clicked!');
        console.log('Form Data:', formData);
        const { fname, lname, email, username, password, confirmPassword } = formData;

        console.log('fname:', fname, 'isEmpty:', !fname);
        console.log('lname:', lname, 'isEmpty:', !lname);
        console.log('email:', email, 'isEmpty:', !email);
        console.log('username:', username, 'isEmpty:', !username);
        console.log('password:', password, 'isEmpty:', !password);
        console.log('confirmPassword:', confirmPassword, 'isEmpty:', !confirmPassword);

        if (!fname || !lname || !email || !username || !password || !confirmPassword) {
            console.log('VALIDATION 1 FAILED - Missing fields');
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        console.log('VALIDATION 1 PASSED - All fields filled');

        if (password.length < 8) {
            console.log('VALIDATION 2 FAILED - Password too short:', password.length);
            Alert.alert('Error', 'Password must be at least 8 characters long');
            return;
        }

        console.log('VALIDATION 2 PASSED - Password length OK');

        if (!/[!@#$%^&*]/.test(password)) {
            console.log('VALIDATION 3 FAILED - No special character');
            Alert.alert('Error', 'Password must contain a special character');
            return;
        }

        console.log('VALIDATION 3 PASSED - Special character found');

        if (password !== confirmPassword) {
            console.log('VALIDATION 4 FAILED - Passwords dont match');
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        console.log('VALIDATION 4 PASSED - Passwords match');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            console.log('VALIDATION 5 FAILED - Invalid email');
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        console.log('VALIDATION 5 PASSED - All validations complete');
        console.log('All validation passed, setting loading...');
        setIsLoading(true);
        console.log('isLoading set to true');

        try {
            console.log('Entered try block');
            console.log('Sending OTP request to:', `${API_BASE_URL}/api/auth/request-email-otp`);
            console.log('Request payload:', { email: email.trim(), purpose: 'register' });

            const res = await axios.post(`${API_BASE_URL}/api/auth/request-email-otp`, {
                email: email.trim(),
                purpose: 'register'
            });

            console.log('OTP Response received:', res.data);

            setOtpData({
                otp: "",
                otpId: res.data?.otpId || '',
                maskedEmail: res.data?.maskedEmail || email,
                expiresAt: res.data?.expiresAt || ''
            });

            setStep('verify');
            Alert.alert('Success', 'Verification code sent to your email');
        } catch (error) {
            console.log('Request OTP error:', error);
            const errorMessage = error?.response?.data?.message || 
                                error?.response?.data?.error ||
                                'Failed to send verification code.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyAndRegister = async () => {
        console.log('OTP clicked!');
        
        if (!otpData.otp.trim()) {
            Alert.alert('Error', 'Please enter the verification code');
            return;
        }

        if (!otpData.otpId) {
            Alert.alert('Error', 'Missing OTP session. Please resend code.');
            return;
        }

        try {
            setIsLoading(true);
            
            const medData = {
                fname: formData.fname.trim(),
                lname: formData.lname.trim(),
                dob: formData.dob,
                gender: formData.gender.trim(),
                number: formData.number.trim(),
                email: formData.email.trim(),
                username: formData.username.trim(),
                password: formData.password
            };

            console.log('Sending registration data:', medData);

            const res = await axios.post(`${API_BASE_URL}/api/auth/verify-email-otp-and-register`, {
                otpId: otpData.otpId,
                code: otpData.otp.trim(),
                medData
            });

            console.log('Registration successful:', res.data);

            Alert.alert('Success', 'Account registered successfully! Please login.', [
                { text: 'OK', onPress: () => {
                    setFormData({
                        fname: "",
                        lname: "",
                        dob: "",
                        gender: "",
                        number: "",
                        email: "",
                        username: "",
                        password: "",
                        confirmPassword: ""
                    });
                    setOtpData({
                        otp: "",
                        otpId: "",
                        maskedEmail: "",
                        expiresAt: ""
                    });
                    setStep('form');
                    navigation.navigate('Login');
                }}
            ]);
        } catch (error) {
            console.log('Register error:', error);
            const errorMessage = error?.response?.data?.message || 
                                error?.response?.data?.error ||
                                'Verification failed. Please try again.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            setIsLoading(true);
            console.log('Resending OTP to:', formData.email);

            const res = await axios.post(`${API_BASE_URL}/api/auth/resend-email-otp`, {
                email: formData.email.trim(),
                purpose: 'register'
            });

            setOtpData(prev => ({
                ...prev,
                otpId: res.data?.otpId || prev.otpId,
                maskedEmail: res.data?.maskedEmail || prev.maskedEmail,
                expiresAt: res.data?.expiresAt || prev.expiresAt
            }));

            Alert.alert('Success', 'Verification code resent!');
        } catch (error) {
            console.log('Resend OTP error:', error);
            const errorMessage = error?.response?.data?.message || 
                                error?.response?.data?.error ||
                                'Failed to resend code.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const goBack = () => {
        setStep('form');
        setOtpData({
            otp: "",
            otpId: "",
            maskedEmail: "",
            expiresAt: ""
        });
    };

    return (
        <View style={styles.theBody}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.regMainCont}>
                    <Text style={styles.logHead}>REGISTER</Text>

                    {step === 'form' && (
                        <>
                            <View style={styles.loginInputs}>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="First Name"
                                    value={formData.fname}
                                    onChangeText={text => setFormData({ ...formData, fname: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Last Name"
                                    value={formData.lname}
                                    onChangeText={text => setFormData({ ...formData, lname: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Date of Birth (YYYY-MM-DD)"
                                    value={formData.dob}
                                    onChangeText={text => setFormData({ ...formData, dob: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Gender (e.g., Male, Female, Other)"
                                    value={formData.gender}
                                    onChangeText={text => setFormData({ ...formData, gender: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Phone Number"
                                    keyboardType="phone-pad"
                                    value={formData.number}
                                    onChangeText={text => setFormData({ ...formData, number: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Email"
                                    autoCapitalize="none"
                                    value={formData.email}
                                    onChangeText={text => setFormData({ ...formData, email: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Username"
                                    autoCapitalize="none"
                                    value={formData.username}
                                    onChangeText={text => setFormData({ ...formData, username: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Password"
                                    secureTextEntry
                                    value={formData.password}
                                    onChangeText={text => setFormData({ ...formData, password: text })}
                                    editable={!isLoading}
                                />
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Confirm Password"
                                    secureTextEntry
                                    value={formData.confirmPassword}
                                    onChangeText={text => setFormData({ ...formData, confirmPassword: text })}
                                    editable={!isLoading}
                                />
                            </View>

                            <TouchableOpacity 
                                style={styles.logBtn} 
                                onPress={handleRequestOtp}
                                disabled={isLoading}
                            >
                                <Text style={styles.logBtnText}>
                                    {isLoading ? 'SENDING CODE...' : 'SIGN UP'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => navigation.navigate('Login')}
                                disabled={isLoading}
                            >
                                <Text style={styles.registerText}>Already have an account? Login</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'verify' && (
                        <>
                            <Text style={styles.subText}>
                                A verification code has been sent to{'\n'}
                                <Text style={{ fontWeight: 'bold' }}>{otpData.maskedEmail}</Text>
                            </Text>

                            <View style={styles.loginInputs}>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Enter verification code"
                                    inputMode="numeric"
                                    value={otpData.otp}
                                    onChangeText={text => setOtpData({ ...otpData, otp: text })}
                                    editable={!isLoading}
                                />
                            </View>

                            <TouchableOpacity 
                                style={styles.logBtn} 
                                onPress={handleVerifyAndRegister}
                                disabled={isLoading}
                            >
                                <Text style={styles.logBtnText}>
                                    {isLoading ? 'VERIFYING...' : 'CONTINUE'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleResendOtp}
                                disabled={isLoading}
                            >
                                <Text style={styles.registerText}>Resend code</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={goBack}
                                disabled={isLoading}
                            >
                                <Text style={styles.registerText}>Back to sign up</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    theBody: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContainer: {
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    regMainCont: {
        backgroundColor: '#fff',
        padding: 25,
        borderRadius: 15,
        elevation: 4,
    },
    logHead: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 25,
        color: '#333',
    },
    subText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
    loginInputs: {
        marginBottom: 10,
    },
    input: {
        height: 45,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 12,
        backgroundColor: '#fafafa',
    },
    logBtn: {
        backgroundColor: '#28a745',
        borderRadius: 8,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    logBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    registerText: {
        color: '#007AFF',
        textAlign: 'center',
        fontSize: 14,
        marginTop: 10,
    },
});

export default Register;
