import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import axios from 'axios';

const API_URL = 'http://192.168.1.6:8000/api/login';

function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(API_URL, {
        email: email.trim(),
        password: password.trim(),
      });

      console.log('Login response:', response.data);

      if (response.data.user) {
        setEmail('');
        setPassword('');

        navigation.navigate('Homepage', {
          user: response.data.user,
        });
      } else {
        Alert.alert('Error', 'Invalid login credentials');
      }
    } catch (error) {
      console.log('Login error:', error);

      if (error.response) {
        Alert.alert(
          'Error',
          error.response.data.message || 'Invalid email or password'
        );
      } else {
        Alert.alert(
          'Error',
          'Cannot connect to server. Check your internet or server.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  return (
    <View style={styles.theBody}>
      <View style={styles.loginMainCont}>
        <Text style={styles.logHead}>LOG-IN</Text>

        <View style={styles.loginInputs}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={styles.logBtn}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.logBtnText}>
            {loading ? 'Logging in...' : 'LOG-IN'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRegister}
          style={styles.registerTextBtn}
        >
          <Text style={styles.registerText}>No account? Register here</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  theBody: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  loginMainCont: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  logHead: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  loginInputs: {
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  logBtn: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  logBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerTextBtn: {
    alignItems: 'center',
  },
  registerText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default Login;
