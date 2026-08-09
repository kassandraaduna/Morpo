import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastSuccess, toastError } from './src/components/ToastMsg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function CreateAssessmentManual({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [title, setTitle] = useState('');
    const [deadline, setDeadline] = useState('');
    const [questions, setQuestions] = useState([{ text: '', options: ['', '', '', ''], correctIndex: 0 }]);
    const [loading, setLoading] = useState(false);

    const updateQuestion = (qIndex, field, value) => {
        const updated = [...questions];
        if (field === 'text') updated[qIndex].text = value;
        if (field === 'correctIndex') updated[qIndex].correctIndex = value;
        setQuestions(updated);
    };

    const updateOption = (qIndex, optIndex, value) => {
        const updated = [...questions];
        updated[qIndex].options[optIndex] = value;
        setQuestions(updated);
    };

    const handleSave = async () => {
        if (!title) return toastError("Title is required.");
        try {
            setLoading(true);
            const userRaw = await AsyncStorage.getItem('user');
            const user = JSON.parse(userRaw);

            const payload = {
                title,
                deliveryMode: 'internal',
                deadlineAt: deadline ? new Date(deadline).toISOString() : null,
                instructorId: user._id || user.id,
                questions
            };

            await api.post('/assessments', payload);
            toastSuccess("Manual assessment created!");
            navigation.goBack();
        } catch (error) {
            toastError("Failed to save assessment.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ padding: 20 }}>
            <TextInput style={styles.input} placeholder="Assessment Title" value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} />

            {questions.map((q, qIndex) => (
                <View key={qIndex} style={styles.qCard}>
                    <Text style={styles.qTitle}>Question {qIndex + 1}</Text>
                    <TextInput style={styles.input} placeholder="Question Text" value={q.text} onChangeText={(val) => updateQuestion(qIndex, 'text', val)} />
                    
                    {q.options.map((opt, optIndex) => (
                        <View key={optIndex} style={styles.optRow}>
                            <TouchableOpacity onPress={() => updateQuestion(qIndex, 'correctIndex', optIndex)}>
                                <Ionicons name={q.correctIndex === optIndex ? "radio-button-on" : "radio-button-off"} size={24} color={q.correctIndex === optIndex ? "#10B981" : "#94A3B8"} />
                            </TouchableOpacity>
                            <TextInput style={[styles.input, { flex: 1, marginLeft: 10, marginBottom: 0 }]} placeholder={`Option ${optIndex + 1}`} value={opt} onChangeText={(val) => updateOption(qIndex, optIndex, val)} />
                        </View>
                    ))}
                </View>
            ))}

            <TouchableOpacity style={styles.addBtn} onPress={() => setQuestions([...questions, { text: '', options: ['', '', '', ''], correctIndex: 0 }])}>
                <Text style={{ color: '#3B82F6', fontWeight: 'bold' }}>+ Add Question</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Assessment</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    input: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10, backgroundColor: '#fff' },
    qCard: { padding: 15, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    qTitle: { fontWeight: 'bold', marginBottom: 10 },
    optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    addBtn: { padding: 15, alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, marginBottom: 20 },
    saveBtn: { backgroundColor: '#153c2a', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 40 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});