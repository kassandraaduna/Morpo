import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastSuccess, toastError } from './src/components/ToastMsg';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CreateAssessmentLink({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [deadline, setDeadline] = useState(''); // e.g., YYYY-MM-DD
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!title || !url) return toastError("Title and URL are required.");
        
        try {
            setLoading(true);
            const userRaw = await AsyncStorage.getItem('user');
            const user = JSON.parse(userRaw);

            const payload = {
                title,
                externalUrl: url,
                deliveryMode: 'external', // Tells the backend it's a link
                deadlineAt: deadline ? new Date(deadline).toISOString() : null,
                instructorId: user._id || user.id,
                questions: [] // Links don't have built-in questions
            };

            await api.post('/assessments', payload);
            toastSuccess("Link assessment created!");
            navigation.goBack();
        } catch (error) {
            console.error("Create Error:", error);
            toastError("Failed to create assessment.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
            <Text style={[styles.label, { color: theme.text }]}>Assessment Title</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="e.g., Midterm Exam" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

            <Text style={[styles.label, { color: theme.text }]}>External URL</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="https://forms.google.com/..." placeholderTextColor="#94A3B8" value={url} onChangeText={setUrl} autoCapitalize="none" />

            <Text style={[styles.label, { color: theme.text }]}>Deadline (YYYY-MM-DD) - Optional</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="2026-10-31" placeholderTextColor="#94A3B8" value={deadline} onChangeText={setDeadline} />

            <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Link Assessment</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 15 },
    input: { padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15 },
    btn: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 30 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});