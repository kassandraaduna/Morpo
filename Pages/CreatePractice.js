import React, { useState, useContext, useEffect } from 'react';
import { 
    View, Text, TextInput, ScrollView, TouchableOpacity, 
    StyleSheet, Platform, StatusBar, KeyboardAvoidingView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

// FORMAT MATCHES SCHEMA EXACTLY: 'written' instead of 'written_response'
const QUESTION_FORMATS = [
    { label: 'Multiple Choice', value: 'multiple_choice' },
    { label: 'True / False', value: 'true_false' },
    { label: 'Identification', value: 'identification' },
    { label: 'Written Response', value: 'written' }
];

export default function CreatePractice({ route, navigation }) {
    const type = route?.params?.type || 'flashcard'; 
    const { theme } = useContext(ThemeContext);
    
    const [user, setUser] = useState(null);
    const [title, setTitle] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const rawUser = await AsyncStorage.getItem('user');
            if (rawUser) setUser(JSON.parse(rawUser));
        };
        loadUser();
        addNewItem();
    }, []);

    const addNewItem = () => {
        if (type === 'flashcard') {
            setItems([...items, { text: '', answer: '' }]); 
        } else {
            setItems([...items, { 
                format: 'multiple_choice', 
                text: '', 
                points: 1, 
                options: ['', '', '', ''], 
                correctIndex: 0,
                correctAnswer: '' 
            }]);
        }
    };

    const updateItem = (index, field, value) => {
        const updated = [...items];
        updated[index][field] = value;
        setItems(updated);
    };

    const updateOption = (itemIndex, optionIndex, value) => {
        const updated = [...items];
        updated[itemIndex].options[optionIndex] = value;
        setItems(updated);
    };

    const removeItem = (index) => {
        if (items.length === 1) return toastError('You must have at least one item.');
        const updated = items.filter((_, i) => i !== index);
        setItems(updated);
    };

    const handleSave = async () => {
        if (!title.trim()) return toastError("Please enter a title.");
        
        for (let i = 0; i < items.length; i++) {
            if (!items[i].text.trim()) return toastError(`Item ${i + 1} is missing a question/term.`);
            
            if (type === 'flashcard') {
                if (!items[i].answer.trim()) return toastError(`Flashcard ${i + 1} is missing a definition.`);
            } else {
                const fmt = items[i].format;
                if (fmt === 'multiple_choice') {
                    for (let j = 0; j < 4; j++) {
                        if (!items[i].options[j].trim()) return toastError(`Question ${i + 1} is missing an option.`);
                    }
                } else if (fmt === 'true_false') {
                    if (!items[i].correctAnswer) return toastError(`Question ${i + 1} is missing a True/False selection.`);
                } else if (fmt === 'identification' || fmt === 'written') {
                    if (!items[i].correctAnswer?.trim()) return toastError(`Question ${i + 1} is missing a correct answer.`);
                }
            }
        }

        try {
            setLoading(true);
            
            const payload = {
                title,
                // THE ROOT FIX: Schema only allows 'test' or 'flashcard'
                quizType: type === 'flashcard' ? 'flashcard' : 'test', 
                
                isPracticeOnly: true,
                status: 'published',
                deliveryMode: 'internal', 
                createdBy: user?._id,
                
                availableAt: new Date().toISOString(),
                deadlineAt: new Date(Date.now() + 31536000000).toISOString(), 
                assignToAll: false,
                targetSections: [],
                excludedStudentIds: [], // matches schema
                targetStudentIds: [],   // matches schema
                closeOnDeadline: false, // matches schema
                allowRetakes: true,     // matches schema
                maxRetakes: 20,         // max allowed in schema
                timer: { enabled: false, minutes: null },

                questions: [],
                flashcards: []
            };

            if (type === 'flashcard') {
                payload.flashcards = items.map(item => ({
                    front: item.text,
                    back: item.answer
                }));
            } else {
                // EXACT SCHEMA MAPPING FOR QUESTIONS
                payload.questions = items.map(item => {
                    const baseQ = {
                        format: item.format,
                        text: item.text,             
                        points: 1
                    };

                    if (item.format === 'multiple_choice') {
                        baseQ.options = item.options;
                        baseQ.correctIndex = item.correctIndex;
                    } else if (item.format === 'true_false') {
                        baseQ.options = ['True', 'False'];
                        baseQ.correctIndex = item.correctAnswer === 'True' ? 0 : 1;
                    } else if (item.format === 'identification' || item.format === 'written') {
                        // Schema uses acceptedAnswers array, not a string!
                        baseQ.acceptedAnswers = [item.correctAnswer.trim()];
                    }

                    return baseQ;
                });
            }

            await api.post('/assessments', payload);
            toastSuccess('Practice set created successfully!');
            navigation.goBack();

        } catch (error) {
            console.error('Create Practice API Error:', error?.response?.data || error.message);
            toastError(error?.response?.data?.message || 'Failed to create practice test.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme?.bg || '#F4F7F6' }}>
            <StatusBar barStyle="light-content" />
            
            <View style={localStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.iconBtn}>
                    <Ionicons name="close" size={25} color="#FFF" />
                </TouchableOpacity>
                
                <View style={localStyles.headerTitleContainer}>
                    <Text style={localStyles.headerTitle}>
                        CREATE {type === 'flashcard' ? 'FLASHCARDS' : 'PRACTICE TEST'}
                    </Text>
                </View>

                <TouchableOpacity 
                    onPress={handleSave} 
                    style={[localStyles.saveBtn, { minWidth: 75, alignItems: 'center' }]} 
                    disabled={loading}
                >
                    <Text style={localStyles.saveText}>
                        {loading ? 'Saving...' : 'Save'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                
                <Text style={localStyles.label}>Practice Set Title</Text>
                <View style={[localStyles.inputWrapper, { backgroundColor: theme?.card || '#FFF', marginBottom: 25 }]}>
                    <TextInput
                        placeholder={type === 'flashcard' ? "e.g., Biology Terms - Chapter 1" : "e.g., Midterm Review Quiz"}
                        placeholderTextColor="#94A3B8"
                        style={[localStyles.input, { color: theme?.text || '#1E293B' }]}
                        value={title}
                        onChangeText={setTitle}
                    />
                </View>

                {items.map((item, index) => (
                    <View key={index} style={[localStyles.itemCard, { backgroundColor: theme?.card || '#FFF' }]}>
                        <View style={localStyles.itemHeader}>
                            <View style={localStyles.badge}>
                                <Text style={localStyles.badgeText}>
                                    {type === 'flashcard' ? `CARD ${index + 1}` : `QUESTION ${index + 1}`}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => removeItem(index)} style={localStyles.deleteBtn}>
                                <Ionicons name="trash" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </View>

                        {/* Format Selector for Assessments */}
                        {type !== 'flashcard' && (
                            <>
                                <Text style={localStyles.subLabel}>Question Format</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                                    {QUESTION_FORMATS.map(fmt => {
                                        const isSelected = item.format === fmt.value;
                                        return (
                                            <TouchableOpacity
                                                key={fmt.value}
                                                style={[localStyles.formatChip, isSelected && localStyles.formatChipActive]}
                                                onPress={() => updateItem(index, 'format', fmt.value)}
                                            >
                                                <Text style={[localStyles.formatChipText, isSelected && localStyles.formatChipTextActive]}>
                                                    {fmt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </>
                        )}

                        <Text style={localStyles.subLabel}>{type === 'flashcard' ? 'Term' : 'Question'}</Text>
                        <TextInput
                            placeholder={type === 'flashcard' ? "Enter term here..." : "Enter question here..."}
                            placeholderTextColor="#CBD5E1"
                            style={[localStyles.fieldInput, { color: theme?.text || '#1E293B', marginBottom: 15, backgroundColor: theme?.bg || '#F8FAFC' }]}
                            value={item.text}
                            onChangeText={(val) => updateItem(index, 'text', val)}
                            multiline
                        />

                        {type === 'flashcard' ? (
                            <>
                                <Text style={localStyles.subLabel}>Definition</Text>
                                <TextInput
                                    placeholder="Enter definition here..."
                                    placeholderTextColor="#CBD5E1"
                                    style={[localStyles.fieldInput, { color: theme?.text || '#1E293B', backgroundColor: theme?.bg || '#F8FAFC', minHeight: 80, textAlignVertical: 'top' }]}
                                    value={item.answer}
                                    onChangeText={(val) => updateItem(index, 'answer', val)}
                                    multiline
                                />
                            </>
                        ) : item.format === 'multiple_choice' ? (
                            <>
                                <Text style={localStyles.subLabel}>Answer Options (Select the correct one)</Text>
                                {item.options.map((opt, optIdx) => (
                                    <View key={optIdx} style={localStyles.optionRow}>
                                        <TouchableOpacity 
                                            style={[localStyles.radioBtn, item.correctIndex === optIdx && localStyles.radioActive]}
                                            onPress={() => updateItem(index, 'correctIndex', optIdx)}
                                        >
                                            {item.correctIndex === optIdx && <Ionicons name="checkmark" size={16} color="#FFF" />}
                                        </TouchableOpacity>
                                        <TextInput
                                            placeholder={`Option ${optIdx + 1}`}
                                            placeholderTextColor="#CBD5E1"
                                            style={[localStyles.optInput, { color: theme?.text || '#1E293B', backgroundColor: theme?.bg || '#F8FAFC', borderColor: item.correctIndex === optIdx ? '#10B981' : '#F1F5F9' }]}
                                            value={opt}
                                            onChangeText={(val) => updateOption(index, optIdx, val)}
                                        />
                                    </View>
                                ))}
                            </>
                        ) : item.format === 'true_false' ? (
                            <>
                                <Text style={localStyles.subLabel}>Select Correct Answer</Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 5 }}>
                                    {['True', 'False'].map(opt => {
                                        const isSelected = item.correctAnswer === opt;
                                        return (
                                            <TouchableOpacity
                                                key={opt}
                                                style={[
                                                    localStyles.tfBtn,
                                                    isSelected && { backgroundColor: '#10B981', borderColor: '#10B981' }
                                                ]}
                                                onPress={() => updateItem(index, 'correctAnswer', opt)}
                                            >
                                                <Text style={[localStyles.tfBtnText, isSelected && { color: '#FFF' }]}>{opt}</Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={localStyles.subLabel}>Correct Answer</Text>
                                <TextInput
                                    placeholder={item.format === 'identification' ? "Enter exact answer..." : "Enter expected answer..."}
                                    placeholderTextColor="#CBD5E1"
                                    style={[localStyles.fieldInput, { color: theme?.text || '#1E293B', backgroundColor: theme?.bg || '#F8FAFC', minHeight: item.format === 'written' ? 80 : undefined, textAlignVertical: item.format === 'written' ? 'top' : 'center' }]}
                                    value={item.correctAnswer || ''}
                                    onChangeText={(val) => updateItem(index, 'correctAnswer', val)}
                                    multiline={item.format === 'written'}
                                />
                            </>
                        )}
                    </View>
                ))}

                <TouchableOpacity onPress={addNewItem} style={localStyles.addBtn}>
                    <Ionicons name="add-circle" size={24} color="#153c2a" />
                    <Text style={localStyles.addBtnText}>
                        {type === 'flashcard' ? 'Add New Card' : 'Add New Question'}
                    </Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const localStyles = StyleSheet.create({
    header: { 
        backgroundColor: '#153c2a', 
        paddingTop: Platform.OS === 'ios' ? 60 : 40, 
        paddingBottom: 30, 
        paddingHorizontal: 20, 
        borderBottomLeftRadius: 10, 
        borderBottomRightRadius: 10, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        elevation: 4, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 8 
    },
    iconBtn: { padding: 5 },
    headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 10, paddingTop:5 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', },
    saveBtn: { backgroundColor: '#E7F5EE', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
    saveText: { color: '#153c2a', fontWeight: '900', fontSize: 15 },
    label: { fontSize: 15, fontWeight: '900', color: '#7c899b', marginBottom: 8, textTransform: 'uppercase', marginTop: 10 },
    inputWrapper: { borderRadius: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
    input: { paddingHorizontal: 20, height: 55, fontSize: 15, fontWeight: '600' },
    itemCard: { padding: 20, borderRadius: 10, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    badge: { backgroundColor: '#f1f9f4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    badgeText: { fontSize: 12, fontWeight: '900', color: '#153c2a', },
    deleteBtn: { padding: 6,},
    subLabel: { fontSize: 15, fontWeight: '800', color: '#64748B', marginBottom: 6 },
    fieldInput: { borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: '#F1F5F9' },
    optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    radioBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    radioActive: { backgroundColor: '#10B981' },
    optInput: { flex: 1, borderRadius: 10, paddingHorizontal: 15, height: 45, fontSize: 15, fontWeight: '500', borderWidth: 1 },
    addBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 10, borderWidth: 1.5, borderColor: '#153c2a', borderStyle: 'dashed' },
    addBtnText: { marginLeft: 8, fontWeight: '900', color: '#153c2a', fontSize: 14 },
    formatChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    formatChipActive: { backgroundColor: '#153c2a', borderColor: '#153c2a' },
    formatChipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    formatChipTextActive: { color: '#FFF' },
    tfBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
    tfBtnText: { fontSize: 15, fontWeight: '800', color: '#64748B' }
});