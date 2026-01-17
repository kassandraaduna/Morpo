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

const API_URL = 'http://10.0.2.2:8000/api/register';

function Register({ navigation }) {
    const [newMed, setNewMed] = useState({
        fname: "",
        lname: "",
        age: "",
        email: "",
        username: "",
        password: "",
        confirmPassword: ""
    });

    const handleCreateMed = async () => {
        const { fname, lname, age, email, username, password, confirmPassword } = newMed;

        if (!fname || !lname || !age || !email || !username || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters long');
            return;
        }

        if (!/[!@#$%^&*]/.test(password)) {
            Alert.alert('Error', 'Password must contain a special character');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        const medData = {
            fname,
            lname,
            age,
            email,
            username,
            password
        };

        console.log('Sending data:', medData);

        try {
            const res = await axios.post(API_URL, medData, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            console.log('Response:', res.data);

            Alert.alert('Success', 'Account registered successfully', [
                { text: 'OK', onPress: () => navigation.navigate('Login') }
            ]);

            setNewMed({
                fname: "",
                lname: "",
                age: "",
                email: "",
                username: "",
                password: "",
                confirmPassword: ""
            });

        } catch (error) {
            console.log('Register error:', error);

            Alert.alert(
                'Error',
                'Cannot connect to server. Make sure backend is running.'
            );
        }
    };

    return (
        <View style={styles.theBody}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.regMainCont}>
                    <Text style={styles.logHead}>REGISTER</Text>

                    <View style={styles.loginInputs}>
                        <TextInput style={styles.input} placeholder="First Name"
                            value={newMed.fname}
                            onChangeText={text => setNewMed({ ...newMed, fname: text })}
                        />
                        <TextInput style={styles.input} placeholder="Last Name"
                            value={newMed.lname}
                            onChangeText={text => setNewMed({ ...newMed, lname: text })}
                        />
                        <TextInput style={styles.input} placeholder="Age"
                            keyboardType="numeric"
                            value={newMed.age}
                            onChangeText={text => setNewMed({ ...newMed, age: text })}
                        />
                        <TextInput style={styles.input} placeholder="Email"
                            autoCapitalize="none"
                            value={newMed.email}
                            onChangeText={text => setNewMed({ ...newMed, email: text })}
                        />
                        <TextInput style={styles.input} placeholder="Username"
                            autoCapitalize="none"
                            value={newMed.username}
                            onChangeText={text => setNewMed({ ...newMed, username: text })}
                        />
                        <TextInput style={styles.input} placeholder="Password"
                            secureTextEntry
                            value={newMed.password}
                            onChangeText={text => setNewMed({ ...newMed, password: text })}
                        />
                        <TextInput style={styles.input} placeholder="Confirm Password"
                            secureTextEntry
                            value={newMed.confirmPassword}
                            onChangeText={text => setNewMed({ ...newMed, confirmPassword: text })}
                        />
                    </View>

                    <TouchableOpacity style={styles.logBtn} onPress={handleCreateMed}>
                        <Text style={styles.logBtnText}>REGISTER</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.registerText}>Already have an account? Login</Text>
                    </TouchableOpacity>
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
    },
});

export default Register;
