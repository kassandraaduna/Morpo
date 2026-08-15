import React, { useState, useContext, useEffect } from 'react';
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
import StudentViewModal from './StudentViewModal';

export default function EditAssessment({ navigation, route }) {
  const { assessment } = route.params || {};
  const { theme } = useContext(ThemeContext);
  
  const isExternal = assessment?.deliveryMode === 'external';

  const [title, setTitle] = useState(assessment?.title || '');
  const [url, setUrl] = useState(assessment?.externalUrl || assessment?.link || '');
  const [questions, setQuestions] = useState(
    assessment?.questions?.length > 0 
      ? assessment.questions 
      : [{ format: 'multiple_choice', text: '', points: 1, options: ['', '', '', ''], correctIndex: 0 }]
  );
  
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStudentView, setShowStudentView] = useState(false);

  // Pre-load the draft's existing settings
  const [settings, setSettings] = useState({
    timer: assessment?.timer || { enabled: false, minutes: 30 },
    availableAt: assessment?.availableAt || null,
    deadlineAt: assessment?.deadlineAt || null,
    closeOnDeadline: !!assessment?.closeOnDeadline,
    allowRetakes: assessment?.allowRetakes ?? true,
    maxRetakes: assessment?.maxRetakes || 3,
    targetYears: assessment?.targetYears || [],
    targetSections: assessment?.targetSections || [],
    excludedStudentIds: assessment?.excludedStudentIds || [],
    isPracticeOnly: !!assessment?.isPracticeOnly,
    shuffleQuestions: !!assessment?.shuffleQuestions,
  });

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { format: 'multiple_choice', text: '', points: 1, options: ['', '', '', ''], correctIndex: 0 },
    ]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleUpdateAssessment = async (status = 'published') => {
    if (!title.trim()) return toastError('Please enter an assessment title.');
    
    if (isExternal) {
      if (!url.trim()) return toastError('External URL is required.');
    } else {
      if (questions.length === 0) return toastError('Please add at least one question.');
    }

    if (status === 'published') {
      if (!settings.targetSections || settings.targetSections.length === 0) {
        return toastError('Please assign at least one target section in Settings before publishing.');
      }
      if (!settings.availableAt) {
        return toastError('Please set an available access date & time in Settings before publishing.');
      }
      if (!settings.deadlineAt) {
        return toastError('Please set a submission due date & time in Settings before publishing.');
      }
    }

    try {
      setLoading(true);
      const rawUser = await AsyncStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;

      const payload = {
        ...assessment, // Keep original metadata
        title: title.trim(),
        status: status,
        modifiedBy: user?._id || null,
        ...settings,
        availableAt: settings.availableAt ? new Date(settings.availableAt).toISOString() : null,
        deadlineAt: settings.deadlineAt ? new Date(settings.deadlineAt).toISOString() : null,
      };

      if (isExternal) {
        payload.externalUrl = url.trim();
      } else {
        payload.timer = {
          enabled: !!settings.timer?.enabled,
          minutes: settings.timer?.enabled ? Number(settings.timer?.minutes || 30) : null,
        };
        payload.shuffleQuestions = !!settings.shuffleQuestions;
        payload.questions = questions.map((q) => ({
          format: q.format || 'multiple_choice',
          text: String(q.text || '').trim(),
          points: Number(q.points || 1),
          options: (q.options || []).map((opt) => String(opt).trim()),
          correctIndex: Number(q.correctIndex || 0),
        }));
      }

      // Use PUT to update the existing assessment[cite: 6]
      await api.put(`/assessments/${assessment._id}`, payload);
      toastSuccess(`Assessment ${status === 'draft' ? 'draft updated' : 'published successfully'}!`);
      navigation.goBack();
    } catch (error) {
      toastError(error?.response?.data?.message || 'Failed to update assessment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Edit Assessment</Text>
          {!isExternal && (
            <TouchableOpacity style={styles.studentViewBtn} onPress={() => setShowStudentView(true)} activeOpacity={0.8}>
              <Ionicons name="eye-outline" size={14} color="#FFF" />
              <Text style={styles.studentViewText}>Student View</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
          <Ionicons name="settings-sharp" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 80 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        <View style={styles.card}>
          <Text style={styles.label}>Assessment Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Midterm Quiz"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />

          {isExternal && (
            <>
              <Text style={[styles.label, { marginTop: 15 }]}>External Platform URL</Text>
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
            </>
          )}
        </View>

        {/* Render Questions ONLY for Internal Assessments */}
        {!isExternal && questions.map((q, qIndex) => (
          <View key={qIndex} style={styles.qCard}>
            <View style={styles.qHeaderRow}>
              <Text style={styles.qHeader}>Question {qIndex + 1}</Text>
              {questions.length > 1 && (
                <TouchableOpacity onPress={() => setQuestions(questions.filter((_, i) => i !== qIndex))}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={[styles.input, { marginBottom: 15, minHeight: 60 }]}
              placeholder="Enter your question here..."
              value={q.text}
              onChangeText={(t) => updateQuestion(qIndex, 'text', t)}
              multiline
              placeholderTextColor="#94A3B8"
            />

            {q.options.map((opt, oIndex) => (
              <View key={oIndex} style={styles.optRow}>
                <TouchableOpacity
                  style={[styles.radio, q.correctIndex === oIndex && styles.radioActive]}
                  onPress={() => updateQuestion(qIndex, 'correctIndex', oIndex)}
                >
                  {q.correctIndex === oIndex && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, marginLeft: 10, height: 48 }]}
                  placeholder={`Option ${oIndex + 1}`}
                  value={opt}
                  onChangeText={(t) => {
                    const newOpts = [...q.options];
                    newOpts[oIndex] = t;
                    updateQuestion(qIndex, 'options', newOpts);
                  }}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            ))}
          </View>
        ))}

        {!isExternal && (
          <TouchableOpacity style={styles.addBtn} onPress={addQuestion}>
            <Ionicons name="add-circle-outline" size={20} color="#153c2a" style={{ marginRight: 8 }} />
            <Text style={styles.addBtnText}>Add Another Question</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.publishBtn} onPress={() => handleUpdateAssessment('published')} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>PUBLISH CHANGES</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.draftBtn} onPress={() => handleUpdateAssessment('draft')} disabled={loading}>
          <Text style={styles.draftBtnText}>Save as Draft</Text>
        </TouchableOpacity>

      </ScrollView>

      <AssessmentSettings
        isExternal={isExternal}
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        setSettings={setSettings}
      />

      {!isExternal && (
        <StudentViewModal
          visible={showStudentView}
          onClose={() => setShowStudentView(false)}
          title={title}
          questions={questions}
          timer={settings.timer}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7F6' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 25,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        backgroundColor: '#153c2a',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8
    },
    backBtn: { padding: 5 },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
    headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 6, textAlign: 'center' },
    settingsBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
    studentViewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    studentViewText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, elevation: 2, marginBottom: 20 },
    label: { fontSize: 15, fontWeight: '800', color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15, backgroundColor: '#F8FAFC', color: '#000', fontWeight: '600' },
    qCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, marginBottom: 20, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
    qHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    qHeader: { fontSize: 14, fontWeight: '900', color: '#153c2a', textTransform: 'uppercase', letterSpacing: 0.5 },
    optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    radio: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
    radioActive: { borderColor: '#10B981', backgroundColor: '#10B981' },
    addBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: '#E7F5EE', borderRadius: 10, marginBottom: 30, borderWidth: 1, borderColor: '#153c2a', borderStyle: 'dashed' },
    addBtnText: { color: '#153c2a', fontWeight: '900', fontSize: 15 },
    publishBtn: { backgroundColor: '#153c2a', padding: 16, borderRadius: 10, alignItems: 'center', elevation: 4 },
    draftBtn: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
    draftBtnText: { color: '#64748B', fontSize: 15, fontWeight: 'bold' },
});