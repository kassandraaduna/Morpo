import React, { useState, useEffect, useContext } from 'react';
import { 
    View, Text, TextInput, ScrollView, TouchableOpacity, 
    StyleSheet, Platform, StatusBar, KeyboardAvoidingView, LayoutAnimation, UIManager, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './src/context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const faqData = [
    // --- STUDENT FAQS ---
    { id: 1, role: 'student', question: 'How do I take an assessment?', answer: 'Navigate to the Home screen and tap on the Assessments quick link, or go to the Learn tab and find your assigned assessments. Tap "Take Exam" to begin.' },
    { id: 2, role: 'student', question: 'Where can I find my past AI scans?', answer: 'Go to your Profile and tap on "Scan History", or use the Quick Link on the Home screen to view all your past scans and recommended lessons.' },
    { id: 3, role: 'student', question: 'How does the AI scanner work?', answer: 'You can capture or upload up to 6 images at a time for batch scanning. Once processed, the app will classify the images and instantly recommend relevant study lessons.' },
    { id: 4, role: 'student', question: 'How do I save a lesson or AI scan for later?', answer: 'You can tap the bookmark icon on any lesson or AI scan. You can access all your saved items later by going to the "Bookmarks" quick link on your Home screen or Profile.' },
    { id: 5, role: 'student', question: 'How do I use the Practice Studio?', answer: 'You can create your own custom practice sets, including Flashcards or Practice Quizzes with Multiple Choice, True/False, Identification, and Written Response formats.' },
    { id: 6, role: 'student', question: 'What happens if I fail an assessment multiple times?', answer: 'If you score below 50% for three consecutive attempts on a specific instructor-assigned assessment, MyphoAI will automatically generate a personalized remedial lesson tailored to the concepts you struggled with.' },
    { id: 7, role: 'student', question: 'Can I retake an assessment?', answer: 'Yes, if your instructor has enabled retakes for that specific assessment. The maximum number of allowed attempts will be shown before you start.' },
    { id: 8, role: 'student', question: 'Is there a time limit for assessments?', answer: 'Some assessments have a timer set by your instructor. If a timer is enabled, it will be clearly displayed before you begin the test.' },
    { id: 9, role: 'student', question: 'How do I reset my password?', answer: 'Navigate to the login screen and tap "Forgot Password", or go to your Profile and tap "Change Password". You will receive a 6-digit OTP code to your registered email address.' },
    { id: 10, role: 'student', question: 'Is an active internet connection required?', answer: 'Yes, a stable internet connection is required to sync your progress, fetch the latest assessments, submit your scores, and render 3D models.' },
    { id: 11, role: 'student', question: 'How can I review my assessment scores?', answer: 'Your score is available immediately upon submission. You can also review all past scores and instructor feedback by checking the Assessments tab or your Student Monitoring dashboard.' },

    // --- INSTRUCTOR FAQS ---
    { id: 12, role: 'instructor', question: 'How do I assign an assessment to specific sections?', answer: 'When creating an assessment, open the Settings modal. You can select specific target sections you handle from the "Target Sections" options.' },
    { id: 13, role: 'instructor', question: 'Can I generate an assessment using my own lesson materials?', answer: 'Yes! When creating a new assessment, choose "Generate with MyphoAI". You can select up to 5 of your uploaded lessons and/or attach a PDF reference document to automatically generate questions.' },
    { id: 14, role: 'instructor', question: 'What question formats can I use in manual assessments?', answer: 'The manual assessment creator supports Multiple Choice, True / False, Identification, and Written Response formats.' },
    { id: 15, role: 'instructor', question: 'How do I shuffle the question order for an assessment?', answer: 'Open the Assessment Settings while creating or editing your quiz and toggle the "Shuffle Questions Order" switch.' },
    { id: 16, role: 'instructor', question: 'Can I allow students to retake an assessment?', answer: 'Yes. In the Assessment Settings, toggle "Allow Retakes". You can then set the maximum number of attempts between 1 and 20.' },
    { id: 17, role: 'instructor', question: 'How do I preview an assessment before publishing?', answer: 'Tap the "Student View" button at the top of the assessment creator. This displays a non-submittable preview exactly as your students will see it, hiding the correct answer keys.' },
    { id: 18, role: 'instructor', question: 'How do I restore archived lessons or assessments?', answer: 'Go to "Archive Management". You can restore individual items or use the "Select All" batch action tool to restore multiple lessons and assessments at once.' },
    { id: 19, role: 'instructor', question: 'Can I set a timer for my assessments?', answer: 'Yes, you can enable an optional timer and specify the exact duration in minutes from the Assessment Settings menu.' },
    { id: 20, role: 'instructor', question: 'How do I link an external form for an assessment?', answer: 'Choose "External Link" when creating an assessment. Paste the URL of your Google Form or external quiz, set your access dates, and assign it to your target sections.' },
    { id: 21, role: 'instructor', question: 'How do I publish a drafted assessment?', answer: 'Go to the Learn tab, select Assessments, and tap the "Drafts" filter. Tap the "Publish" button on any draft card to make it instantly visible to your students.' },
    { id: 22, role: 'instructor', question: 'How do I view my students\' progress?', answer: 'Tap "Student Monitoring" on the Home screen. You can filter students by your assigned sections to view their assessment scores and overall progress.' },
];

export default function FAQs({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [searchQuery, setSearchQuery] = useState('');
    const [userRole, setUserRole] = useState('student');
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        const loadUserRole = async () => {
            try {
                const rawUser = await AsyncStorage.getItem('user');
                if (rawUser) {
                    const user = JSON.parse(rawUser);
                    if (user.role && String(user.role).toLowerCase() === 'instructor') {
                        setUserRole('instructor');
                    } else {
                        setUserRole('student');
                    }
                }
            } catch (error) {
                console.error("Failed to load user role for FAQs:", error);
            } finally {
                setLoading(false);
            }
        };

        loadUserRole();
    }, []);

    const toggleExpand = (id) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(prev => prev === id ? null : id);
    };

    const filteredFAQs = faqData.filter(faq => {
        const matchesRole = faq.role === userRole || faq.role === 'both';
        const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesRole && matchesSearch;
    });

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: theme?.bg || '#F8FAFC', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#153c2a" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme?.bg || '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor="#153c2a" />

            <View style={localStyles.header}>
                <View style={localStyles.headerTopRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={localStyles.headerTextContainer}>
                        <Text style={localStyles.headerTitle}>Frequently Asked Questions</Text>
                    </View>
                </View>

                <View style={[localStyles.searchContainer, { marginBottom: 5 }]}>
                    <Ionicons name="search" size={18} color="#64748B" style={localStyles.searchIcon} />
                    <TextInput
                        style={localStyles.searchInput}
                        placeholder={`Search ${userRole === 'instructor' ? 'Instructor' : 'Student'} FAQs...`}
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={localStyles.clearBtn}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>
                {filteredFAQs.length === 0 ? (
                    <View style={localStyles.emptyState}>
                        <Ionicons name="search-outline" size={50} color="#CBD5E1" style={{ marginBottom: 10 }} />
                        <Text style={[localStyles.emptyText, { color: theme?.text || '#1E293B' }]}>No matching FAQs found.</Text>
                        <Text style={localStyles.emptySubText}>Try adjusting your search terms.</Text>
                    </View>
                ) : (
                    filteredFAQs.map((faq) => {
                        const isExpanded = expandedId === faq.id;
                        return (
                            <TouchableOpacity 
                                key={faq.id} 
                                style={[localStyles.faqCard, { backgroundColor: theme?.card || '#FFF' }]} 
                                onPress={() => toggleExpand(faq.id)}
                                activeOpacity={0.8}
                            >
                                <View style={localStyles.questionRow}>
                                    <Text style={[localStyles.questionText, { color: '#153c2a' || theme?.subText }]}>
                                        {faq.question}
                                    </Text>
                                    <Ionicons 
                                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                                        size={20} 
                                        color="#153c2a" 
                                    />
                                </View>
                                {isExpanded && (
                                    <Text style={[localStyles.answerText, { color: '#000' || theme?.subText}]}>
                                        {faq.answer}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </KeyboardAvoidingView>
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
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    headerTopRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 15,
        position: 'relative'
    },
    backBtn: { position: 'absolute', left: 0, zIndex: 10 },
    headerTextContainer: { alignItems: 'center', paddingHorizontal: 35 },
    headerTitle: { fontSize: 25, fontWeight: '900', color: '#fff', textAlign: 'center' },
    
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 10,
        height: 50,
        paddingHorizontal: 15,
        marginBottom: 20,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '500' },
    clearBtn: { padding: 4 },

    scrollContent: { padding: 20, paddingBottom: 60 },
    
    faqCard: {
        borderRadius: 10,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 5,
    },
    questionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    questionText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '800',
        paddingRight: 15,
        lineHeight: 22,
    },
    answerText: {
        marginTop: 12,
        fontSize: 13,
        lineHeight: 22,
        fontWeight: '500',
    },
    
    emptyState: { alignItems: 'center', marginTop: 80 },
    emptyText: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    emptySubText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' }
});