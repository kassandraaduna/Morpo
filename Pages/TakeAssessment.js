import React, { useEffect, useState, useContext, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, ActivityIndicator, 
    Alert, StyleSheet, Platform, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function TakeAssessment({ route, navigation }) {
    const { assessmentId } = route.params;
    const { theme } = useContext(ThemeContext);
    
    const [studentId, setStudentId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [assessment, setAssessment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    const [answers, setAnswers] = useState({});
    const answersRef = useRef({}); 
    const [result, setResult] = useState(null);

    const [secondsLeft, setSecondsLeft] = useState(null);
    const timerRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            try {
                const userRaw = await AsyncStorage.getItem('user');
                const user = JSON.parse(userRaw);
                setStudentId(user._id);
                setCurrentUser(user);

                const res = await api.get(`/assessments/${assessmentId}?studentId=${user._id}`);
                const data = res.data?.data;
                setAssessment(data);

                if (data?.timer?.enabled && data?.timer?.minutes) {
                    setSecondsLeft(data.timer.minutes * 60);
                }
            } catch (err) {
                toastError("Failed to load assessment.");
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };
        init();
        return () => clearInterval(timerRef.current);
    }, [assessmentId]);

    useEffect(() => {
        if (secondsLeft === null) return;
        if (secondsLeft <= 0) {
            clearInterval(timerRef.current);
            Alert.alert("Time's Up!", "Your assessment is being submitted automatically.", [
                { text: "OK", onPress: executeSubmit }
            ]);
            return;
        }

        timerRef.current = setInterval(() => {
            setSecondsLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [secondsLeft]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleBackPress = () => {
        Alert.alert(
            "Exit Assessment?",
            "If you leave now, your current answers will be submitted automatically.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Submit & Exit", 
                    style: "destructive", 
                    onPress: executeSubmit 
                }
            ]
        );
    };

    const confirmSubmit = () => {
        Alert.alert(
            "Submit Assessment?",
            "Are you sure you are ready to submit your answers? You cannot change them after submission.",
            [
                { text: "Review", style: "cancel" },
                { text: "Submit", onPress: executeSubmit }
            ]
        );
    };

    const executeSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        clearInterval(timerRef.current);
        
        const currentAnswers = answersRef.current;

        const isPractice = String(assessment?.createdBy) === String(currentUser?._id);

        if (isPractice) {
            let score = 0;
            let total = 0;
            
            assessment.questions.forEach(q => {
                total += q.points || 1;
                if (currentAnswers[q._id] === q.correctIndex) {
                    score += q.points || 1;
                }
            });
            
            const percent = total > 0 ? Math.round((score / total) * 100) : 0;
            
            const attempt = {
                score, 
                total, 
                percent,
                feedback: percent >= 70 ? 'Great job on your practice!' : 'Keep practicing to improve.'
            };

            const rawHistory = await AsyncStorage.getItem('studentPracticeAssessmentHistory_v1');
            const history = rawHistory ? JSON.parse(rawHistory) : {};
            if (!history[assessmentId]) history[assessmentId] = [];
            history[assessmentId].unshift({ ...attempt, submittedAt: new Date().toISOString() });
            
            await AsyncStorage.setItem('studentPracticeAssessmentHistory_v1', JSON.stringify(history));

            setResult(attempt);
            toastSuccess('Practice Completed!');
            setSubmitting(false);
            return; 
        }

        const formattedAnswers = assessment.questions.map(q => ({
            questionId: q._id,
            format: q.format || 'multiple_choice',
            selectedIndex: currentAnswers[q._id] !== undefined ? currentAnswers[q._id] : -1,
        }));

        try {
            const res = await api.post(`/assessments/${assessmentId}/submit`, {
                studentId,
                answers: formattedAnswers,
                timeSpentSec: assessment?.timer?.enabled ? ((assessment.timer.minutes * 60) - (secondsLeft || 0)) : 0
            });
            
            const resultData = res.data.data;
            setResult(resultData);
            toastSuccess('Submitted Successfully!');

            if (!assessment?.isRemedial && resultData.percent < 70) {
                const failKey = `failCount_${currentUser._id}`;
                const storedFails = await AsyncStorage.getItem(failKey);
                let failCount = storedFails ? parseInt(storedFails, 10) : 0;
                
                failCount += 1;

                if (failCount >= 3) {
                    toastSuccess("Generating personalized remedial lesson...");

                    const failedQuestions = assessment.questions.filter(q => {
                        const selected = currentAnswers[q._id] !== undefined ? currentAnswers[q._id] : -1;
                        return selected !== q.correctIndex;
                    }).map(q => ({
                        text: String(q.text || ''),
                        format: String(q.format || 'multiple_choice'),
                        correctAnswer: q.options && q.options[q.correctIndex] ? String(q.options[q.correctIndex]) : '',
                        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [],
                        isCorrect: false
                    }));

                    api.post('/ai/intervention', {
                        studentId: currentUser._id,
                        studentName: `${currentUser.fname} ${currentUser.lname}`.trim(),
                        topic: assessment.title || 'Assessment',
                        score: resultData.score || 0,
                        total: resultData.total || 0,
                        lessonId: null,
                        sourceAssessmentId: assessmentId,
                        sourceAttemptId: resultData.attemptId || null,
                        failedQuestions: failedQuestions,
                        failedItemCount: failedQuestions.length
                    }).catch(err => console.log("Intervention failed to generate:", err));

                    failCount = 0;
                }
                
                await AsyncStorage.setItem(failKey, failCount.toString());
            }

        } catch (err) {
            toastError("Submission failed.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <View style={localStyles.center}><ActivityIndicator size="large" color="#153c2a" /></View>;

    if (assessment?.isCompleted && !assessment?.canRetake && !result) {
        return (
            <View style={[localStyles.center, { backgroundColor: theme.bg, padding: 25 }]}>
                <Ionicons name="lock-closed" size={80} color="#EF4444" />
                <Text style={{ color: theme.text, marginTop: 20, fontSize: 22, fontWeight: '900' }}>Assessment Completed</Text>
                <Text style={{ color: theme.subText, textAlign: 'center', marginTop: 10, fontSize: 15, lineHeight: 22 }}>
                    You have already completed this assessment. Retakes are not permitted for this module.
                </Text>
                <TouchableOpacity style={[localStyles.backBtn, { marginTop: 30, backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
                    <Text style={localStyles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (result) return (
        <View style={[localStyles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 25 }]}>
            <View style={localStyles.resultIconCircle}>
                <Ionicons name="trophy" size={60} color="#F59E0B" />
            </View>
            <Text style={[localStyles.scoreText, { color: theme.text }]}>{result.score} <Text style={{fontSize: 24, color: theme.subText}}>/ {result.total}</Text></Text>
            <Text style={{ color: result.percent >= 50 ? '#10B981' : '#EF4444', fontSize: 18, fontWeight: '900', marginTop: 10 }}>{result.percent}% Score</Text>
            
            <View style={[localStyles.feedbackBox, { backgroundColor: theme.card }]}>
                <Ionicons name="chatbubbles-outline" size={24} color="#94A3B8" style={{ marginBottom: 10 }} />
                <Text style={{ color: theme.text, textAlign: 'center', fontSize: 14, fontWeight: '600', lineHeight: 22 }}>"{result.feedback}"</Text>
            </View>
            
            <TouchableOpacity style={localStyles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={localStyles.backBtnText}>Return to Dashboard</Text>
            </TouchableOpacity>
        </View>
    );

    const isUrgent = secondsLeft !== null && secondsLeft < 60;
    const answeredCount = Object.keys(answers).length;
    const totalCount = assessment?.questions?.length || 0;
    const hasTimer = assessment?.timer?.enabled;

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="dark-content" />
            
            <View style={[localStyles.stickyHeader, { backgroundColor: theme.card, borderBottomColor: isUrgent ? '#EF4444' : '#E2E8F0' }]}>
                <View style={localStyles.headerLeft}>
                    <TouchableOpacity onPress={handleBackPress} style={localStyles.headerBackBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={[localStyles.headerTitle, { color: theme.text }]} numberOfLines={1}>{assessment?.title}</Text>
                        <Text style={localStyles.headerProgress}>{answeredCount} of {totalCount} Answered</Text>
                    </View>
                </View>
                
                <View style={[localStyles.timerPill, { backgroundColor: hasTimer ? (isUrgent ? '#FEE2E2' : '#F1F5F9') : '#F8FAFC' }]}>
                    {hasTimer ? (
                        <>
                            <Ionicons name="time" size={16} color={isUrgent ? '#EF4444' : '#64748B'} />
                            <Text style={[localStyles.timerText, { color: isUrgent ? '#EF4444' : '#1e293b' }]}>
                                {secondsLeft !== null ? formatTime(secondsLeft) : '0:00'}
                            </Text>
                        </>
                    ) : (
                        <>
                            <Ionicons name="infinite" size={16} color="#94A3B8" />
                            <Text style={[localStyles.timerText, { color: '#64748B', fontSize: 12 }]}>No Timer</Text>
                        </>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
                {assessment?.questions?.map((q, idx) => (
                    <View key={q._id} style={[localStyles.qCard, { backgroundColor: theme.card }]}>
                        <View style={localStyles.qHeaderRow}>
                            <View style={localStyles.qBadge}>
                                <Text style={localStyles.qBadgeText}>Q{idx + 1}</Text>
                            </View>
                            <Text style={localStyles.qPoints}>{q.points} pts</Text>
                        </View>

                        <Text style={[localStyles.qText, { color: theme.text }]}>{q.text}</Text>
                        
                        <View style={localStyles.optionsContainer}>
                            {q.options.map((opt, optIdx) => {
                                const isSelected = answers[q._id] === optIdx;
                                return (
                                    <TouchableOpacity 
                                        key={optIdx} 
                                        style={[
                                            localStyles.optBtn, 
                                            { backgroundColor: theme.bg, borderColor: theme.bg },
                                            isSelected && { borderColor: '#10B981', backgroundColor: '#E7F5EE' }
                                        ]}
                                        onPress={() => {
                                            const newAnswers = { ...answers, [q._id]: optIdx };
                                            setAnswers(newAnswers);
                                            answersRef.current = newAnswers; 
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons 
                                            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                                            size={22} 
                                            color={isSelected ? "#10B981" : "#94A3B8"} 
                                        />
                                        <Text style={[localStyles.optText, { color: isSelected ? '#153c2a' : theme.text, fontWeight: isSelected ? '800' : '600' }]}>
                                            {opt}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View style={[localStyles.footer, { backgroundColor: theme.card }]}>
                <TouchableOpacity 
                    style={[localStyles.submitBtn, submitting && { opacity: 0.7 }]} 
                    onPress={confirmSubmit} 
                    disabled={submitting}
                >
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.submitBtnText}>Submit Assessment</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const localStyles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1 },
    
    stickyHeader: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15, 
        borderBottomWidth: 3, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, zIndex: 10 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
    headerBackBtn: { marginRight: 15, padding: 5 },
    headerTitle: { fontSize: 16, fontWeight: '900' },
    headerProgress: { fontSize: 11, color: '#94A3B8', fontWeight: '700', marginTop: 2 },
    
    timerPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    timerText: { fontSize: 14, fontWeight: '900', marginLeft: 6 },
    
    qCard: { padding: 20, borderRadius: 24, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8 },
    qHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    qBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    qBadgeText: { fontSize: 11, fontWeight: '900', color: '#64748B' },
    qPoints: { fontSize: 12, fontWeight: '800', color: '#94A3B8' },
    
    qText: { fontSize: 16, fontWeight: '800', marginBottom: 20, lineHeight: 24 },
    
    optionsContainer: { gap: 10 },
    optBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 2 },
    optText: { marginLeft: 12, fontSize: 14, flex: 1 },
    
    footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, borderTopWidth: 1, borderColor: '#F1F5F9', elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    submitBtn: { backgroundColor: '#153c2a', padding: 18, borderRadius: 16, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
    
    resultIconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    scoreText: { fontSize: 55, fontWeight: '900' },
    feedbackBox: { padding: 25, borderRadius: 24, marginVertical: 30, width: '100%', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    backBtn: { backgroundColor: '#153c2a', paddingHorizontal: 30, paddingVertical: 18, borderRadius: 16, width: '100%', alignItems: 'center' },
    backBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 }
});