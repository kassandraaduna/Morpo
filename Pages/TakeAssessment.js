import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput,
    ActivityIndicator, StatusBar, Platform, Modal, BackHandler, AppState, Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');

export default function TakeAssessment({ route, navigation }) {
    const { assessmentId } = route.params || {};
    const { theme } = useContext(ThemeContext);

    const [loading, setLoading] = useState(true);
    const [assessment, setAssessment] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    const [hasStarted, setHasStarted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [resultData, setResultData] = useState(null);
    const [isFlipped, setIsFlipped] = useState(false);

    const [timeLeft, setTimeLeft] = useState(null);
    const timerRef = useRef(null);
    const appState = useRef(AppState.currentState);

    const [confirmModal, setConfirmModal] = useState({
        visible: false, title: '', message: '', iconName: 'help', iconColor: '#153c2a', iconBg: '#E7F5EE', 
        confirmText: 'Confirm', hideCancel: false, onConfirm: () => {}
    });

    const [matchingModal, setMatchingModal] = useState({
        visible: false, questionIndex: null, leftPrompt: null, options: []
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                const userRaw = await AsyncStorage.getItem('user');
                if (userRaw) setCurrentUser(JSON.parse(userRaw));

                const res = await api.get(`/assessments/${assessmentId}?_t=${Date.now()}`);
                const data = res.data?.data || res.data;
                setAssessment(data);
            } catch (err) {
                toastError('Failed to load assessment.');
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [assessmentId]);

    const isExternalLink = assessment?.deliveryMode === 'external' || assessment?.link || assessment?.externalUrl;

    const startExamSession = () => {
        setHasStarted(true);
        if (assessment?.timer?.enabled && assessment?.timer?.minutes > 0) {
            const totalSecs = assessment.timer.minutes * 60;
            setTimeLeft(totalSecs);
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        handleSubmitAssessment(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    useEffect(() => {
        const handleFocusLoss = () => {
            if (matchingModal.visible || confirmModal.visible) return;
            
            if (hasStarted && !resultData && assessment?.quizType !== 'flashcard' && !submitting) {
                handleSubmitAssessment(true);
            }
        };

        const subscriptionChange = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/active/) && (nextAppState === 'background' || nextAppState === 'inactive')) {
                handleFocusLoss();
            }
            appState.current = nextAppState;
        });

        const subscriptionBlur = AppState.addEventListener('blur', handleFocusLoss);

        return () => {
            subscriptionChange.remove();
            if (subscriptionBlur?.remove) subscriptionBlur.remove();
        };
    }, [hasStarted, resultData, selectedAnswers, assessment, submitting, matchingModal.visible, confirmModal.visible]);

    useEffect(() => {
        const backAction = () => {
            if (resultData || !hasStarted) {
                navigation.goBack();
                return true;
            }
            if (assessment?.quizType === 'flashcard') {
                triggerCustomAlert("Exit Flashcards?", "Are you sure you want to exit?", () => navigation.goBack(), 'help', '#153c2a', '#E7F5EE');
            } else {
                triggerCustomAlert(
                    "Warning: Leaving Assessment",
                    "If you exit or leave this assessment, it will automatically submit your exam with your current answers.",
                    () => handleSubmitAssessment(true), 'warning', '#EF4444', '#fee2e2'
                );
            }
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [hasStarted, resultData, selectedAnswers, assessment]);

    const triggerCustomAlert = (title, message, onConfirm, iconName = 'help', iconColor = '#153c2a', iconBg = '#E7F5EE', confirmText = 'Confirm', hideCancel = false) => {
        setConfirmModal({ visible: true, title, message, onConfirm, iconName, iconColor, iconBg, confirmText, hideCancel });
    };

    const handleSelectOption = (questionIndex, optionText) => {
        setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionText }));
    };

    const handleSubmitAssessment = async (isTimeout = false) => {
        if (submitting) return;

        const executeSubmit = async () => {
            try {
                setSubmitting(true);
                if (timerRef.current) clearInterval(timerRef.current);

                // EXTERNAL LINK SUBMISSION
                if (isExternalLink) {
                    try {
                        await api.post(`/assessments/${assessmentId}/external-submit`, { studentId: currentUser?._id });
                        const rawExt = await AsyncStorage.getItem('external_completed');
                        const extArray = rawExt ? JSON.parse(rawExt) : [];
                        if (!extArray.includes(assessmentId)) {
                            extArray.push(assessmentId);
                            await AsyncStorage.setItem('external_completed', JSON.stringify(extArray));
                        }
                        setResultData({ isExternalCompletion: true });
                        toastSuccess("External assessment submitted for review.");
                    } catch (extErr) {
                        toastError('Failed to sync external submission with server.');
                    } finally {
                        setSubmitting(false);
                    }
                    return;
                }

                const questions = assessment?.questions || [];
                const answersPayload = questions.map((q, idx) => {
                    const studentChoice = selectedAnswers[idx];
                    
                    let selectedIndex = -1;
                    let answerText = '';
                    let matches = []; // Mapping pairs for the backend

                    if (q.format === 'matching') {
                        if (typeof studentChoice === 'object' && studentChoice !== null) {
                            matches = Object.keys(studentChoice).map(key => ({
                                left: key,
                                right: studentChoice[key]
                            }));
                        }
                    } else {
                        answerText = typeof studentChoice === 'string' ? studentChoice : '';
                        if (q.format === 'multiple_choice' || q.format === 'true_false' || !q.format) {
                            if (Array.isArray(q.options) && q.options.length > 0) {
                                const cleanStudentChoice = String(studentChoice || '').trim().toLowerCase();
                                
                                if (cleanStudentChoice) {
                                    const matchIndex = q.options.findIndex(
                                        opt => String(opt || '').trim().toLowerCase() === cleanStudentChoice
                                    );
                                    if (matchIndex !== -1) selectedIndex = matchIndex;
                                }
                            }
                        }
                    }

                    return {
                        questionId: q._id || q.id,
                        selectedIndex: selectedIndex,
                        answerText: answerText,
                        matches: matches
                    };
                });

                const payload = {
                    studentId: currentUser?._id,
                    answers: answersPayload,
                    status: 'completed'
                };

                // Post submission to backend
                const res = await api.post(`/assessments/${assessmentId}/submit`, payload);
                let result = res.data?.data || res.data;

                // ADAPTIVE INTERVENTION LOGIC (INSTRUCTOR ASSESSMENTS ONLY)
                let interventionGenerated = false;
                let trackedFails = 0; 

                if (!assessment?.isPracticeOnly && result.percent < 50 && assessment?.quizType !== 'flashcard') {
                    try {
                        const failKey = `@fails_${assessmentId}_${currentUser._id}`;
                        const previousFailsRaw = await AsyncStorage.getItem(failKey);
                        trackedFails = previousFailsRaw ? parseInt(previousFailsRaw) + 1 : 1;
                        
                        result.currentFails = trackedFails;

                        if (trackedFails >= 3) {
                            const failedItems = questions.map((q, idx) => {
                                let studentAns = selectedAnswers[idx] || '';
                                let isCorrect = false;
                                let actualCorrectAnswer = q.correctAnswer;
                                
                                if (q.format === 'multiple_choice' || !q.format) {
                                    actualCorrectAnswer = q.correctAnswer || q.options?.[q.correctIndex];
                                    isCorrect = studentAns === actualCorrectAnswer;
                                } else if (q.format === 'true_false') {
                                    actualCorrectAnswer = q.correctAnswer || (q.correctIndex === 0 ? 'True' : 'False');
                                    isCorrect = studentAns === actualCorrectAnswer;
                                } else if (q.format === 'identification' || q.format === 'written') {
                                    const accepted = q.acceptedAnswers?.length > 0 ? q.acceptedAnswers : [q.correctAnswer];
                                    actualCorrectAnswer = accepted[0];
                                    isCorrect = accepted.some(ans => ans?.toLowerCase().trim() === studentAns.toLowerCase().trim());
                                } else if (q.format === 'matching') {
                                    const matchesObj = studentAns || {};
                                    actualCorrectAnswer = (q.matchingPairs || []).map(p => `${p.left} -> ${p.right}`).join(', ');
                                    isCorrect = (q.matchingPairs || []).every(p => matchesObj[p.left] === p.right);
                                    studentAns = Object.keys(matchesObj).map(k => `${k} -> ${matchesObj[k]}`).join(', ');
                                }

                                return { 
                                    text: q.question || q.text, 
                                    format: q.format || 'multiple_choice', 
                                    options: q.options || [],
                                    correctAnswer: actualCorrectAnswer || '',
                                    studentAnswer: studentAns,
                                    isCorrect: isCorrect 
                                };
                            }).filter(q => !q.isCorrect);

                            if (failedItems.length > 0) {
                                await api.post('/ai/intervention', {
                                    studentId: currentUser?._id, 
                                    studentName: `${currentUser?.fname || ''} ${currentUser?.lname || ''}`.trim() || 'Student',
                                    topic: assessment?.title || 'Assessment Review', 
                                    topicDetails: `Failed attempt`,
                                    score: result.score, 
                                    total: result.total, 
                                    lessonId: assessment?.lessonId || null,
                                    sourceAssessmentId: assessmentId,
                                    sourceAttemptId: result._id,
                                    failedQuestions: failedItems, 
                                    failedItemCount: failedItems.length, 
                                    preferredQuestionCount: 5
                                });
                                interventionGenerated = true;
                                await AsyncStorage.removeItem(failKey);
                            }
                        } else {
                            await AsyncStorage.setItem(failKey, trackedFails.toString());
                        }
                    } catch (aiErr) {
                        console.log('AI Remedial Generation Error:', aiErr?.message);
                    }
                } else if (!assessment?.isPracticeOnly && result.percent >= 50) {
                    await AsyncStorage.removeItem(`@fails_${assessmentId}_${currentUser._id}`);
                    result.currentFails = 0;
                }

                setResultData(result);

                if (interventionGenerated) {
                    triggerCustomAlert(
                        "Remedial Lesson Generated",
                        `You failed the ${assessment?.title || 'assessment'} for 3 times, so a remedial lesson was generated based on your failed attempts.`,
                        () => { 
                            setConfirmModal(prev => ({ ...prev, visible: false }));
                            navigation.navigate('Learn', { initialTab: 'Remedial Lessons' });
                        },
                        "sparkles", "#10B981", "#E7F5EE",
                        "View Remedial Lesson",
                        true
                    );
                } else {
                    const baseMsg = isTimeout ? "Assessment automatically submitted." : "Assessment submitted successfully!";
                    toastSuccess(baseMsg);
                }
            } catch (err) {
                console.error("Submission Error:", err?.response?.data || err.message);
                toastError('Failed to submit assessment.');
            } finally {
                setSubmitting(false);
            }
        };

        if (isTimeout || !hasStarted) {
            executeSubmit();
        } else {
            triggerCustomAlert(
                "Finish Assessment",
                isExternalLink ? "Have you fully submitted the external form? Clicking confirm will turn this assessment in." : assessment?.isPracticeOnly ? "Are you sure you want to finish this practice test?" : "Are you sure you want to submit your answers now?",
                executeSubmit, 'help', '#153c2a', '#E7F5EE'
            );
        }
    };

    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#153c2a' }}>
                <ActivityIndicator size="large" color="#FFF" />
                <Text style={{ color: '#A7F3D0', fontWeight: '800', marginTop: 12 }}>Loading assessment...</Text>
            </View>
        );
    }

    // ==========================================
    // 1. LANDING / INSTRUCTIONS PAGE
    // ==========================================
    if (!hasStarted) {
        const isFlashcard = assessment?.quizType === 'flashcard';
        const timerText = assessment?.timer?.enabled ? `${assessment.timer.minutes} Minutes` : 'No Time Limit';
        const questionCount = isFlashcard ? (assessment?.flashcards?.length || 0) : (assessment?.questions?.length || 0);

        return (
            <View style={{ flex: 1, backgroundColor: theme?.bg || '#F4F7F6' }}>
                <StatusBar barStyle="light-content" />
                <View style={styles.greenHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitleText} numberOfLines={1}>
                            {assessment?.title ? assessment.title.toUpperCase() : 'ASSESSMENT DETAILS'}
                        </Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    <View style={[styles.landingCard, { backgroundColor: theme?.card || '#FFF' }]}>
                        <View style={styles.landingBadge}>
                            <Text style={styles.landingBadgeText}>
                                {isExternalLink ? 'EXTERNAL LINK' : isFlashcard ? 'FLASHCARD SET' : 'EXAM / QUIZ'}
                            </Text>
                        </View>
                        <Text style={[styles.landingTitle, { color: theme?.text || '#1E293B' }]}>{assessment?.title}</Text>

                        {!isExternalLink && (
                            <View style={styles.landingMetaGrid}>
                                <View style={styles.landingMetaItem}>
                                    <Ionicons name="help-circle-outline" size={18} color="#153c2a" />
                                    <Text style={styles.landingMetaLabel}>{isFlashcard ? 'Total Cards' : 'Total Questions'}</Text>
                                    <Text style={[styles.landingMetaVal, { color: theme?.text }]}>{questionCount}</Text>
                                </View>
                                <View style={styles.landingMetaItem}>
                                    <Ionicons name="time-outline" size={18} color="#153c2a" />
                                    <Text style={styles.landingMetaLabel}>Timer</Text>
                                    <Text style={[styles.landingMetaVal, { color: theme?.text }]}>{timerText}</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.instructionBox}>
                        <View style={styles.instructionHeader}>
                            <Ionicons name="warning" size={20} color="#B45309" />
                            <Text style={styles.instructionTitle}>IMPORTANT INSTRUCTIONS</Text>
                        </View>
                        <Text style={styles.instructionText}>
                            • Once you start, do not minimize the app, switch windows, open chatheads, or press the phone home button.{'\n'}
                            • Doing so will trigger an automatic submission of your assessment, locking you out of the form.{'\n'}
                            • Make sure you have a stable connection before proceeding.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.startExamBtn} onPress={startExamSession}>
                        <Text style={styles.startExamBtnText}>
                            {isExternalLink ? 'Open External Assessment' : isFlashcard ? 'Start Flashcard Review' : 'Start Assessment'}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ==========================================
    // 2. RESULT VIEW (When submitted)
    // ==========================================
    if (resultData) {
        if (resultData.isExternalCompletion || isExternalLink) {
                return (
                    <View style={{ flex: 1, backgroundColor: theme?.bg || '#F4F7F6', justifyContent: 'center', padding: 25 }}>
                        <StatusBar barStyle="dark-content" />
                        <View style={[styles.resultCard, { backgroundColor: theme?.card || '#FFF' }]}>
                            <View style={[styles.resultIconBg, { backgroundColor: '#FEF3C7', width: 80, height: 80, borderRadius: 10 }]}>
                                <Ionicons name="document-text" size={40} color="#D97706" />
                            </View>
                            <Text style={[styles.resultTitle, { color: theme?.text || '#1E293B', textAlign: 'center', marginTop: 10 }]}>Submission Recorded</Text>
                            <Text style={[styles.resultSubText, { marginTop: 10, fontSize: 15, lineHeight: 22 }]}>Your external assessment has been recorded and is currently under review by your instructor.</Text>
                            <TouchableOpacity style={[styles.resultBtn, { marginTop: 15 }]} onPress={() => navigation.goBack()}>
                                <Text style={styles.resultBtnText}>Back to Assessments</Text>
                            </TouchableOpacity>
                        </View>
                        {renderConfirmModal()}
                    </View>
                );
        }

        const passing = resultData.percent >= 70;
        return (
            <View style={{ flex: 1, backgroundColor: theme?.bg || '#F4F7F6', justifyContent: 'center', padding: 25 }}>
                <StatusBar barStyle="dark-content" />
                <View style={[styles.resultCard, { backgroundColor: theme?.card || '#FFF' }]}>
                    <View style={[styles.resultIconBg, { backgroundColor: passing ? '#E7F5EE' : '#FEE2E2' }]}>
                        <Ionicons name={passing ? "ribbon" : "alert-circle"} size={40} color={passing ? '#10B981' : '#EF4444'} />
                    </View>
                    <Text style={[styles.resultTitle, { color: theme?.text || '#1E293B', textAlign: 'center' }]}>
                        {passing ? 'Great Job!' : 'Assessment Completed'}
                    </Text>
                    <Text style={[styles.resultScoreText, { color: passing ? '#10B981' : '#EF4444' }]}>
                        {resultData.score} / {resultData.total}
                    </Text>
                    <Text style={[styles.resultSubText, { marginBottom: resultData.currentFails > 0 ? 15 : 25 }]}>
                        You achieved a score of {resultData.percent}%.
                    </Text>

                    {!assessment?.isPracticeOnly && resultData.currentFails > 0 && (
                        <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, marginBottom: 25 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#EF4444', textTransform: 'uppercase' }}>
                                Failed Attempts: {resultData.currentFails} / 3
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.resultBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.resultBtnText}>Back to Assessments</Text>
                    </TouchableOpacity>
                </View>
                {renderConfirmModal()}
            </View>
        );
    }

    // ==========================================
    // 3. EXTERNAL LINK VIEW
    // ==========================================
    if (isExternalLink) {
        return (
            <View style={{ flex: 1, backgroundColor: theme?.bg || '#F4F7F6' }}>
                <StatusBar barStyle="light-content" />
                <View style={styles.greenHeader}>
                     <TouchableOpacity onPress={() => triggerCustomAlert("Warning: Leaving", "If you exit, it will automatically submit.", () => handleSubmitAssessment(true), 'warning', '#EF4444', '#fee2e2')} style={styles.backIconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitleText} numberOfLines={1}>{assessment?.title ? assessment.title.toUpperCase() : 'EXTERNAL FORM'}</Text>
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    <WebView source={{ uri: assessment.link || assessment.externalUrl }} style={{ flex: 1 }} startInLoadingState={true} renderLoading={() => <ActivityIndicator size="large" color="#153c2a" style={{flex: 1, justifyContent:'center'}} />} />
                </View>
                <View style={[styles.footerNav, { paddingBottom: Platform.OS === 'ios' ? 40 : 25 }]}>
                    <TouchableOpacity onPress={() => triggerCustomAlert("Finish Assessment", "Have you fully submitted the form in the web view?", () => handleSubmitAssessment(false), 'help', '#153c2a', '#E7F5EE')} style={[styles.navBtnNext, { backgroundColor: '#10B981', flex: 1 }]} disabled={submitting}>
                        <Text style={styles.navBtnNextText}>{submitting ? 'Submitting...' : 'I have submitted the form'}</Text>
                    </TouchableOpacity>
                </View>
                {renderConfirmModal()}
            </View>
        );
    }

    // ==========================================
    // 4. FLASHCARD VIEW
    // ==========================================
    if (assessment?.quizType === 'flashcard') {
        const currentCard = assessment.flashcards?.[currentIndex];
        return (
            <View style={{ flex: 1, backgroundColor: theme?.bg || '#F4F7F6' }}>
                <StatusBar barStyle="light-content" />
                <View style={styles.greenHeader}>
                    <TouchableOpacity onPress={() => triggerCustomAlert("Exit Flashcards?", "Are you sure you want to exit?", () => navigation.goBack(), 'help', '#153c2a', '#E7F5EE')} style={styles.backIconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitleText} numberOfLines={1}>{assessment?.title ? assessment.title.toUpperCase() : 'FLASHCARDS'}</Text>
                        <Text style={styles.headerSubText}>Card {currentIndex + 1} of {assessment.flashcards?.length || 0}</Text>
                    </View>
                </View>

                <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
                    {currentCard ? (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setIsFlipped(!isFlipped)} style={[styles.flashcardBody, { backgroundColor: isFlipped ? '#153c2a' : (theme?.card || '#FFF') }]}>
                            <Text style={[styles.flashcardText, { color: isFlipped ? '#FFF' : (theme?.text || '#1E293B') }]}>{isFlipped ? currentCard.back : currentCard.front}</Text>
                            <Text style={[styles.flipHint, { color: isFlipped ? '#A7F3D0' : '#94A3B8' }]}>Tap to flip</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 18, fontWeight: '800', color: theme?.text }}>No cards available.</Text></View>
                    )}
                </View>

                <View style={styles.footerNav}>
                    <TouchableOpacity disabled={currentIndex === 0} onPress={() => { setIsFlipped(false); setCurrentIndex(prev => prev - 1); }} style={[styles.navBtnPrev, { opacity: currentIndex === 0 ? 0.4 : 1 }]}>
                        <Text style={styles.navBtnPrevText}>Previous</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { if (currentIndex < assessment.flashcards.length - 1) { setIsFlipped(false); setCurrentIndex(prev => prev + 1); } else { navigation.goBack(); toastSuccess("Flashcard review complete!"); } }} style={styles.navBtnNext}>
                        <Text style={styles.navBtnNextText}>{currentIndex < assessment.flashcards?.length - 1 ? 'Next Card' : 'Finish'}</Text>
                    </TouchableOpacity>
                </View>
                {renderConfirmModal()}
            </View>
        );
    }

    // ==========================================
    // 5. NATIVE QUESTION FORMAT VIEW
    // ==========================================
    const questions = assessment?.questions || [];
    const currentQuestion = questions[currentIndex];
    const qFormat = currentQuestion?.format || 'multiple_choice';

    // Calculate Answered Progress accurately (Checking deep matching pairs completion)
    const answeredCount = Object.keys(selectedAnswers).filter(key => {
        const ans = selectedAnswers[key];
        const format = assessment?.questions?.[key]?.format;
        if (format === 'matching') {
            const requiredCount = assessment?.questions?.[key]?.matchingPairs?.length || 0;
            const answeredPairs = Object.keys(ans || {}).length;
            return requiredCount > 0 && answeredPairs === requiredCount;
        }
        return ans !== undefined && ans !== '';
    }).length;

    return (
        <View style={{ flex: 1, backgroundColor: theme?.bg || '#F4F7F6' }}>
            <StatusBar barStyle="light-content" />
            <View style={styles.greenHeader}>
                <TouchableOpacity onPress={() => triggerCustomAlert("Warning: Leaving Assessment", "If you exit or leave this assessment, it will automatically submit your exam with your current answers.", () => handleSubmitAssessment(true), 'warning', '#EF4444', '#fee2e2')} style={styles.backIconBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitleText} numberOfLines={1}>{assessment?.title ? assessment.title.toUpperCase() : 'ASSESSMENT'}</Text>
                    <View style={styles.headerMetaRow}>
                        <Text style={styles.headerSubText}>Answered: {answeredCount} / {questions.length}</Text>
                        {timeLeft !== null && (
                            <View style={styles.timerPill}>
                                <Ionicons name="time-outline" size={12} color="#FFF" />
                                <Text style={styles.timerText}>{formatTimer(timeLeft)}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                <View style={[styles.questionCard, { backgroundColor: theme?.card || '#FFF' }]}>
                    <View style={styles.qNumBadge}>
                        <Text style={styles.qNumText}>QUESTION {currentIndex + 1} OF {questions.length}</Text>
                    </View>

                    <Text style={[styles.questionText, { color: theme?.text || '#1E293B' }]}>
                        {currentQuestion?.question || currentQuestion?.text}
                    </Text>

                    <View style={{ marginTop: 15, gap: 12 }}>
                        {qFormat === 'identification' || qFormat === 'written' ? (
                            <TextInput
                                style={styles.textInputAnswer}
                                placeholder={qFormat === 'written' ? "Type your detailed response here..." : "Type your exact answer here..."}
                                placeholderTextColor="#94A3B8"
                                value={selectedAnswers[currentIndex] || ''}
                                onChangeText={(val) => handleSelectOption(currentIndex, val)}
                                multiline={qFormat === 'written'}
                            />
                        ) : qFormat === 'matching' ? (
                            <View style={{ gap: 12 }}>
                                {currentQuestion?.matchingPairs?.map((pair, pIdx) => {
                                    const selectedMatch = (selectedAnswers[currentIndex] || {})[pair.left];
                                    return (
                                        <View key={pIdx} style={styles.matchContainer}>
                                            <Text style={styles.matchPrompt}>{pair.left}</Text>
                                            <TouchableOpacity 
                                                style={styles.matchSelectBtn} 
                                                onPress={() => {
                                                    const options = [...new Set(currentQuestion.matchingPairs.map(p => p.right))].sort();
                                                    setMatchingModal({
                                                        visible: true,
                                                        questionIndex: currentIndex,
                                                        leftPrompt: pair.left,
                                                        options: options
                                                    });
                                                }}
                                            >
                                                <Text style={[styles.matchSelectText, selectedMatch && {color: '#153c2a', fontWeight: '800'}]}>
                                                    {selectedMatch || "Select a match..."}
                                                </Text>
                                                <Ionicons name="chevron-down" size={16} color="#64748B" />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            currentQuestion?.options?.map((opt, optIdx) => {
                                const isSelected = selectedAnswers[currentIndex] === opt;
                                return (
                                    <TouchableOpacity 
                                        key={optIdx} activeOpacity={0.8}
                                        onPress={() => handleSelectOption(currentIndex, opt)}
                                        style={[styles.optionItem, { backgroundColor: theme?.bg || '#F8FAFC', borderColor: isSelected ? '#153c2a' : '#E2E8F0' }, isSelected && styles.optionItemSelected]}
                                    >
                                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                                            {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                                        </View>
                                        <Text style={[styles.optionText, { color: theme?.text || '#1E293B' }, isSelected && { fontWeight: '900', color: '#153c2a' }]}>{opt}</Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footerNav}>
                <TouchableOpacity disabled={currentIndex === 0} onPress={() => setCurrentIndex(prev => prev - 1)} style={[styles.navBtnPrev, { opacity: currentIndex === 0 ? 0.4 : 1 }]}>
                    <Text style={styles.navBtnPrevText}>Previous</Text>
                </TouchableOpacity>

                {currentIndex < questions.length - 1 ? (
                    <TouchableOpacity onPress={() => setCurrentIndex(prev => prev + 1)} style={styles.navBtnNext}>
                        <Text style={styles.navBtnNextText}>Next</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => handleSubmitAssessment(false)} style={[styles.navBtnNext, { backgroundColor: '#10B981' }]} disabled={submitting}>
                        <Text style={styles.navBtnNextText}>{submitting ? 'Submitting...' : 'Submit Exam'}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {renderMatchingModal()}
            {renderConfirmModal()}
        </View>
    );

    function renderMatchingModal() {
        return (
            <Modal visible={matchingModal.visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    {/* FIX: Added alignItems: 'stretch' and backgroundColor to ensure full-width layout and clean corners */}
                    <View style={[styles.modalCard, { width: '90%', maxWidth: 400, maxHeight: '80%', padding: 0, overflow: 'hidden', alignItems: 'stretch', backgroundColor: '#FFF' }]}>
                        
                        <View style={{ padding: 20, backgroundColor: '#153c2a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={[styles.modalTitle, { color: '#FFF', marginBottom: 5, textAlign: 'left' }]}>Select Match</Text>
                                <Text style={{ color: '#A7F3D0', fontSize: 13, lineHeight: 18 }}>{matchingModal.leftPrompt}</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setMatchingModal(prev => ({ ...prev, visible: false }))} 
                                style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}
                            >
                                <Ionicons name="close" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.5 }}>
                            {matchingModal.options.map((opt, oIdx) => (
                                <TouchableOpacity 
                                    key={oIdx} 
                                    style={styles.matchOptionBtn}
                                    onPress={() => {
                                        setSelectedAnswers(prev => ({
                                            ...prev,
                                            [matchingModal.questionIndex]: {
                                                ...(prev[matchingModal.questionIndex] || {}),
                                                [matchingModal.leftPrompt]: opt
                                            }
                                        }));
                                        setMatchingModal(prev => ({ ...prev, visible: false }));
                                    }}
                                >
                                    <Text style={styles.matchOptionText}>{opt}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Fixed the squished Close button constraint */}
                        <View style={{ padding: 15, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                            <TouchableOpacity 
                                style={{ paddingVertical: 14, borderRadius: 10, backgroundColor: '#E2E8F0', alignItems: 'center', width: '100%' }} 
                                onPress={() => setMatchingModal(prev => ({ ...prev, visible: false }))}
                            >
                                <Text style={{ fontWeight: '800', color: '#475569', fontSize: 14 }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    function renderConfirmModal() {
        return (
            <Modal visible={confirmModal.visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme?.card || '#FFF' }]}>
                        <View style={[styles.modalIconCircle, { backgroundColor: confirmModal.iconBg }]}>
                            <Ionicons name={confirmModal.iconName} size={28} color={confirmModal.iconColor} />
                        </View>
                        <Text style={[styles.modalTitle, { color: theme?.text || '#1E293B', textAlign: 'center' }]}>{confirmModal.title}</Text>
                        <Text style={styles.modalMessage}>{confirmModal.message}</Text>
                        
                        <View style={styles.modalBtnRow}>
                            {!confirmModal.hideCancel && (
                                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}>
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                            
                            <TouchableOpacity 
                                style={[styles.modalConfirmBtn, confirmModal.iconName === 'warning' && { backgroundColor: '#EF4444' }]} 
                                onPress={() => { const action = confirmModal.onConfirm; setConfirmModal(prev => ({ ...prev, visible: false })); action(); }}
                            >
                                <Text style={styles.modalConfirmText}>{confirmModal.confirmText}</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </Modal>
        );
    }
}

const styles = StyleSheet.create({
    greenHeader: { backgroundColor: '#153c2a', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
    backIconBtn: { position: 'absolute', left: 20, top: Platform.OS === 'ios' ? 60 : 40, zIndex: 10, padding: 5 },
    headerTitleContainer: { alignItems: 'center', paddingHorizontal: 50, flex: 1, paddingTop: 20 },
    headerTitleText: { fontSize: 15, fontWeight: '900', color: '#FFF', textAlign: 'center', },
    headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
    headerSubText: { fontSize: 12, color: '#A7F3D0', fontWeight: '800' },
    timerPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, gap: 4 },
    timerText: { fontSize: 11, color: '#FFF', fontWeight: '900' },
    landingCard: { borderRadius: 10, padding: 24, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 20 },
    landingBadge: { backgroundColor: '#E7F5EE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
    landingBadgeText: { fontSize: 10, fontWeight: '900', color: '#153c2a', letterSpacing: 0.5 },
    landingTitle: { fontSize: 20, fontWeight: '900', marginBottom: 20, lineHeight: 26 },
    landingMetaGrid: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 15, gap: 15 },
    landingMetaItem: { flex: 1, alignItems: 'center' },
    landingMetaLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 6, marginBottom: 2 },
    landingMetaVal: { fontSize: 14, fontWeight: '900' },
    instructionBox: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 10, padding: 20, marginBottom: 25 },
    instructionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    instructionTitle: { fontSize: 13, fontWeight: '900', color: '#B45309', letterSpacing: 0.5 },
    instructionText: { fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 18 },
    startExamBtn: { backgroundColor: '#153c2a', flexDirection: 'row', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 3 },
    startExamBtnText: { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
    questionCard: { borderRadius: 10, padding: 22, elevation: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10 },
    qNumBadge: { backgroundColor: '#E7F5EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
    qNumText: { fontSize: 10, fontWeight: '900', color: '#153c2a', letterSpacing: 0.5 },
    questionText: { fontSize: 16, fontWeight: '800', lineHeight: 24 },
    optionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, borderWidth: 1.5 },
    optionItemSelected: { backgroundColor: '#E7F5EE' },
    
    matchContainer: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    matchPrompt: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10, lineHeight: 22 },
    matchSelectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', padding: 14, borderRadius: 8 },
    matchSelectText: { fontSize: 14, color: '#64748B', flex: 1, marginRight: 10 },
    matchOptionBtn: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFF' },
    matchOptionText: { fontSize: 14, color: '#1E293B', lineHeight: 22, fontWeight: '600' },
    
    radioCircle: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', marginRight: 14, backgroundColor: '#FFF' },
    radioCircleActive: { borderColor: '#153c2a', backgroundColor: '#153c2a' },
    
    textInputAnswer: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10, padding: 18, fontSize: 15, color: '#1E293B', minHeight: 80, textAlignVertical: 'top', fontWeight: '600' },
    
    optionText: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
    footerNav: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', flexDirection: 'row', paddingHorizontal: 20, paddingTop: 15, paddingBottom: Platform.OS === 'ios' ? 35 : 20, gap: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9', elevation: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    navBtnPrev: { flex: 1, paddingVertical: 16, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
    navBtnPrevText: { fontWeight: '800', color: '#64748B', fontSize: 14 },
    navBtnNext: { flex: 1, paddingVertical: 16, borderRadius: 10, backgroundColor: '#153c2a', alignItems: 'center' },
    navBtnNextText: { fontWeight: '800', color: '#FFF', fontSize: 14 },
    flashcardBody: { flex: 1, minHeight: 280, borderRadius: 10, justifyContent: 'center', alignItems: 'center', padding: 30, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15 },
    flashcardText: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
    flipHint: { position: 'absolute', bottom: 20, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    resultCard: { borderRadius: 10, padding: 30, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15 },
    resultIconBg: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    resultTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
    resultScoreText: { fontSize: 36, fontWeight: '900', color: '#153c2a', marginBottom: 6 },
    resultSubText: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 25, textAlign: 'center' },
    resultBtn: { backgroundColor: '#153c2a', width: '100%', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
    resultBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', maxWidth: 340, padding: 25, borderRadius: 10, alignItems: 'center', elevation: 10 },
    modalIconCircle: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8, textAlign: 'left' },
    modalMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 25, fontWeight: '600', lineHeight: 18 },
    modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
    modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
    modalCancelText: { fontWeight: '800', color: '#64748B', fontSize: 13 },
    modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#153c2a', alignItems: 'center' },
    modalConfirmText: { fontWeight: '800', color: '#FFF', fontSize: 13 }
});