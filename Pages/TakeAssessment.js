import React, { useEffect, useState, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function TakeAssessment({ route, navigation }) {
    const { assessmentId } = route.params;
    const { theme } = useContext(ThemeContext);
    
    const [studentId, setStudentId] = useState(null);
    const [assessment, setAssessment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);

    const [secondsLeft, setSecondsLeft] = useState(null);
    const timerRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            try {
                const userRaw = await AsyncStorage.getItem('user');
                const user = JSON.parse(userRaw);
                setStudentId(user._id);

                const res = await api.get(`/assessments/${assessmentId}?studentId=${user._id}`);
                const data = res.data?.data;
                setAssessment(data);

                if (data?.timer?.enabled && data?.timer?.minutes) {
                    setSecondsLeft(data.timer.minutes * 60);
                }
            } catch (err) {
                toastError("Failed to load quiz.");
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };
        init();
        return () => clearInterval(timerRef.current);
    }, []);

    useEffect(() => {
        if (secondsLeft === null) return;
        if (secondsLeft <= 0) {
            clearInterval(timerRef.current);
            Alert.alert("Time's Up!", "Your assessment is being submitted automatically.", [{ text: "OK", onPress: submitToBackend }]);
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

    const submitToBackend = async () => {
        if (submitting) return;
        setSubmitting(true);
        clearInterval(timerRef.current);
        
        const formattedAnswers = assessment.questions.map(q => ({
            questionId: q._id,
            format: q.format || 'multiple_choice',
            selectedIndex: answers[q._id] !== undefined ? answers[q._id] : null,
        }));

        try {
            const res = await api.post(`/assessments/${assessmentId}/submit`, {
                studentId,
                answers: formattedAnswers,
                timeSpentSec: (assessment.timer.minutes * 60) - (secondsLeft || 0)
            });
            setResult(res.data.data);
            toastSuccess('Submitted Successfully!');
        } catch (err) {
            toastError("Submission failed.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <View style={localStyles.center}><ActivityIndicator size="large" color="#153c2a" /></View>;

    if (result) return (
        <View style={[localStyles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
            <Ionicons name="trophy" size={80} color="#f59e0b" />
            <Text style={[localStyles.scoreText, { color: theme.text }]}>{result.score} / {result.total}</Text>
            <Text style={{ color: theme.subText, fontSize: 18 }}>{result.percent}% Score</Text>
            <View style={[localStyles.feedbackBox, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, textAlign: 'center', fontStyle: 'italic' }}>"{result.feedback}"</Text>
            </View>
            <TouchableOpacity style={localStyles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Back to List</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            {/* STICKY TIMER HEADER */}
            <View style={[localStyles.timerHeader, { backgroundColor: secondsLeft < 60 ? '#fee2e2' : '#f3f4f6' }]}>
                <Text style={{ fontWeight: 'bold' }}>MODE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={18} color={secondsLeft < 60 ? '#dc2626' : '#000'} />
                    <Text style={[localStyles.timerText, { color: secondsLeft < 60 ? '#dc2626' : '#000' }]}>
                        {secondsLeft !== null ? formatTime(secondsLeft) : 'Practice'}
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                <Text style={[localStyles.quizTitle, { color: theme.text }]}>{assessment?.title}</Text>
                <Text style={{ color: theme.subText, marginBottom: 20 }}>Answer all questions then submit.</Text>

                {assessment?.questions?.map((q, idx) => (
                    <View key={q._id} style={[localStyles.qCard, { backgroundColor: theme.card }]}>
                        <Text style={[localStyles.qText, { color: theme.text }]}>{idx + 1}. {q.text} ({q.points} pts)</Text>
                        {q.options.map((opt, optIdx) => (
                            <TouchableOpacity 
                                key={optIdx} 
                                style={[localStyles.optBtn, answers[q._id] === optIdx && { borderColor: '#153c2a', backgroundColor: '#e6f4ea' }]}
                                onPress={() => setAnswers({...answers, [q._id]: optIdx})}
                            >
                                <Ionicons name={answers[q._id] === optIdx ? "radio-button-on" : "radio-button-off"} size={20} color="#153c2a" />
                                <Text style={{ marginLeft: 10, color: theme.text }}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </ScrollView>

            <View style={localStyles.footer}>
                <TouchableOpacity style={localStyles.submitBtn} onPress={submitToBackend} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.submitBtnText}>SUBMIT ASSESSMENT</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const localStyles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1 },
    timerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
    timerText: { fontSize: 18, fontWeight: '900', marginLeft: 5 },
    quizTitle: { fontSize: 22, fontWeight: '900' },
    qCard: { padding: 20, borderRadius: 15, marginBottom: 20, elevation: 2 },
    qText: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
    optBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee', marginBottom: 10 },
    footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
    submitBtn: { backgroundColor: '#153c2a', padding: 18, borderRadius: 12, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
    scoreText: { fontSize: 40, fontWeight: '900', marginTop: 20 },
    feedbackBox: { padding: 20, borderRadius: 15, marginVertical: 20, width: '100%' },
    backBtn: { backgroundColor: '#153c2a', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 10 }
});