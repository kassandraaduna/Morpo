import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../Pages/src/services/api';
import { ThemeContext } from '../Pages/src/context/ThemeContext';
import { toastSuccess, toastError } from '../Pages/src/components/ToastMsg';
import AssessmentSettings from './AssessmentSettings';

export default function CreateAssessmentLink({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [settings, setSettings] = useState({
    timer: { enabled: false, minutes: 30 },
    availableAt: null,
    deadlineAt: null,
    closeOnDeadline: false,
    allowRetakes: true,
    maxRetakes: 3,
    targetYears: [],
    targetSections: [],
    excludedStudentIds: [],
    isPracticeOnly: false,
  });

  // FIXED: Declared as handleSubmitAssessment and aliased to handleSave
  const handleSubmitAssessment = async (status = 'published') => {
    if (!title.trim() || !url.trim()) {
      return toastError('Assessment Title and URL are required.');
    }

    // Strict validation before publishing
    if (status === 'published') {
      if (!settings.targetSections || settings.targetSections.length === 0) {
        return toastError(
          'Please assign at least one target section in Settings before publishing.'
        );
      }
      if (!settings.availableAt) {
        return toastError(
          'Please set an available access date & time in Settings before publishing.'
        );
      }
      if (!settings.deadlineAt) {
        return toastError(
          'Please set a submission due date & time in Settings before publishing.'
        );
      }
    }

    try {
      setLoading(true);
      const rawUser = await AsyncStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;

      const payload = {
        title: title.trim(),
        externalUrl: url.trim(),
        deliveryMode: 'external',
        quizType: 'test',
        status: status,
        createdBy: user?._id || null, // Syncs with Instructor Web
        ...settings,
        availableAt: settings.availableAt
          ? new Date(settings.availableAt).toISOString()
          : null,
        deadlineAt: settings.deadlineAt
          ? new Date(settings.deadlineAt).toISOString()
          : null,
      };

      await api.post('/assessments', payload);
      toastSuccess(
        `Assessment ${status === 'draft' ? 'saved as draft' : 'published successfully'}!`
      );
      navigation.goBack();
    } catch (error) {
      toastError(
        error?.response?.data?.message || 'Failed to save assessment.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = handleSubmitAssessment; // Alias to prevent ReferenceError

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#153c2a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attach External Assessment</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-sharp" size={20} color="#153c2a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Assessment Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Google Forms Quiz - Week 1"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>External Platform URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://forms.google.com/..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
          />
        </View>

        <TouchableOpacity
          style={styles.publishBtn}
          onPress={() => handleSubmitAssessment('published')}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>PUBLISH NOW</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.draftBtn}
          onPress={() => handleSubmitAssessment('draft')}
          disabled={loading}
        >
          <Text style={styles.draftBtnText}>SAVE AS DRAFT</Text>
        </TouchableOpacity>
      </ScrollView>

      <AssessmentSettings
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        setSettings={setSettings}
        isExternal={true}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 15,
    backgroundColor: '#FFF',
    elevation: 4,
  },
  backBtn: { padding: 5 },
  settingsBtn: { padding: 5, backgroundColor: '#E7F5EE', borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#153c2a' },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 20,
    elevation: 2,
    marginBottom: 30,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    marginTop: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 15,
    backgroundColor: '#F8FAFC',
    color: '#000',
    fontWeight: '600',
  },
  publishBtn: {
    backgroundColor: '#153c2a',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 4,
  },
  draftBtn: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  draftBtnText: { color: '#64748B', fontSize: 15, fontWeight: 'bold' },
});