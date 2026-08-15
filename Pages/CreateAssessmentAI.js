import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../Pages/src/services/api';
import { ThemeContext } from '../Pages/src/context/ThemeContext';
import { toastSuccess, toastError } from '../Pages/src/components/ToastMsg';
import AssessmentSettings from './AssessmentSettings';
import StudentViewModal from './StudentViewModal';

export default function CreateAssessmentAI({ navigation }) {
  const { theme } = useContext(ThemeContext);

  // AI Generation Controls State
  const [instructions, setInstructions] = useState('');
  const [questionCount, setQuestionCount] = useState('5');
  const [pdfFile, setPdfFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Lessons References State
  const [availableLessons, setAvailableLessons] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [fetchingLessons, setFetchingLessons] = useState(true);

  // Assessment Form State (Populates after AI generation)
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showStudentView, setShowStudentView] = useState(false);

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
    shuffleQuestions: false,
  });

  useEffect(() => {
    const fetchInstructorLessons = async () => {
      try {
        const userRaw = await AsyncStorage.getItem('user');
        if (!userRaw) return;
        const user = JSON.parse(userRaw);
        const res = await api.get(`/lessons?instructorId=${user._id}`);
        setAvailableLessons(res.data?.data || []);
      } catch (error) {
        console.log('Failed to load lessons', error);
      } finally {
        setFetchingLessons(false);
      }
    };
    fetchInstructorLessons();
  }, []);

  const toggleLesson = (lesson) => {
    const isSelected = selectedLessons.find((l) => l._id === lesson._id);
    if (isSelected) {
      setSelectedLessons(selectedLessons.filter((l) => l._id !== lesson._id));
    } else {
      if (selectedLessons.length >= 5) {
        return toastError('You can only select up to 5 existing lessons.');
      }
      setSelectedLessons([...selectedLessons, lesson]);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setPdfFile(result.assets[0]);
    } catch (error) {
      toastError('Failed to pick document');
    }
  };

  // ─── GENERATE WITH MYPHO-AI (FIXED URL & EPHEMERAL DISK COMPATIBILITY) ───
  const handleGenerateWithAI = async () => {
    if (selectedLessons.length === 0 && !pdfFile && !instructions.trim()) {
      return toastError('Please select a lesson, upload a PDF reference, or enter instructions.');
    }

    try {
      setGenerating(true);
      const formData = new FormData();
      formData.append('questionCount', String(questionCount || '5'));

      // 1. COMBINE LESSON TEXT FROM MONGODB INTO lessonContent:
      // Because hosting platforms like Render use ephemeral disk storage, files in /uploads/
      // get wiped on restart. Sending all lesson text via lessonContent ensures Gemini
      // receives 100% of your lesson content without ever throwing an ENOENT HTTP 500 error.
      const lessonTextParts = selectedLessons
        .map((l) => {
          const text = l.educationalContent || l.content || l.description || '';
          return `--- Lesson: ${l.title || 'Untitled'} ---\n${text}`;
        })
        .filter(Boolean);

      if (instructions.trim()) {
        lessonTextParts.push(`--- Additional Instructions ---\n${instructions.trim()}`);
      }

      const combinedLessonContent = lessonTextParts.join('\n\n');
      if (combinedLessonContent.trim()) {
        formData.append('lessonContent', combinedLessonContent.trim());
      }

      // 2. Attach newly uploaded PDF reference file securely for Android & iOS
      if (pdfFile) {
        const fileUri =
          Platform.OS === 'ios' ? pdfFile.uri.replace('file://', '') : pdfFile.uri;

        let fileName = pdfFile.name || `reference_${Date.now()}.pdf`;
        if (!/\.[a-zA-Z0-9]+$/.test(fileName)) {
          fileName += '.pdf';
        }

        formData.append('pdfFiles', {
          uri: fileUri,
          name: fileName,
          type: pdfFile.mimeType || 'application/pdf',
        });
      }

      // 3. CALL API.POST:
      // Automatically uses BASE_URL (/api/ai/generate-quiz), preventing HTML 404 errors
      const response = await api.post('/ai/generate-quiz', formData, {
        timeout: 120000,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Unwrap questions across all possible backend JSON wrapper shapes
      const resPayload = response.data?.data || response.data;
      const rawQuestions =
        Array.isArray(resPayload)
          ? resPayload
          : Array.isArray(resPayload?.questions)
          ? resPayload.questions
          : Array.isArray(response.data?.questions)
          ? response.data.questions
          : Array.isArray(resPayload?.quiz)
          ? resPayload.quiz
          : [];

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        toastError('AI did not return valid questions. Please try again.');
        return;
      }

      const formattedQuestions = rawQuestions.map((q, idx) => {
        const options =
          Array.isArray(q.options) && q.options.length >= 2
            ? q.options.map((opt) => String(opt).trim())
            : ['Option A', 'Option B', 'Option C', 'Option D'];

        let correctIndex = Number(q.correctIndex ?? q.answerIndex ?? 0);
        if (
          isNaN(correctIndex) ||
          correctIndex < 0 ||
          correctIndex >= options.length
        ) {
          correctIndex = 0;
        }

        return {
          id: `ai_${Date.now()}_${idx}`,
          format: q.format || 'multiple_choice',
          text: String(q.text || q.question || `Question ${idx + 1}`).trim(),
          points: Number(q.points || 1),
          options: options,
          correctIndex: correctIndex,
        };
      });

      setQuestions(formattedQuestions);
      if (!title) setTitle('AI Generated Assessment');
      toastSuccess(`Generated ${formattedQuestions.length} questions! Review below.`);
    } catch (err) {
      console.log('AI Quiz Generation Error Detail:', err?.response?.data || err);
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to generate questions with MyphoAI.';
      toastError(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        format: 'multiple_choice',
        text: '',
        points: 1,
        options: ['', '', '', ''],
        correctIndex: 0,
      },
    ]);
  };

  // ─── SUBMIT / PUBLISH HANDLER (WITH STRICT VALIDATION) ───
  const handleSubmitAssessment = async (status = 'published') => {
    if (!title.trim()) {
      return toastError('Please enter an assessment title.');
    }
    if (questions.length === 0) {
      return toastError('Please generate or add at least one question.');
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
        deliveryMode: 'internal',
        quizType: 'test',
        status: status,
        createdBy: user?._id || null, // Syncs with Instructor Web
        timer: {
          enabled: !!settings.timer?.enabled,
          minutes: settings.timer?.enabled
            ? Number(settings.timer?.minutes || 30)
            : null,
        },
        excludedStudentIds: settings.excludedStudentIds || [],
        isPracticeOnly: !!settings.isPracticeOnly,
        shuffleQuestions: !!settings.shuffleQuestions,
        questions: questions.map((q) => ({
          format: q.format || 'multiple_choice',
          text: String(q.text || '').trim(),
          points: Number(q.points || 1),
          options: (q.options || []).map((opt) => String(opt).trim()),
          correctIndex: Number(q.correctIndex || 0),
        })),
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
      style={[styles.container, { backgroundColor: theme?.bg || '#F4F7F6' }]}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>MyphoAI Question Generator</Text>
          <TouchableOpacity
            style={styles.studentViewBtn}
            onPress={() => setShowStudentView(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={14} color="#FFF" />
            <Text style={styles.studentViewText}>Student View</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
          <Ionicons name="settings-sharp" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* AI GENERATOR CARD */}
        <View style={styles.card}>
          <Text style={styles.label}>Number of Questions</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={questionCount}
            onChangeText={setQuestionCount}
            placeholderTextColor="#94A3B8"
          />

          <Text style={[styles.label, { marginTop: 20 }]}>
            Include Existing Lessons (Max 5)
          </Text>
          {fetchingLessons ? (
            <ActivityIndicator
              color="#153c2a"
              style={{ alignSelf: 'flex-start', marginTop: 10 }}
            />
          ) : availableLessons.length === 0 ? (
            <Text style={styles.emptyText}>No lessons uploaded yet.</Text>
          ) : (
            <View style={styles.chipContainer}>
              {availableLessons.map((lesson) => {
                const isSelected = selectedLessons.some(
                  (l) => l._id === lesson._id
                );
                return (
                  <TouchableOpacity
                    key={lesson._id}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => toggleLesson(lesson)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {lesson.title || 'Untitled Lesson'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>
            Reference Material (Optional)
          </Text>
          <TouchableOpacity style={styles.uploadBox} onPress={pickDocument}>
            <Ionicons
              name="document-text"
              size={32}
              color={pdfFile ? '#10B981' : '#94A3B8'}
            />
            <Text
              style={[styles.uploadText, pdfFile && { color: '#10B981' }]}
            >
              {pdfFile ? pdfFile.name : 'Tap to select a PDF file'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 20 }]}>
            Additional Context (Optional)
          </Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Focus on specific topics..."
            value={instructions}
            onChangeText={setInstructions}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* GENERATE BUTTON */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerateWithAI}
          disabled={generating || loading}
        >
          {generating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons
                name="sparkles"
                size={20}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.btnText}>GENERATE WITH MYPHO-AI</Text>
            </>
          )}
        </TouchableOpacity>

        {/* GENERATED QUESTIONS REVIEW FORM */}
        {questions.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <Text style={styles.sectionTitle}>
              Generated Questions ({questions.length})
            </Text>

            <View style={[styles.card, { marginTop: 10 }]}>
              <Text style={styles.label}>Assessment Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. AI Generated Quiz"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {questions.map((q, qIndex) => (
              <View key={qIndex} style={styles.qCard}>
                <View style={styles.qHeaderRow}>
                  <Text style={styles.qHeader}>Question {qIndex + 1}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setQuestions(
                        questions.filter((_, i) => i !== qIndex)
                      )
                    }
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.input, { marginBottom: 15, minHeight: 60 }]}
                  placeholder="Question text..."
                  value={q.text}
                  onChangeText={(t) => updateQuestion(qIndex, 'text', t)}
                  multiline
                  placeholderTextColor="#94A3B8"
                />

                {q.options.map((opt, oIndex) => (
                  <View key={oIndex} style={styles.optRow}>
                    <TouchableOpacity
                      style={[
                        styles.radio,
                        q.correctIndex === oIndex && styles.radioActive,
                      ]}
                      onPress={() =>
                        updateQuestion(qIndex, 'correctIndex', oIndex)
                      }
                    >
                      {q.correctIndex === oIndex && (
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      )}
                    </TouchableOpacity>
                    <TextInput
                      style={[
                        styles.input,
                        { flex: 1, marginBottom: 0, marginLeft: 10, height: 48 },
                      ]}
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

            <TouchableOpacity style={styles.addBtn} onPress={addQuestion}>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color="#153c2a"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addBtnText}>Add Another Question</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.publishBtn}
              onPress={() => handleSubmitAssessment('published')}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>PUBLISH ASSESSMENT</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.draftBtn}
              onPress={() => handleSubmitAssessment('draft')}
              disabled={loading}
            >
              <Text style={styles.draftBtnText}>Save as Draft</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <AssessmentSettings
        isExternal={false}
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        setSettings={setSettings}
      />

      <StudentViewModal
        visible={showStudentView}
        onClose={() => setShowStudentView(false)}
        title={title}
        questions={questions}
        timer={settings.timer}
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
    paddingBottom: 25,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#153c2a',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  backBtn: { padding: 5 },
  settingsBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  studentViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  studentViewText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: '#FFF',
    marginBottom: 6,
    textAlign: 'center' 
  },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: '#E7F5EE', borderColor: '#10B981' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  chipTextActive: { color: '#10B981' },
  emptyText: {
    fontStyle: 'italic',
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 5,
  },
  uploadBox: {
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 15,
  },
  uploadText: {
    marginTop: 10,
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  textArea: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 15,
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
    height: 120,
    color: '#0F172A',
    fontWeight: '500',
  },
  generateBtn: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#153c2a',
    textTransform: 'uppercase',
  },
  qCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  qHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  qHeader: {
    fontSize: 14,
    fontWeight: '900',
    color: '#153c2a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: '#10B981' },
  addBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#E7F5EE',
    borderRadius: 10,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#153c2a',
    borderStyle: 'dashed',
  },
  addBtnText: { color: '#153c2a', fontWeight: '900', fontSize: 15 },
  publishBtn: {
    backgroundColor: '#153c2a',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 4,
  },
  draftBtn: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  draftBtnText: { color: '#64748B', fontSize: 15, fontWeight: 'bold' },
});