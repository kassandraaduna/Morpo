import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastSuccess, toastError } from './src/components/ToastMsg';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CreateAssessmentAI({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [topic, setTopic] = useState('');
    const [itemCount, setItemCount] = useState('10');
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!topic) return toastError("Please provide a topic.");
        
        try {
            setLoading(true);
            const userRaw = await AsyncStorage.getItem('user');
            const user = JSON.parse(userRaw);

            // Calls your AI endpoint (Adjust the route depending on your backend setup)
            const aiResponse = await api.post('/ai/generate-quiz', {
                prompt: `Generate a multiple choice quiz about ${topic} with ${itemCount} questions.`
            });

            const generatedQuestions = aiResponse.data?.questions || [];

            if (generatedQuestions.length === 0) throw new Error("AI failed to generate questions.");

            // Save the generated assessment directly
            const payload = {
                title: `AI Quiz: ${topic}`,
                deliveryMode: 'internal',
                instructorId: user._id || user.id,
                questions: generatedQuestions
            };

            await api.post('/assessments', payload);
            toastSuccess("AI Assessment Generated and Saved!");
            navigation.goBack();
        } catch (error) {
            console.error("AI Gen Error:", error);
            toastError("Failed to generate AI assessment.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ padding: 20 }}>
            <Text style={[styles.label, { color: theme.text }]}>What should the assessment cover?</Text>
            <TextInput 
                style={[styles.textArea, { backgroundColor: theme.card, color: theme.text }]} 
                placeholder="e.g., The life cycle of fungi, focusing on reproduction..." 
                placeholderTextColor="#94A3B8" 
                multiline 
                numberOfLines={4} 
                value={topic} 
                onChangeText={setTopic} 
            />

            <Text style={[styles.label, { color: theme.text }]}>Number of Questions</Text>
            <TextInput 
                style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} 
                keyboardType="numeric" 
                value={itemCount} 
                onChangeText={setItemCount} 
            />

            <TouchableOpacity style={styles.btn} onPress={handleGenerate} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>✨ Generate with AI</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 15 },
    input: { padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15 },
    textArea: { padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15, textAlignVertical: 'top' },
    btn: { backgroundColor: '#8B5CF6', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 30 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});