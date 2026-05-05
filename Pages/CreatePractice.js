import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function CreatePractice({ route, navigation }) {
    const type = route?.params?.type || 'flashcard'; 
    const { theme } = useContext(ThemeContext);
    
    const [title, setTitle] = useState('');
    const [items, setItems] = useState(
        type === 'flashcard' 
            ? [{ front: '', back: '' }] 
            : [{ text: '', options: ['', '', '', ''], correctIndex: 0, format: 'multiple_choice' }]
    );
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        AsyncStorage.getItem('user').then(u => {
            if(u) setUserId(JSON.parse(u)._id);
        });
    }, []);

    const addItem = () => {
        if (type === 'flashcard') {
            setItems([...items, { front: '', back: '' }]);
        } else {
            setItems([...items, { text: '', options: ['', '', '', ''], correctIndex: 0, format: 'multiple_choice' }]);
        }
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            const newItems = [...items];
            newItems.splice(index, 1);
            setItems(newItems);
        } else {
            toastError("You must have at least one item.");
        }
    };

const handleSave = async () => {
        if (!title.trim()) return toastError("Please enter a title.");
        
        const isValid = items.every(item => 
            type === 'flashcard' ? (item.front.trim() && item.back.trim()) : (item.text.trim() && item.options.every(o => o.trim()))
        );
        
        if (!isValid) return toastError("Please fill in all fields for every item.");
        if (!userId) return toastError("User not found. Please log in again.");

        setLoading(true);

        try {
            // Setup immediate availability and a far-future deadline for practice
            const now = new Date();
            const futureDeadline = new Date();
            futureDeadline.setFullYear(now.getFullYear() + 5);

            // Build the payload exactly as the backend expects it
            const payload = {
                title: title.trim(),
                quizType: type, // 'flashcard' or 'test'
                deliveryMode: 'internal',
                createdBy: userId, // Link it to the student so they own it
                allowRetakes: true,
                maxRetakes: 20, // Simulates unlimited practice retakes
                availableAt: now.toISOString(),         // REQUIRED BY BACKEND
                deadlineAt: futureDeadline.toISOString(), // REQUIRED BY BACKEND
                closeOnDeadline: false,
                timer: { enabled: false, minutes: null },
                questions: type === 'test' ? items.map(q => ({
                    format: q.format || 'multiple_choice',
                    text: q.text,
                    points: 1,
                    options: q.options,
                    correctIndex: q.correctIndex
                })) : [],
                flashcards: type === 'flashcard' ? items.map(f => ({
                    front: f.front,
                    back: f.back
                })) : []
            };

            await api.post('/assessments', payload);
            
            toastSuccess(`Practice ${type === 'flashcard' ? 'deck' : 'test'} successfully saved!`);
            navigation.goBack();
        } catch (err) {
            console.log("Save error:", err.response?.data || err.message);
            toastError(err.response?.data?.message || "Failed to save to server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="dark-content" />
            
            <View style={[localStyles.header, { backgroundColor: theme.card }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.iconBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[localStyles.headerTitle, { color: theme.text }]}>New {type === 'flashcard' ? 'Flash Deck' : 'Practice Test'}</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading} style={localStyles.saveBtn}>
                    {loading ? <ActivityIndicator color="#153c2a" size="small" /> : <Text style={localStyles.saveText}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
                <Text style={localStyles.label}>Title / Topic</Text>
                <View style={[localStyles.inputWrapper, { backgroundColor: theme.card }]}>
                    <TextInput 
                        style={[localStyles.input, { color: theme.text }]} 
                        placeholder={`e.g. Fungal Anatomy ${type === 'flashcard' ? 'Deck' : 'Quiz'}`}
                        placeholderTextColor="#94A3B8"
                        value={title}
                        onChangeText={setTitle}
                    />
                </View>

                <View style={{ marginTop: 25 }}>
                    {items.map((item, index) => (
                        <View key={index} style={[localStyles.itemCard, { backgroundColor: theme.card }]}>
                            <View style={localStyles.itemHeader}>
                                <View style={localStyles.badge}>
                                    <Text style={localStyles.badgeText}>{type === 'flashcard' ? 'CARD' : 'QUESTION'} {index + 1}</Text>
                                </View>
                                <TouchableOpacity onPress={() => removeItem(index)} style={localStyles.deleteBtn}>
                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </View>

                            {type === 'flashcard' ? (
                                <>
                                    <Text style={localStyles.subLabel}>Front (Term)</Text>
                                    <TextInput 
                                        style={[localStyles.fieldInput, { color: theme.text, backgroundColor: theme.bg }]} 
                                        placeholder="Enter the term or question" 
                                        placeholderTextColor="#94A3B8"
                                        value={item.front}
                                        onChangeText={(val) => {
                                            const newItems = [...items];
                                            newItems[index].front = val;
                                            setItems(newItems);
                                        }}
                                    />
                                    <Text style={[localStyles.subLabel, { marginTop: 15 }]}>Back (Definition)</Text>
                                    <TextInput 
                                        style={[localStyles.fieldInput, { color: theme.text, backgroundColor: theme.bg, minHeight: 80 }]} 
                                        placeholder="Enter the definition or answer" 
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        textAlignVertical="top"
                                        value={item.back}
                                        onChangeText={(val) => {
                                            const newItems = [...items];
                                            newItems[index].back = val;
                                            setItems(newItems);
                                        }}
                                    />
                                </>
                            ) : (
                                <>
                                    <Text style={localStyles.subLabel}>Question</Text>
                                    <TextInput 
                                        style={[localStyles.fieldInput, { color: theme.text, backgroundColor: theme.bg, fontWeight: 'bold' }]} 
                                        placeholder="Enter the question" 
                                        placeholderTextColor="#94A3B8"
                                        value={item.text}
                                        onChangeText={(val) => {
                                            const newItems = [...items];
                                            newItems[index].text = val;
                                            setItems(newItems);
                                        }}
                                    />
                                    
                                    <Text style={[localStyles.subLabel, { marginTop: 15, marginBottom: 10 }]}>Options & Correct Answer</Text>
                                    {item.options.map((opt, optIdx) => (
                                        <View key={optIdx} style={localStyles.optionRow}>
                                            <TouchableOpacity 
                                                style={[localStyles.radioBtn, item.correctIndex === optIdx && localStyles.radioActive]}
                                                onPress={() => {
                                                    const newItems = [...items];
                                                    newItems[index].correctIndex = optIdx;
                                                    setItems(newItems);
                                                }}
                                            >
                                                <Ionicons 
                                                    name={item.correctIndex === optIdx ? "checkmark" : "ellipse-outline"} 
                                                    size={16} color={item.correctIndex === optIdx ? "#fff" : "#94A3B8"} 
                                                />
                                            </TouchableOpacity>
                                            <TextInput 
                                                style={[localStyles.optInput, { backgroundColor: theme.bg, color: theme.text, borderColor: item.correctIndex === optIdx ? '#10B981' : 'transparent' }]} 
                                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                                placeholderTextColor="#94A3B8"
                                                value={opt}
                                                onChangeText={(val) => {
                                                    const newItems = [...items];
                                                    newItems[index].options[optIdx] = val;
                                                    setItems(newItems);
                                                }}
                                            />
                                        </View>
                                    ))}
                                </>
                            )}
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={[localStyles.addBtn, { backgroundColor: theme.card }]} onPress={addItem}>
                    <Ionicons name="add" size={20} color="#153c2a" />
                    <Text style={localStyles.addBtnText}>Add Another Item</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    iconBtn: { padding: 5 },
    headerTitle: { fontSize: 16, fontWeight: '900' },
    saveBtn: { backgroundColor: '#E7F5EE', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
    saveText: { color: '#153c2a', fontWeight: '900', fontSize: 13 },
    label: { fontSize: 12, fontWeight: '900', color: '#94A3B8', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
    inputWrapper: { borderRadius: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
    input: { paddingHorizontal: 20, height: 55, fontSize: 16, fontWeight: '600' },
    itemCard: { padding: 20, borderRadius: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '900', color: '#64748B', letterSpacing: 0.5 },
    deleteBtn: { backgroundColor: '#FEE2E2', padding: 6, borderRadius: 8 },
    subLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6 },
    fieldInput: { borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: '#F1F5F9' },
    optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    radioBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    radioActive: { backgroundColor: '#10B981' },
    optInput: { flex: 1, borderRadius: 12, paddingHorizontal: 15, height: 45, fontSize: 14, fontWeight: '500', borderWidth: 1 },
    addBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 16, borderWidth: 1.5, borderColor: '#153c2a', borderStyle: 'dashed' },
    addBtnText: { marginLeft: 8, fontWeight: '900', color: '#153c2a', fontSize: 14 }
});