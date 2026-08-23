import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Platform, StatusBar, FlatList, Image, Modal, TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { WebView } from 'react-native-webview';

const getInitials = (name) => {
  if (!name) return 'S';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const extractArray = (resData) => {
    if (!resData) return [];
    if (Array.isArray(resData)) return resData;
    if (typeof resData === 'object') {
        if (Array.isArray(resData.data)) return resData.data;
        if (Array.isArray(resData.history)) return resData.history;
        if (Array.isArray(resData.attempts)) return resData.attempts;
        if (resData.data?.data && Array.isArray(resData.data.data)) return resData.data.data;
        if (resData.data?.attempts && Array.isArray(resData.data.attempts)) return resData.data.attempts;
    }
    return [];
};

const extractId = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return String(val).trim();
    if (typeof val === 'object') {
        if (val._id) return String(val._id).trim();
        if (val.id) return String(val.id).trim();
        return String(val).trim();
    }
    return String(val).trim();
};

export default function AssessmentQuestionsView({ route, navigation }) {
  const { assessment } = route.params;
  const { theme } = useContext(ThemeContext);
  
  const [activeSubTab, setActiveSubTab] = useState('questions'); 
  const [studentStatusList, setStudentStatusList] = useState([]);
  const [rawMappedList, setRawMappedList] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState('default');

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentAttempt, setStudentAttempt] = useState(null);
  const [isGradingModalVisible, setGradingModalVisible] = useState(false);
  
  const [gradingScore, setGradingScore] = useState('');
  const [gradingTotal, setGradingTotal] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState(''); 
  
  const [isFetchingAttempt, setIsFetchingAttempt] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const isExternalAssess = assessment?.deliveryMode === 'external' || assessment?.isExternal;

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  useEffect(() => {
    let result = [...rawMappedList];
    if (filterMode === 'pending') {
      result = result.filter(s => !s.hasTaken);
    } else if (filterMode === 'complete') {
      result = result.filter(s => s.hasTaken);
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }
    setStudentStatusList(result);
  }, [filterMode, rawMappedList]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      const rawUser = await AsyncStorage.getItem('user');
      const currentUser = rawUser ? JSON.parse(rawUser) : null;
      
      const config = {};
      const token = await AsyncStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const res = await api.get('/instructor/assessment-monitoring', {
          ...config,
          params: { instructorId: currentUser?._id }
      }); 
      
      const allData = res.data?.data || [];

      let filteredList = allData;
      if (assessment.targetSections?.length > 0) {
        filteredList = allData.filter(student => {
          const studentSection = String(student.section || '').toUpperCase();
          return assessment.targetSections.some(target => 
            String(target).toUpperCase() === studentSection || studentSection.includes(String(target).toUpperCase())
          );
        });
      }

      const mapped = filteredList.map(item => {
        const quizRecord = item.assessments?.find(a => extractId(a.assessmentId) === extractId(assessment._id));
        return {
          _id: item.studentId || item._id, 
          name: item.studentName || item.fname,
          yearLevel: item.yearLevel,
          section: item.section,
          avatar: item.avatar,
          hasTaken: !!quizRecord,
          percent: quizRecord ? quizRecord.lastPercent : null,
          rawScore: quizRecord ? quizRecord.lastScore : 0,
          totalItems: quizRecord ? quizRecord.lastTotal : (assessment.questions?.length || 0),
          attempts: quizRecord ? quizRecord.takeCount : 0, 
          quizRecord: quizRecord || null 
        };
      });

      setRawMappedList(mapped);
    } catch (e) {
      toastError("Failed to sync student status.");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentPress = async (student) => {
        if (!student.hasTaken && !isExternalAssess) {
            toastError("Student has not submitted this assessment yet.");
            return;
        }

        setSelectedStudent(student);
        setGradingModalVisible(true);
        setIsFetchingAttempt(true);
        
        setGradingScore(String(student.rawScore || 0));
        setGradingTotal(String(student.totalItems || assessment.questions?.length || 100));
        setReviewFeedback('');

        try {
            const token = await AsyncStorage.getItem('token');
            const config = { headers: {} };
            if (token) config.headers.Authorization = `Bearer ${token}`;

            const rawUser = await AsyncStorage.getItem('user');
            const currentUser = rawUser ? JSON.parse(rawUser) : null;
            const instId = currentUser?._id || '';

            const assessId = extractId(assessment._id);
            const studentId = extractId(student._id);

            let attemptIdToFetch = student.quizRecord?.attemptId || student.quizRecord?.lastAttemptId || student.quizRecord?.submissionId;

            if (!attemptIdToFetch) {
                const listRes = await api.get(`/instructor/assessments/${assessId}/attempts`, {
                    headers: config.headers,
                    params: { instructorId: instId }
                }).catch(() => null);

                let allAttempts = listRes?.data?.data || listRes?.data || [];
                if (!Array.isArray(allAttempts)) allAttempts = [];

                const stdAttempts = allAttempts.filter(a => extractId(a.studentId) === studentId || extractId(a.userId) === studentId);
                stdAttempts.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

                if (stdAttempts.length > 0) {
                    attemptIdToFetch = stdAttempts[0]._id || stdAttempts[0].attemptId;
                }
            }

            let finalAttempt = student.quizRecord || {};
            finalAttempt.answers = [];

            if (attemptIdToFetch) {
                let detailRes = await api.get(`/instructor/attempts/${attemptIdToFetch}`, { headers: config.headers }).catch(() => null);

                if (!detailRes) {
                    detailRes = await api.get(`/attempts/${attemptIdToFetch}`, { headers: config.headers }).catch(() => null);
                }

                let dData = detailRes?.data?.data || detailRes?.data;
                if (dData) {
                    finalAttempt = { ...finalAttempt, ...dData };
                    let rawAns = dData.answers || finalAttempt.answers || [];

                    if (typeof rawAns === 'string') {
                        try { rawAns = JSON.parse(rawAns); } catch(e) { rawAns = []; }
                    }
                    
                    if (Array.isArray(rawAns)) {
                        finalAttempt.answers = rawAns;
                    }
                }
            }

            const isValidAttempt = finalAttempt._id || finalAttempt.attemptId || attemptIdToFetch || isExternalAssess;

            if (isValidAttempt) {
                setStudentAttempt(finalAttempt);
                
                const finalScore = finalAttempt.score !== undefined && finalAttempt.score !== null ? finalAttempt.score : (student.rawScore || 0);
                const finalTotal = finalAttempt.total || student.totalItems || assessment.questions?.length || 100;
                
                setGradingScore(String(finalScore));
                setGradingTotal(String(finalTotal));
                setReviewFeedback(finalAttempt.professorFeedback || finalAttempt.feedback || '');
            } else {
                setStudentAttempt(null);
                toastError("Could not retrieve detailed submission record.");
            }

        } catch (error) {
            console.error("Error fetching attempt:", error);
            toastError("Failed to fetch student's full submission.");
        } finally {
            setIsFetchingAttempt(false);
        }
  }; 

  const submitGrade = async () => {
    let attemptId = studentAttempt?._id || studentAttempt?.attemptId || studentAttempt?.id;
    
    if (!isExternalAssess) {
        toastError("Native assessments are auto-graded and cannot be manually adjusted.");
        return;
    }
    
    try {
        setIsSavingGrade(true);
        const config = {};
        const token = await AsyncStorage.getItem('token');
        if (token) config.headers = { Authorization: `Bearer ${token}` };

        const rawUser = await AsyncStorage.getItem('user');
        const currentUser = rawUser ? JSON.parse(rawUser) : null;

        if (isExternalAssess && !attemptId) {
            try {
                const createRes = await api.post(`/assessments/${assessment._id}/external-submit`, {
                    studentId: selectedStudent?._id
                }, config);
                const newAttempt = createRes.data?.data || createRes.data;
                attemptId = newAttempt?._id || newAttempt?.id;
                
                if (!attemptId) throw new Error("Failed to generate backend attempt record.");
            } catch (err) {
                toastError("Could not generate a valid submission record to grade.");
                setIsSavingGrade(false);
                return;
            }
        }

        const endpoint = `/instructor/attempts/${attemptId}/external-score`;
        const payload = {
            instructorId: currentUser?._id,
            studentId: selectedStudent?._id,
            score: Number(gradingScore || 0),
            total: Number(gradingTotal || assessment?.questions?.length || 10),
            professorFeedback: reviewFeedback,
            feedback: reviewFeedback
        };

        await api.put(endpoint, payload, config);
        
        toastSuccess("Score and feedback updated successfully.");
        setGradingModalVisible(false);
        fetchMonitoringData(); 
    } catch (error) {
        console.error("Grading error", error?.response?.data || error.message);
        const errorMsg = error?.response?.data?.message || error?.response?.data?.error || "Failed to update score.";
        toastError(errorMsg);
    } finally {
        setIsSavingGrade(false);
    }
  };

  const renderStudentItem = ({ item }) => {
    const isPassing = item.percent >= (assessment.passingScore || 70);

    return (
      <TouchableOpacity 
        style={[localStyles.studentCard, { backgroundColor: theme.card }]}
        onPress={() => handleStudentPress(item)}
      >
        <View style={localStyles.rowLeft}>
          {item.avatar ? (
            <Image source={{ uri: toAbsUrl(item.avatar) }} style={localStyles.avatar} />
          ) : (
            <View style={localStyles.initialsCircle}>
              <Text style={localStyles.initialsText}>{getInitials(item.name)}</Text>
            </View>
          )}
          
          <View style={{ flex: 1 }}>
            <Text style={[localStyles.studentName, { color: theme.text }]}>
              {item.name.toUpperCase()}
            </Text>
            <Text style={localStyles.studentMeta}>{item.yearLevel} • {item.section}</Text>
          </View>
        </View>
        
        <View style={localStyles.rowRight}>
          {item.hasTaken ? (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={localStyles.statusBadgeSuccess}>
                <Text style={localStyles.statusTextSuccess}>COMPLETED</Text>
              </View>

              <Text style={[localStyles.scoreText, { color: isPassing ? '#10B981' : '#EF4444' }]}>
                {item.rawScore} / {item.totalItems}
              </Text>
              <Text style={localStyles.attemptMeta}>
                {item.percent}% Grade • {item.attempts} {item.attempts === 1 ? 'attempt' : 'attempts'}
              </Text>

            </View>
          ) : (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={localStyles.statusBadgePending}>
                <Text style={localStyles.statusTextPending}>PENDING</Text>
              </View>
              <Text style={localStyles.attemptMeta}>No records found</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      <View style={localStyles.header}>
        <View style={localStyles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={[localStyles.headerTextContainer, {alignItems: 'center', justifyContent: 'center'}]}>
            <Text style={localStyles.headerTitle}>Assessment Details</Text>
            <Text style={localStyles.headerSubtitle}>
              Track assessment results and view assessment questions
            </Text>
          </View>
        </View>
      </View>

      <View style={localStyles.tabBar}>
        <TouchableOpacity onPress={() => setActiveSubTab('questions')} style={[localStyles.tab, activeSubTab === 'questions' && localStyles.activeTab]}>
          <Text style={[localStyles.tabLabel, { color: activeSubTab === 'questions' ? '#153c2a' : '#64748B' }]}>ASSESSMENT QUESTIONS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveSubTab('takes')} style={[localStyles.tab, activeSubTab === 'takes' && localStyles.activeTab]}>
          <Text style={[localStyles.tabLabel, { color: activeSubTab === 'takes' ? '#153c2a' : '#64748B' }]}>ASSESSMENT RESULT</Text>
        </TouchableOpacity>
      </View>

      <View style={localStyles.titleSection}>
        <Text style={localStyles.assessmentTitle}>{assessment.title}</Text>
      </View>

      {activeSubTab === 'takes' && (
        <View style={localStyles.filterContainer}>
          <Text style={localStyles.filterPrefix}>Sort by:</Text>
          {['default', 'pending', 'complete'].map((mode) => (
            <TouchableOpacity 
              key={mode} 
              onPress={() => setFilterMode(mode)} 
              style={[localStyles.filterBtn, filterMode === mode && localStyles.filterBtnActive]}
            >
              <Text style={[localStyles.filterBtnText, { color: filterMode === mode ? '#fff' : '#64748B' }]}>
                {mode === 'default' ? 'ALL' : mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeSubTab === 'questions' ? (
        isExternalAssess && assessment?.externalUrl ? (
          <View style={{ flex: 1, minHeight: 500, marginHorizontal: 22, marginBottom: 30, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' }}>
            <WebView 
              source={{ uri: assessment.externalUrl }} 
              style={{ flex: 1 }} 
              startInLoadingState={true}
              renderLoading={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#153c2a" />
                </View>
              )}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 30 }}>
            {(assessment?.questions || []).map((q, idx) => (
              <View key={idx} style={[localStyles.qCard, { backgroundColor: theme.card }]}>
                <Text style={[localStyles.qText, { color: theme.text }]}>{idx + 1}. {q.text || q.questionText}</Text>
                {(q.options || []).map((opt, i) => (
                  <View key={i} style={localStyles.optRow}>
                    <Ionicons 
                      name={q.correctIndex === i ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={q.correctIndex === i ? "#10B981" : "#ccc"} 
                    />
                    <Text style={[localStyles.optText, q.correctIndex === i && { color: '#10B981', fontWeight: 'bold' }]}>{opt}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        <View style={{ flex: 1 }}>
          {loading ? <ActivityIndicator size="large" color="#153c2a" style={{ marginTop: 40 }} /> : (
            <FlatList 
              data={studentStatusList} 
              keyExtractor={(item) => String(item._id)} 
              renderItem={renderStudentItem} 
              contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 30 }} 
              ListEmptyComponent={<Text style={localStyles.emptyText}>No students found for this filter.</Text>}
            />
          )}
        </View>
      )}

      {/* MODAL BOTTOM SHEET */}
      <Modal visible={isGradingModalVisible} transparent animationType="slide">
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.gradingModalCard}>
            
            <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle} numberOfLines={1}>
                    {selectedStudent?.name}'s Result
                </Text>
                <TouchableOpacity onPress={() => setGradingModalVisible(false)} style={localStyles.closeIconBg}>
                  <Ionicons name="close" size={20} color="#153c2a" />
                </TouchableOpacity>
            </View>

            {isFetchingAttempt ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#153c2a" />
                  <Text style={{ marginTop: 10, color: '#64748B' }}>Loading details...</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1, backgroundColor: theme.bg || '#FFF' }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                
                {isExternalAssess ? (
                    <View style={localStyles.externalNotice}>
                      <Ionicons name="link-outline" size={24} color="#D97706" style={{ marginBottom: 5 }} />
                      <Text style={{ color: '#D97706', fontWeight: 'bold', fontSize: 16 }}>External Assessment</Text>
                      <Text style={{ color: '#92400E', fontSize: 13, marginTop: 5, textAlign: 'center' }}>
                        Review the student's submission on the external platform, then input their final score below.
                      </Text>
                    </View>
                ) : (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={localStyles.sectionHeading}>Student Answers</Text>
                      
                      {(!Array.isArray(assessment?.questions) || assessment.questions.length === 0) ? (
                          <View style={localStyles.emptyQuestionsCard}>
                              <Ionicons name="document-lock-outline" size={48} color="#CBD5E1" style={{ marginBottom: 10 }} />
                              <Text style={localStyles.emptyQuestionsTitle}>Questions Unavailable</Text>
                              <Text style={localStyles.emptyQuestionsText}>This assessment does not have any native questions to display.</Text>
                          </View>
                      ) : (
                          assessment.questions.map((q, idx) => {
                            // 1. Exact ID Extraction (Mirroring StudentResultViewer)
                            const qId = extractId(q._id) || extractId(q.id) || String(idx);

                            let studentAnsObj = (studentAttempt?.answers || []).find(a => {
                                const aQid = extractId(a.questionId) || extractId(a.question);
                                return aQid === qId;
                            });
                            
                            // 2. Strict Fallback Index Matching
                            if (!studentAnsObj && Array.isArray(studentAttempt?.answers) && studentAttempt.answers.length > idx) {
                                studentAnsObj = studentAttempt.answers[idx];
                            }
                            
                            // 3. Exact Text / Index Resolution 
                            let studentAnsText = studentAnsObj?.userAnswer || studentAnsObj?.answerText || studentAnsObj?.answer;
                            
                            if (!studentAnsText && studentAnsObj?.selectedIndex !== undefined && studentAnsObj.selectedIndex !== -1 && Array.isArray(q.options)) {
                                studentAnsText = q.options[studentAnsObj.selectedIndex];
                            }
                            
                            // 4. Strict Empty Check
                            if (studentAnsText === null || studentAnsText === undefined || String(studentAnsText).trim() === '') {
                                studentAnsText = 'No Answer';
                            } else {
                                studentAnsText = String(studentAnsText);
                            }

                            // 5. Correct Answer Resolution
                            let correctAnswerText = q.correctAnswer;
                            if (!correctAnswerText && Array.isArray(q.options) && q.correctIndex !== undefined) {
                                correctAnswerText = q.options[q.correctIndex];
                            }
                            if (!correctAnswerText && Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0) {
                                correctAnswerText = q.acceptedAnswers.join(' / ');
                            }
                            if (!correctAnswerText && Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0) {
                                correctAnswerText = q.matchingPairs.map(p => `${p.left} -> ${p.right}`).join(', ');
                            }

                            // Dynamic Correctness Evaluator (Needed for Instructor view custom highlights)
                            let isCorrect = Boolean(studentAnsObj?.isCorrect);
                            if (!isCorrect && studentAnsText !== 'No Answer' && correctAnswerText) {
                                const cleanStudentAns = String(studentAnsText).toLowerCase().trim();
                                const cleanCorrectAns = String(correctAnswerText).toLowerCase().trim();
                                if (q.format === 'identification' || q.format === 'written') {
                                    const accepted = q.acceptedAnswers?.length > 0 ? q.acceptedAnswers : [q.correctAnswer];
                                    isCorrect = accepted.some(ans => String(ans).toLowerCase().trim() === cleanStudentAns);
                                } else {
                                    isCorrect = cleanStudentAns === cleanCorrectAns;
                                }
                            }
                            
                            const questionPrompt = q.questionText || q.text || q.question || `Question ${idx + 1}`;
                            
                            return (
                                <View key={qId} style={[localStyles.answerCard, { 
                                    backgroundColor: theme.card || '#FFF', 
                                    borderColor: isCorrect ? '#34D399' : '#F87171' 
                                }]}>
                                    <Text style={[localStyles.qText, { color: theme.text || '#000' }]}>{idx + 1}. {questionPrompt}</Text>
                                    <View style={localStyles.answerBox}>
                                        <Text style={localStyles.answerLabel}>Student's Answer:</Text>
                                        <Text style={[localStyles.answerValue, { color: isCorrect ? '#10B981' : '#EF4444' }]}>
                                            {studentAnsText}
                                        </Text>
                                    </View>
                                    {!isCorrect && correctAnswerText && (
                                        <View style={[localStyles.answerBox, { marginTop: 5, backgroundColor: '#F1F5F9' }]}>
                                            <Text style={localStyles.answerLabel}>Correct Answer:</Text>
                                            <Text style={[localStyles.answerValue, { color: '#475569' }]}>
                                                {correctAnswerText}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                          })
                    )}
                  </View>
                )}

                {isExternalAssess && (
                    <>
                        <Text style={localStyles.sectionHeading}>Adjust Score & Feedback</Text>
                        <View style={localStyles.settingCard}>
                            <View style={localStyles.scoreInputRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={localStyles.inputLabel}>Score</Text>
                                <TextInput 
                                  style={[localStyles.scoreInput, { backgroundColor: theme.card || '#FFF', color: theme.text }]}
                                  value={gradingScore}
                                  onChangeText={setGradingScore}
                                  keyboardType="numeric"
                                />
                              </View>
                              <Text style={[localStyles.scoreDivider, { color: theme.text }]}>/</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={localStyles.inputLabel}>Total Items</Text>
                                <TextInput 
                                  style={[localStyles.scoreInput, { backgroundColor: theme.card || '#FFF', color: theme.text }]}
                                  value={gradingTotal}
                                  onChangeText={setGradingTotal}
                                  keyboardType="numeric"
                                />
                              </View>
                            </View>

                            <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                                <Text style={localStyles.inputLabel}>Instructor Feedback (Optional)</Text>
                                <TextInput 
                                  style={[localStyles.scoreInput, { backgroundColor: theme.card || '#FFF', color: theme.text, height: 100, textAlignVertical: 'top', textAlign: 'left', fontSize: 15, fontWeight: '500' }]}
                                  value={reviewFeedback}
                                  onChangeText={setReviewFeedback}
                                  multiline
                                  placeholder="Add comments here..."
                                  placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>

                        <TouchableOpacity 
                           style={[localStyles.saveBtn, isSavingGrade && { opacity: 0.7 }]} 
                           onPress={submitGrade}
                           disabled={isSavingGrade}
                        >
                          {isSavingGrade ? (
                            <ActivityIndicator color="#FFF" />
                          ) : (
                            <Text style={localStyles.saveBtnText}>Save Changes</Text>
                          )}
                        </TouchableOpacity>
                    </>
                )}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { 
    backgroundColor: '#153c2a', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 20, 
    borderBottomLeftRadius: 10, 
    borderBottomRightRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10, 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 10
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  headerTitle: { 
    fontSize: 25, 
    fontWeight: '900', 
    color: '#fff',
  },
  headerSubtitle: { 
    fontSize: 13, 
    color: '#d1fae5', 
    marginTop: 2 
  },
  tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', marginHorizontal: 22, marginTop: 20, marginBottom: 10, borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabLabel: { fontSize: 13, fontWeight: '800' },
  titleSection: { paddingHorizontal: 22, paddingBottom: 15, paddingTop: 5 },
  titleLabel: { fontSize: 13, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 2 },
  assessmentTitle: { fontSize: 20, fontWeight: '900', color: '#153c2a' },

  filterContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginBottom: 15 },
  filterPrefix: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginRight: 10, textTransform: 'uppercase' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#153c2a' },
  filterBtnText: { fontSize: 13, fontWeight: '700' },

  studentCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, marginBottom: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  initialsCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E7F5EE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  initialsText: { color: '#153c2a', fontSize: 20, fontWeight: '900' },
  studentName: { fontSize: 13.5, fontWeight: '900' },
  studentMeta: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  rowRight: { justifyContent: 'center' },
  scoreText: { fontSize: 20, fontWeight: '900' },
  attemptMeta: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  statusBadgeSuccess: { backgroundColor: '#E1F8F0', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  statusTextSuccess: { fontSize: 12, fontWeight: '900', color: '#10B981' },
  statusBadgePending: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  statusTextPending: { fontSize: 12, fontWeight: '900', color: '#64748B' },
  
  qCard: { padding: 18, borderRadius: 10, marginBottom: 15, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  qText: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  optText: { marginLeft: 10, fontSize: 14, color: '#475569' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94A3B8', fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  gradingModalCard: { height: '85%', backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#153c2a' },
  modalTitle: { fontSize: 20, fontWeight: '900', flexShrink: 1, marginRight: 10, color: '#FFF' },
  closeIconBg: { backgroundColor: '#F1F5F9', padding: 8, borderRadius: 20 },
  
  sectionHeading: { fontSize: 15, fontWeight: '900', color: '#153c2a', marginBottom: 10, textTransform: 'uppercase' },
  settingCard: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  
  answerCard: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  answerBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginTop: 10 },
  answerLabel: { fontSize: 12, color: '#64748B', fontWeight: '700', marginBottom: 4 },
  answerValue: { fontSize: 14, fontWeight: '800' },
  externalNotice: { backgroundColor: '#FEF3C7', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  scoreInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  inputLabel: { fontSize: 13, fontWeight: '800', color: '#475569', marginBottom: 8 },
  scoreInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 15, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  scoreDivider: { fontSize: 28, fontWeight: '900', marginHorizontal: 15, marginTop: 25 },
  saveBtn: { backgroundColor: '#153c2a', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },

  emptyQuestionsCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  emptyQuestionsTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  emptyQuestionsText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 }
});