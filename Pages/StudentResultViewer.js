import React, { useState, useEffect, useContext } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    ScrollView, 
    TouchableOpacity, 
    ActivityIndicator, 
    Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../Pages/src/context/ThemeContext';
import api from '../Pages/src/services/api';

const extractArray = (resData) => {
    if (!resData) return [];
    if (Array.isArray(resData)) return resData;
    if (typeof resData === 'object') {
        if (Array.isArray(resData.data)) return resData.data;
        if (Array.isArray(resData.history)) return resData.history;
        if (resData.data?.data && Array.isArray(resData.data.data)) return resData.data.data;
    }
    return [];
};

const extractId = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return String(val).trim();
    if (typeof val === 'object') {
        if (val._id) return String(val._id).trim();
        if (val.id) return String(val.id).trim();
        return val.toString().trim();
    }
    return String(val).trim();
};

export default function StudentResultViewer({ route, navigation }) {
    const { assessmentId, submissionId } = route.params || {};
    const { theme } = useContext(ThemeContext);

    const [loading, setLoading] = useState(true);
    const [assessment, setAssessment] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResultData = async () => {
            if (!assessmentId) {
                setError("No assessment ID provided.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const rawUser = await AsyncStorage.getItem('user');
                const token = await AsyncStorage.getItem('token');
                if (!rawUser) throw new Error("Not logged in");

                const user = JSON.parse(rawUser);
                const config = { headers: { Authorization: `Bearer ${token}` } };

                const assessRes = await api.get(`/assessments/${assessmentId}?studentId=${user._id}&_t=${Date.now()}`, config);
                const assessmentData = assessRes.data?.data || assessRes.data;
                setAssessment(assessmentData);

                const historyRes = await api.get(`/student/${user._id}/assessment-history?_t=${Date.now()}`, config)
                    .catch(() => api.get(`/assessments/history/${user._id}?_t=${Date.now()}`, config))
                    .catch(() => ({ data: [] }));

                const historyList = extractArray(historyRes.data);

                let targetAttempt = null;
                if (submissionId) {
                    targetAttempt = historyList.find(h => extractId(h._id) === String(submissionId));
                }
                
                if (!targetAttempt) {
                    const attempts = historyList.filter(h => {
                        const hAssessId = extractId(h.assessmentId) || extractId(h.assessment);
                        return hAssessId === String(assessmentId);
                    });
                    attempts.sort((a, b) => new Date(b.submittedAt || b.createdAt || b.updatedAt || 0) - new Date(a.submittedAt || a.createdAt || a.updatedAt || 0));
                    targetAttempt = attempts.length > 0 ? attempts[0] : null;
                }

                if (!targetAttempt && assessmentData?.latestAttempt) {
                    targetAttempt = assessmentData.latestAttempt;
                }

                if (targetAttempt?._id && (!Array.isArray(targetAttempt.answers) || targetAttempt.answers.length === 0)) {
                    try {
                        let detailRes = await api.get(`/instructor/attempts/${targetAttempt._id}`, config).catch(() => null);
                        if (!detailRes) {
                            detailRes = await api.get(`/attempts/${targetAttempt._id}`, config).catch(() => null);
                        }
                        if (detailRes?.data?.data?.answers) {
                            targetAttempt.answers = detailRes.data.data.answers;
                        }
                    } catch (e) {
                        console.log("Could not fetch detailed attempt answers", e);
                    }
                }

                if (targetAttempt) {
                    setResult(targetAttempt);
                } else {
                    setError("No submission record found for this assessment.");
                }
            } catch (err) {
                console.error("Error fetching results:", err);
                setError("Failed to load results. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchResultData();
    }, [assessmentId, submissionId]);

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: theme?.bg || '#F8F9FA' }]}>
                <ActivityIndicator size="large" color="#153c2a" />
                <Text style={{ marginTop: 10, color: '#64748B' }}>Loading your results...</Text>
            </View>
        );
    }

    if (error || !assessment || !result) {
        return (
            <View style={[styles.centered, { backgroundColor: theme?.bg || '#F8F9FA', padding: 20 }]}>
                <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
                <Text style={styles.errorText}>{error || "Something went wrong."}</Text>
                <TouchableOpacity style={styles.backBtnFallback} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnTextFallback}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isExternal = assessment.deliveryMode === 'external' || result.submissionMode === 'external';
    const isPendingScore = Boolean(result.scorePending) || (result.score === null && result.total === null);
    const isPassed = (result.percent || 0) >= 50;

    return (
        <View style={[styles.container, { backgroundColor: theme?.bg || '#F8F9FA' }]}>
            <View style={styles.greenHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitleText} numberOfLines={1}>
                        RESULT: {assessment.title ? assessment.title.toUpperCase() : 'ASSESSMENT'}
                    </Text>
                    <Text style={styles.headerSubText}>Detailed Score & Breakdown</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

                {isPendingScore ? (
                    <View style={styles.pendingCard}>
                        <Ionicons name="time-outline" size={40} color="#D97706" style={{ marginBottom: 8 }} />
                        <Text style={styles.pendingTitle}>Submission Under Review</Text>
                        <Text style={styles.pendingSub}>Your submission has been recorded. Your instructor will grade your work soon.</Text>
                        <Text style={styles.dateText}>
                            Submitted: {new Date(result.submittedAt || result.createdAt).toLocaleString()}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.summaryCard}>
                        <View style={styles.scoreCircle}>
                            <Text style={styles.scoreText}>{result.score ?? 0}</Text>
                            <View style={styles.scoreDivider} />
                            <Text style={styles.totalText}>{result.total || assessment.questions?.length || 100}</Text>
                        </View>
                        <View style={styles.summaryDetails}>
                            <Text style={styles.percentText}>{Math.round(result.percent || 0)}%</Text>
                            <View style={[styles.statusBadge, { backgroundColor: isPassed ? '#D1FAE5' : '#FEE2E2' }]}>
                                <Text style={[styles.statusText, { color: isPassed ? '#059669' : '#DC2626' }]}>
                                    {isPassed ? 'Passed' : 'Needs Review'}
                                </Text>
                            </View>
                            <Text style={styles.dateText}>
                                Submitted: {new Date(result.submittedAt || result.createdAt).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                )}

                {(result.professorFeedback || result.feedback) && (
                    <View style={styles.feedbackCard}>
                        <Ionicons name="chatbubbles-outline" size={20} color="#153c2a" style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.feedbackLabel}>Feedback:</Text>
                            <Text style={styles.feedbackText}>{result.professorFeedback || result.feedback}</Text>
                        </View>
                    </View>
                )}

                {isExternal ? (
                    <View style={styles.externalCard}>
                        <Ionicons name="globe-outline" size={32} color="#153c2a" style={{ marginBottom: 6 }} />
                        <Text style={styles.externalTitle}>External Submission</Text>
                        <Text style={styles.externalDesc}>This assessment was completed via an external link. All answers were recorded on the third-party platform.</Text>
                    </View>
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>Detailed Breakdown</Text>

                        {(!Array.isArray(result.answers) || result.answers.length === 0) ? (
                            <View style={styles.emptyQuestionsCard}>
                                <Ionicons name="document-lock-outline" size={48} color="#CBD5E1" style={{ marginBottom: 10 }} />
                                <Text style={styles.emptyQuestionsTitle}>Answers Unavailable</Text>
                                <Text style={styles.emptyQuestionsText}>The detailed answer breakdown is not available or has been hidden for this assessment.</Text>
                            </View>
                        ) : (
                            Array.isArray(assessment.questions) && assessment.questions.map((q, index) => {
                                const qId = extractId(q._id) || extractId(q.id) || String(index);

                                let studentAnswerObj = result.answers.find(a => {
                                    const aQid = extractId(a.questionId) || extractId(a.question);
                                    return aQid === qId;
                                });
                                
                                if (!studentAnswerObj && result.answers.length > index) {
                                    studentAnswerObj = result.answers[index];
                                }
                                
                                const isCorrect = Boolean(studentAnswerObj?.isCorrect);

                                let studentAnswerText = studentAnswerObj?.userAnswer || studentAnswerObj?.answerText || studentAnswerObj?.answer;
                                
                                if (!studentAnswerText && studentAnswerObj?.selectedIndex !== undefined && studentAnswerObj.selectedIndex !== -1 && Array.isArray(q.options)) {
                                    studentAnswerText = q.options[studentAnswerObj.selectedIndex];
                                }
                                
                                if (studentAnswerText === null || studentAnswerText === undefined || String(studentAnswerText).trim() === '') {
                                    studentAnswerText = 'No Answer';
                                } else {
                                    studentAnswerText = String(studentAnswerText);
                                }

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

                                const questionPrompt = q.questionText || q.text || q.question || `Question ${index + 1}`;

                                return (
                                    <View key={qId} style={[styles.questionCard, { borderColor: isCorrect ? '#34D399' : '#F87171' }]}>
                                        <View style={styles.qHeader}>
                                            <Text style={styles.qNumber}>Question {index + 1}</Text>
                                            <Ionicons 
                                                name={isCorrect ? "checkmark-circle" : "close-circle"} 
                                                size={24} 
                                                color={isCorrect ? "#10B981" : "#EF4444"} 
                                            />
                                        </View>
                                        
                                        <Text style={styles.qText}>{questionPrompt}</Text>
                                        
                                        <View style={styles.answerBox}>
                                            <Text style={styles.answerLabel}>Your Answer:</Text>
                                            <Text style={[styles.answerValue, { color: isCorrect ? '#10B981' : '#EF4444' }]}>
                                                {studentAnswerText}
                                            </Text>
                                        </View>

                                        {!isCorrect && correctAnswerText && (
                                            <View style={[styles.answerBox, { marginTop: 8, backgroundColor: '#F1F5F9' }]}>
                                                <Text style={styles.answerLabel}>Correct Answer:</Text>
                                                <Text style={[styles.answerValue, { color: '#153c2a' }]}>
                                                    {correctAnswerText}
                                                </Text>
                                            </View>
                                        )}

                                        {q.explanation && (
                                            <View style={styles.explanationBox}>
                                                <Text style={styles.explanationLabel}>Explanation:</Text>
                                                <Text style={styles.explanationText}>{q.explanation}</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    greenHeader: { backgroundColor: '#153c2a', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
    backIconBtn: { position: 'absolute', left: 20, top: Platform.OS === 'ios' ? 60 : 40, zIndex: 10, padding: 5 },
    headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 40 },
    headerTitleText: { fontSize: 16, fontWeight: '900', color: '#FFF', textAlign: 'center', letterSpacing: 0.5 },
    headerSubText: { fontSize: 12, color: '#A7F3D0', fontWeight: '600', marginTop: 4, textAlign: 'center' },
    
    scrollContainer: { padding: 20 },
    errorText: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 12, marginBottom: 20 },
    backBtnFallback: { backgroundColor: '#153c2a', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
    backBtnTextFallback: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    
    summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, borderWidth: 1, borderColor: '#F1F5F9' },
    pendingCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
    pendingTitle: { fontSize: 18, fontWeight: '800', color: '#92400E', marginBottom: 4 },
    pendingSub: { fontSize: 13, color: '#B45309', textAlign: 'center', marginBottom: 8, lineHeight: 18 },
    scoreCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, borderColor: '#153c2a', justifyContent: 'center', alignItems: 'center', marginRight: 18 },
    scoreText: { fontSize: 26, fontWeight: '900', color: '#153c2a' },
    scoreDivider: { width: '40%', height: 2, backgroundColor: '#E2E8F0', marginVertical: 2 },
    totalText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
    summaryDetails: { flex: 1 },
    percentText: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginBottom: 4 },
    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
    statusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
    dateText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
    
    feedbackCard: { backgroundColor: '#E7F5EE', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
    feedbackLabel: { fontSize: 12, fontWeight: '800', color: '#153c2a', textTransform: 'uppercase', marginBottom: 2 },
    feedbackText: { fontSize: 13, color: '#153c2a', fontWeight: '600', lineHeight: 18 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
    
    externalCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
    externalTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    externalDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },

    emptyQuestionsCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
    emptyQuestionsTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
    emptyQuestionsText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
    
    questionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1.5, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    qNumber: { fontSize: 13, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' },
    qText: { fontSize: 15, color: '#1E293B', fontWeight: '700', marginBottom: 14, lineHeight: 22 },
    answerBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    answerLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    answerValue: { fontSize: 14, fontWeight: '800', flexShrink: 1, textAlign: 'right', marginLeft: 10 },
    explanationBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    explanationLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    explanationText: { fontSize: 13, color: '#475569', fontStyle: 'italic' }
});