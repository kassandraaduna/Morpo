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

const emptyQuestion = {
  format: 'multiple_choice',
  text: '',
  points: 1,
  options: ['', '', '', ''],
  correctIndex: 0,
  matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }],
  acceptedAnswers: [''],
};

const questionFormats = [
  { key: 'multiple_choice', label: 'Multiple Choice' },
  { key: 'true_false', label: 'True / False' },
  { key: 'matching', label: 'Matching' },
  { key: 'written', label: 'Written Response' },
  { key: 'identification', label: 'Identification' }
];

export default function CreateAssessmentAI({ navigation }) {
  const { theme } = useContext(ThemeContext);

  const [instructions, setInstructions] = useState('');
  const [questionCount, setQuestionCount] = useState('5');
  const [pdfFile, setPdfFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const [availableLessons, setAvailableLessons] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [fetchingLessons, setFetchingLessons] = useState(true);
  const [showLessonDropdown, setShowLessonDropdown] = useState(false); 

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
    scoreVisibility: 'immediate',
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

  const handleGenerateWithAI = async () => {
    if (selectedLessons.length === 0 && !pdfFile && !instructions.trim()) {
      return toastError('Please select an existing lesson, upload a PDF file reference, or enter instructions.');
    }

    try {
      setGenerating(true);
      const formData = new FormData();
      formData.append('questionCount', String(questionCount || '5'));

      let combinedText = '';
      if (instructions.trim()) {
        combinedText += `--- Additional Instructions ---\n${instructions.trim()}\n\n`;
      }

      let pdfNamesArr = [];

      if (selectedLessons.length > 0) {
        for (const lessonSummary of selectedLessons) {
          try {
            const detailRes = await api.get(`/lessons/${lessonSummary._id}`);
            const fullLesson = detailRes.data?.data || detailRes.data || lessonSummary;
            
            const text = fullLesson.educationalContent || fullLesson.content || fullLesson.description || '';
            if (text) {
              combinedText += `--- Lesson: ${fullLesson.title || 'Untitled'} ---\n${text}\n\n`;
            }

            const rawUrl = fullLesson.pdfUrl || fullLesson.pdfName;
            if (rawUrl) {
              const fName = String(rawUrl).replace(/\\/g, '/').split('/').pop();
              pdfNamesArr.push(fName);
            }
          } catch (err) {
            console.log(`Failed to fetch full text for lesson ${lessonSummary._id}`, err);
          }
        }
      }

      if (combinedText.trim()) {
        formData.append('lessonContent', combinedText.trim());
      }

      if (pdfNamesArr.length > 0) {
        pdfNamesArr.forEach((fileName) => {
          formData.append('existingPdfNames', fileName);
        });
      }

      if (pdfFile) {
        // THE FIX: Do NOT strip 'file://'. React Native's network layer requires it to locate the file!
        const fileUri = pdfFile.uri; 
        
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

      // THE FIX: Headers are safely restored
      const response = await api.post('/ai/generate-quiz', formData, {
        timeout: 120000,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

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
        if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
          correctIndex = 0;
        }

        return {
          ...emptyQuestion,
          id: `ai_${Date.now()}_${idx}`,
          format: q.format || 'multiple_choice',
          text: String(q.text || q.question || `Question ${idx + 1}`).trim(),
          points: Math.max(1, Number(q.points || 1)),
          options: options,
          correctIndex: correctIndex,
          matchingPairs: Array.isArray(q.matchingPairs) ? q.matchingPairs : [{ left: '', right: '' }, { left: '', right: '' }],
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [''],
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
    setQuestions([...questions, { ...emptyQuestion }]);
  };

  const changeQuestionFormat = (index, newFormat) => {
    const updated = [...questions];
    const q = updated[index];
    q.format = newFormat;
    
    if (newFormat === 'true_false') {
      q.options = ['True', 'False'];
      q.correctIndex = 0;
    } else if (newFormat === 'multiple_choice' && (!q.options || q.options.length !== 4)) {
      q.options = ['', '', '', ''];
      q.correctIndex = 0;
    } else if (newFormat === 'matching' && (!q.matchingPairs || q.matchingPairs.length === 0)) {
      q.matchingPairs = [{ left: '', right: '' }, { left: '', right: '' }];
    } else if (newFormat === 'identification' && (!q.acceptedAnswers || q.acceptedAnswers.length === 0)) {
      q.acceptedAnswers = [''];
    }
    
    setQuestions(updated);
  };

  const handleSubmitAssessment = async (status = 'published') => {
    if (!title.trim()) {
      return toastError('Please enter an assessment title.');
    }
    if (questions.length === 0) {
      return toastError('Please generate or add at least one question.');
    }

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
        createdBy: user?._id || null,
        scoreVisibility: settings.scoreVisibility || 'immediate',
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
          points: Math.max(1, Number(q.points || 1)),
          options: (q.format === 'multiple_choice' || q.format === 'true_false') ? (q.options || []).map((opt) => String(opt).trim()) : [],
          correctIndex: Number(q.correctIndex || 0),
          matchingPairs: q.format === 'matching' ? (q.matchingPairs || []).map((pair) => ({
            left: String(pair.left || '').trim(),
            right: String(pair.right || '').trim(),
          })) : [],
          acceptedAnswers: q.format === 'identification' ? (q.acceptedAnswers || []).map((answer) => String(answer).trim()).filter(Boolean) : [],
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme?.bg || '#F4F7F6' }]}
    >

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
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdownHeader}
                onPress={() => setShowLessonDropdown(!showLessonDropdown)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownHeaderText, selectedLessons.length > 0 && { color: '#10B981', fontWeight: '800' }]}>
                  {selectedLessons.length > 0
                    ? `${selectedLessons.length} Lesson(s) Selected`
                    : 'Select Lessons (Max 5)'}
                </Text>
                <Ionicons
                  name={showLessonDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {showLessonDropdown && (
                <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                  {availableLessons.map((lesson) => {
                    const isSelected = selectedLessons.some((l) => l._id === lesson._id);
                    return (
                      <TouchableOpacity
                        key={lesson._id}
                        style={styles.dropdownItem}
                        onPress={() => toggleLesson(lesson)}
                      >
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={22}
                          color={isSelected ? "#10B981" : "#CBD5E1"}
                        />
                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected && { color: '#10B981', fontWeight: '700' },
                          ]}
                          numberOfLines={2}
                        >
                          {lesson.title || 'Untitled Lesson'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
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

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formatScroll}>
                  {questionFormats.map(f => (
                    <TouchableOpacity 
                      key={f.key} 
                      style={[styles.formatChip, q.format === f.key && styles.formatChipActive]}
                      onPress={() => changeQuestionFormat(qIndex, f.key)}
                    >
                      <Text style={[styles.formatChipText, q.format === f.key && styles.formatChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TextInput
                  style={[styles.input, { marginBottom: 15, minHeight: 60 }]}
                  placeholder="Question text..."
                  value={q.text}
                  onChangeText={(t) => updateQuestion(qIndex, 'text', t)}
                  multiline
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.pointsRow}>
                  <Text style={[styles.label, { marginBottom: 0, color: '#153c2a' }]}>Points</Text>
                  <TextInput
                    style={styles.pointsInput}
                    keyboardType="number-pad"
                    value={q.points !== '' ? String(q.points) : ''}
                    onChangeText={(t) => {
                      const num = parseInt(t.replace(/[^0-9]/g, ''), 10);
                      updateQuestion(qIndex, 'points', isNaN(num) ? '' : num);
                    }}
                    onBlur={() => {
                      if (q.points === '' || q.points < 1) {
                        updateQuestion(qIndex, 'points', 1);
                      }
                    }}
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {q.format === 'multiple_choice' && (q.options || []).map((opt, oIndex) => (
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

                {q.format === 'true_false' && (
                  <View style={styles.tfRow}>
                    {['True', 'False'].map((choice, cIndex) => (
                      <TouchableOpacity 
                        key={cIndex}
                        style={[styles.tfBtn, q.correctIndex === cIndex && styles.tfBtnActive]}
                        onPress={() => updateQuestion(qIndex, 'correctIndex', cIndex)}
                      >
                        <Text style={[styles.tfBtnText, q.correctIndex === cIndex && styles.tfBtnTextActive]}>{choice}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {q.format === 'matching' && (
                  <View>
                    {(q.matchingPairs || []).map((pair, pIndex) => (
                      <View key={pIndex} style={styles.matchRow}>
                        <TextInput 
                            style={[styles.input, {flex: 1}]} 
                            placeholder="Prompt (Left)" 
                            value={pair.left} 
                            onChangeText={(t) => {
                              const newPairs = [...q.matchingPairs];
                              newPairs[pIndex].left = t;
                              updateQuestion(qIndex, 'matchingPairs', newPairs);
                            }}
                            placeholderTextColor="#94A3B8"
                        />
                        <TextInput 
                            style={[styles.input, {flex: 1}]} 
                            placeholder="Answer (Right)" 
                            value={pair.right} 
                            onChangeText={(t) => {
                              const newPairs = [...q.matchingPairs];
                              newPairs[pIndex].right = t;
                              updateQuestion(qIndex, 'matchingPairs', newPairs);
                            }}
                            placeholderTextColor="#94A3B8"
                        />
                      </View>
                    ))}
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => {
                      updateQuestion(qIndex, 'matchingPairs', [...(q.matchingPairs || []), {left: '', right: ''}]);
                    }}>
                      <Text style={styles.ghostBtnText}>+ Add Pair</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {q.format === 'identification' && (
                  <TextInput 
                    style={styles.input} 
                    placeholder="Expected Exact Answer" 
                    value={(q.acceptedAnswers || [''])[0]} 
                    onChangeText={(t) => updateQuestion(qIndex, 'acceptedAnswers', [t])}
                    placeholderTextColor="#94A3B8"
                  />
                )}

                {q.format === 'written' && (
                  <Text style={styles.instructionText}>
                    Written responses are graded manually by the professor in Student Monitoring.
                  </Text>
                )}
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
  studentViewText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
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
    borderRadius: 20,
    elevation: 2,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
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
    fontSize: 15,
    backgroundColor: '#F8FAFC',
    color: '#000',
    fontWeight: '600',
  },
  dropdownContainer: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8FAFC',
  },
  dropdownHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dropdownList: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFF',
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 12,
    flex: 1,
  },
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
    borderRadius: 20,
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
  formatScroll: { marginBottom: 15 },
  formatChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  formatChipActive: { backgroundColor: '#153c2a', borderColor: '#153c2a' },
  formatChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  formatChipTextActive: { color: '#FFF' },
  tfRow: { flexDirection: 'row', gap: 10, marginBottom: 5 },
  tfBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  tfBtnActive: { backgroundColor: '#E7F5EE', borderColor: '#10B981' },
  tfBtnText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  tfBtnTextActive: { color: '#10B981' },
  matchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  ghostBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, marginTop: 5 },
  ghostBtnText: { color: '#153c2a', fontWeight: '800', fontSize: 13 },
  instructionText: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 5, textAlign: 'center' },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pointsInput: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    color: '#000',
    fontWeight: '900',
    width: 80,
    textAlign: 'center',
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
    borderRadius: 15,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#153c2a',
    borderStyle: 'dashed',
  },
  addBtnText: { color: '#153c2a', fontWeight: '900', fontSize: 15 },
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
  draftBtnText: { color: '#64748B', fontSize: 15, fontWeight: 'bold' },
});