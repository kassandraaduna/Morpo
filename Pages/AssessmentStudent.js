import React, { useEffect, useState, useContext, useCallback } from 'react';
import { 
    View, Text, FlatList, SectionList, TouchableOpacity, ActivityIndicator, 
    RefreshControl, StyleSheet, Platform, StatusBar, Modal, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function AssessmentStudent({ navigation }) {
    const { theme } = useContext(ThemeContext);
    
    const [currentUser, setCurrentUser] = useState(null); 
    const [mainTab, setMainTab] = useState('instructor'); 
    const [subTab, setSubTab] = useState('upcoming'); // Updated default tab
    const [showTypeModal, setShowTypeModal] = useState(false);
    
    const [instructorAssessments, setInstructorAssessments] = useState([]);
    const [localCompletedExt, setLocalCompletedExt] = useState([]);
    const [practiceAssessments, setPracticeAssessments] = useState([]);
    const [practiceHistory, setPracticeHistory] = useState({});
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(useCallback(() => { fetchData(); }, []));

const fetchData = async () => {
        try {
            const userRaw = await AsyncStorage.getItem('user');
            if (!userRaw) return;
            
            const userObj = JSON.parse(userRaw);
            setCurrentUser(userObj);
            
            // Pass timestamp bypass parameter to ensure network bypasses local cache
            const res = await api.get(`/assessments?studentId=${userObj._id}&_t=${Date.now()}`);
            const allAssessments = res.data?.data || [];
            
            const rawExt = await AsyncStorage.getItem('external_completed');
            const localExtIds = rawExt ? JSON.parse(rawExt) : [];
            setLocalCompletedExt(localExtIds);

            const instructors = allAssessments.filter(a => 
                a.createdBy !== userObj._id && 
                a.isPracticeOnly !== true && 
                a.quizType !== 'flashcard'
            );

            const practices = allAssessments.filter(a => 
                a.createdBy === userObj._id || 
                a.isPracticeOnly === true || 
                a.quizType === 'flashcard'
            );

            setInstructorAssessments(instructors);
            setPracticeAssessments(practices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

        } catch (err) {
            toastError('Failed to load assessments');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    const deletePractice = (id) => {
        Alert.alert("Delete Practice", "Are you sure you want to remove this practice set?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await api.delete(`/assessments/${id}`);
                    setPracticeAssessments(prev => prev.filter(p => p._id !== id));
                    toastSuccess("Practice deleted globally.");
                } catch (e) {
                    toastError("Failed to delete practice.");
                }
            }}
        ]);
    };

    const renderInstructorCard = ({ item }) => {
        const isExternalLink = item.deliveryMode === 'external' || item.link || item.externalUrl;
        const lastScore = item.latestAttempt?.percent || 0;
        const isClosed = item.isClosed;
        const canRetake = item.canRetake;
        const timerText = item.timer?.enabled ? `${item.timer.minutes} min timer` : 'No timer';
        const isPassing = lastScore >= 70;

        return (
            <View style={[localStyles.card, { backgroundColor: theme.card }]}>
                <View style={localStyles.cardHeader}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                            {item.title.toUpperCase()}
                        </Text>
                        
                        {/* CRASH FIXED: Safely rendered Icon and Text inside a View */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                            {isExternalLink ? (
                                <>
                                    <Ionicons name="link-outline" size={13} color="#64748B" />
                                    <Text style={[localStyles.metaText, { marginLeft: 4 }]}>External Link Assessment</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                                    <Text style={[localStyles.metaText, { marginLeft: 4, marginRight: 8 }]}>{item.questions?.length || 0} questions</Text>
                                    <Ionicons name="time-outline" size={13} color="#64748B" />
                                    <Text style={[localStyles.metaText, { marginLeft: 4 }]}>{timerText}</Text>
                                </>
                            )}
                        </View>

                        {item.deadlineAt && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                                <Text style={[localStyles.metaText, { marginLeft: 4 }]}>
                                    Due: {new Date(item.deadlineAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(item.deadlineAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        {isClosed ? (
                            <View style={[localStyles.statusBadge, { backgroundColor: '#F3F4F6' }]}><Text style={[localStyles.badgeText, { color: '#64748B' }]}>CLOSED</Text></View>
                        ) : isExternalLink && item.isCompleted ? (
                            <View style={[localStyles.statusBadge, { backgroundColor: '#FEF3C7' }]}><Text style={[localStyles.badgeText, { color: '#D97706' }]}>UNDER REVIEW</Text></View>
                        ) : item.isCompleted ? (
                            <View style={[localStyles.statusBadge, { backgroundColor: '#E7F5EE' }]}><Text style={[localStyles.badgeText, { color: '#10B981' }]}>COMPLETED</Text></View>
                        ) : (
                            <View style={[localStyles.statusBadge, { backgroundColor: '#FEF3C7' }]}><Text style={[localStyles.badgeText, { color: '#D97706' }]}>NEW</Text></View>
                        )}
                    </View>
                </View>

                {isExternalLink ? (
                    <View style={[localStyles.scoreContainer, { backgroundColor: theme.bg, alignItems: 'center', paddingVertical: 18 }]}>
                        <Ionicons name="document-text-outline" size={24} color="#D97706" style={{ marginBottom: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
                            External submission. Scores are managed via manual instructor review.
                        </Text>
                    </View>
                ) : (
                    <View style={[localStyles.scoreContainer, { backgroundColor: theme.bg }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={localStyles.scoreLabel}>Latest Score</Text>
                            <Text style={[localStyles.scoreValue, { color: item.isCompleted ? (isPassing ? '#10B981' : '#EF4444') : theme.text }]}>
                                {item.isCompleted ? `${lastScore}%` : 'Pending'}
                            </Text>
                        </View>
                        <View style={localStyles.progressBg}>
                            <View style={[localStyles.progressFill, { width: `${lastScore}%`, backgroundColor: isPassing ? '#10B981' : '#F59E0B' }]} />
                        </View>
                        <Text style={localStyles.scoreSub}>
                            {item.isCompleted ? `${item.latestAttempt?.score || 0} / ${item.latestAttempt?.total || 0} correct answers` : 'Complete the assessment to view your score.'}
                        </Text>
                    </View>
                )}

                {isClosed ? (
                    <Text style={localStyles.closedText}>This assessment is no longer accepting submissions.</Text>
                ) : isExternalLink && (item.isCompleted || localCompletedExt.includes(item._id)) ? (
                    
                    /* FIXED: NO RETAKE BUTTON FOR EXTERNAL LINKS */
                    <View style={[localStyles.actionBtn, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1.5 }]}>
                        <Text style={[localStyles.actionBtnText, { color: '#64748B' }]}>
                            Submitted (Under Review)
                        </Text>
                    </View>

                ) : (
                    <TouchableOpacity 
                        style={[localStyles.actionBtn, { backgroundColor: (item.isCompleted || localCompletedExt.includes(item._id)) ? '#ffd000' : '#153c2a', borderColor: '#153c2a', borderWidth: 1.5 }]}
                        onPress={() => navigation.navigate('TakeAssessment', { assessmentId: item._id })}
                    >
                        <Text style={[localStyles.actionBtnText, { color: (item.isCompleted || localCompletedExt.includes(item._id)) ? '#153c2a' : '#fff' }]}>
                            {(item.isCompleted || localCompletedExt.includes(item._id)) ? 'Retake Assessment' : 'Start Assessment'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };
    
const renderPracticeCard = ({ item }) => {
        // Pull directly from the backend document metadata (synced with web attempts)
        const latest = item.latestAttempt || null;
        const attemptsCount = item.attemptCount || 0;
        const typeLabel = item.quizType === 'flashcard' ? 'FLASH CARD' : 'PRACTICE TEST';

        return (
            <View style={[localStyles.card, { backgroundColor: theme.card }]}>
                <View style={localStyles.cardHeader}>
                    <Text style={[localStyles.cardTitle, { color: theme.text, flex: 1, paddingRight: 10 }]} numberOfLines={2}>
                        {item.title.toUpperCase()}
                    </Text>
                    <View style={[localStyles.statusBadge, { backgroundColor: '#E7F5EE', alignSelf: 'flex-start' }]}>
                        <Text style={[localStyles.badgeText, { color: '#10B981' }]}>{typeLabel}</Text>
                    </View>
                </View>

                <Text style={localStyles.metaText}>
                    <Ionicons name="calendar-outline" size={15} /> Created: {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <Text style={localStyles.metaText}>
                    <Ionicons name="infinite" size={15} /> Unlimited Retakes (Local Practice)
                </Text>
                
                {item.quizType !== 'flashcard' && (
                    <View style={[localStyles.scoreContainer, { backgroundColor: theme.bg, marginTop: 15 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={localStyles.scoreLabel}>Latest Practice Score</Text>
                            <Text style={[localStyles.scoreValue, { color: latest ? '#10B981' : theme.text }]}>
                                {latest ? `${latest.percent}%` : 'No attempts'}
                            </Text>
                        </View>
                        <View style={localStyles.progressBg}>
                            <View style={[localStyles.progressFill, { width: `${latest?.percent || 0}%`, backgroundColor: '#10B981' }]} />
                        </View>
                        <Text style={localStyles.scoreSub}>
                            {attemptsCount > 0 
                                ? `${attemptsCount} Attempt${attemptsCount > 1 ? 's' : ''} Completed` 
                                : 'Complete the practice test to view your score.'}
                        </Text>
                    </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                    <TouchableOpacity 
                        style={[localStyles.actionBtn, { flex: 1, backgroundColor: '#153c2a', marginTop: 0 }]}
                        onPress={() => navigation.navigate('TakeAssessment', { assessmentId: item._id })}
                    >
                        <Text style={[localStyles.actionBtnText, { color: '#fff' }]}>Open Practice</Text>
                    </TouchableOpacity>

                    {item.createdBy === currentUser?._id && (
                        <TouchableOpacity 
                            style={[localStyles.actionBtn, { paddingHorizontal: 20, backgroundColor: '#FEE2E2', borderWidth: 0, marginTop: 0 }]}
                            onPress={() => deletePractice(item._id)}
                        >
                            <Ionicons name="trash" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    // FIX: New Sorting & Grouping function mapping to SectionList
    const getInstructorSections = () => {
        const now = new Date().getTime();

        // 1. Filter accurately matching web terms
        let filtered = instructorAssessments.filter(a => {
            const hasTaken = a.isCompleted === true || (a.latestAttempt && a.latestAttempt.percent !== undefined);
            const deadline = a.deadlineAt ? new Date(a.deadlineAt).getTime() : null;

            if (subTab === 'upcoming') {
                return !hasTaken && (!deadline || deadline >= now);
            } else if (subTab === 'past due') {
                return !hasTaken && (deadline && deadline < now);
            } else if (subTab === 'completed') {
                return hasTaken;
            }
            return false;
        });

        // 2. Sort by Deadline securely
        filtered.sort((a, b) => {
            if (!a.deadlineAt && b.deadlineAt) return 1; // Send no-dates to bottom
            if (a.deadlineAt && !b.deadlineAt) return -1;
            if (!a.deadlineAt && !b.deadlineAt) return new Date(b.createdAt) - new Date(a.createdAt);

            const dateA = new Date(a.deadlineAt).getTime();
            const dateB = new Date(b.deadlineAt).getTime();

            // Past due shows newest missed first. Upcoming shows closest due first.
            return (subTab === 'past due' || subTab === 'completed') ? dateB - dateA : dateA - dateB;
        });

        // 3. Group by Deadline String
        const grouped = {};
        filtered.forEach(item => {
            let dateString = 'No Due Date';
            if (item.deadlineAt) {
                const dateObj = new Date(item.deadlineAt);
                dateString = dateObj.toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                });
            }
            if (!grouped[dateString]) grouped[dateString] = [];
            grouped[dateString].push(item);
        });

        // 4. Return as SectionList Data
        const orderedKeys = [...new Set(filtered.map(item => {
            if (item.deadlineAt) {
                const dateObj = new Date(item.deadlineAt);
                return dateObj.toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                });
            }
            return 'No Due Date';
        }))];

        return orderedKeys.map(key => ({
            title: key,
            data: grouped[key]
        }));
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />
            
            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerTopRow}>
                    
                    {/* Centered Text Container */}
                    <View style={{ alignItems: 'center' }}>
                        <Text style={localStyles.headerTitle}>Assessments</Text>
                        <Text style={localStyles.headerSub}>
                            {mainTab === 'instructor' 
                                ? 'Test your knowledge with instructor quizzes.' 
                                : 'Build custom flashcards for self-review.'}
                        </Text>
                    </View>

                    {/* Absolute positioned button so it doesn't disrupt the center alignment */}
                    <View style={{ position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center' }}>
                        {mainTab === 'practice' && (
                            <TouchableOpacity style={localStyles.topAddBtn} onPress={() => setShowTypeModal(true)}>
                                <Ionicons name="add" size={20} color="#153c2a" />
                                <Text style={localStyles.topAddBtnText}>Create</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            <View style={localStyles.mainTabsWrapper}>
                <TouchableOpacity 
                    onPress={() => setMainTab('instructor')} 
                    style={[localStyles.mainTab, mainTab === 'instructor' && localStyles.mainTabActive]}
                >
                    <Text style={[localStyles.mainTabText, { color: mainTab === 'instructor' ? '#153c2a' : '#94A3B8' }]}>Instructor Assigned</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setMainTab('practice')} 
                    style={[localStyles.mainTab, mainTab === 'practice' && localStyles.mainTabActive]}
                >
                    <Text style={[localStyles.mainTabText, { color: mainTab === 'practice' ? '#153c2a' : '#94A3B8' }]}>Practice Studio</Text>
                </TouchableOpacity>
            </View>

            {mainTab === 'instructor' && (
                <View style={localStyles.subTabContainer}>
                    {/* FIX: Tab names exactly match web layout */}
                    {['upcoming', 'past due', 'completed'].map((tab) => (
                        <TouchableOpacity key={tab} onPress={() => setSubTab(tab)} style={localStyles.subTabItem}>
                            <Text style={[localStyles.subTabText, subTab === tab && localStyles.subTabTextActive]}>
                                {tab.toUpperCase()}
                            </Text>
                            {subTab === tab && <View style={localStyles.activeIndicator} />}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#153c2a" /></View>
            ) : mainTab === 'instructor' ? (
                <SectionList
                    sections={getInstructorSections()}
                    keyExtractor={(item) => item._id}
                    renderItem={renderInstructorCard}
                    // FIX: Green Date Divider
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={{paddingVertical: 5, paddingHorizontal: 5, marginBottom: 5, alignSelf: 'flex-start', }}>
                            <Text style={{ color: '#153c2a', fontWeight: '900', fontSize: 18, textTransform: 'uppercase', }}>{title}</Text>
                        </View>
                    )}
                    contentContainerStyle={localStyles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchData();}} tintColor="#153c2a" />}
                    ListEmptyComponent={
                        <View style={localStyles.emptyState}>
                            <Ionicons name="clipboard-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
                            <Text style={{ color: theme.text, textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                                No assessments found.
                            </Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={practiceAssessments}
                    keyExtractor={(item) => item._id}
                    renderItem={renderPracticeCard}
                    contentContainerStyle={localStyles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchData();}} tintColor="#153c2a" />}
                    ListEmptyComponent={
                        <View style={localStyles.emptyState}>
                            <Ionicons name="clipboard-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
                            <Text style={{ color: theme.text, textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                                No practice sets yet.
                            </Text>
                            <Text style={{ color: theme.subText, fontSize: 12, marginTop: 5 }}>Tap 'Create' to build your own study tools.</Text>
                        </View>
                    }
                />
            )}

            {/* Type Selection Modal */}
            <Modal visible={showTypeModal} transparent animationType="fade">
                <View style={localStyles.modalOverlay}>
                    <View style={[localStyles.modalCard, { backgroundColor: theme.card }]}>
                        <View style={localStyles.modalHeader}>
                            <Text style={[localStyles.modalTitle, { color: theme.text }]}>Practice Type</Text>
                            <TouchableOpacity onPress={() => setShowTypeModal(false)} style={localStyles.closeIconBg}>
                                <Ionicons name="close" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={localStyles.modalSub}>Select a format for your self-review tool.</Text>
                        
                        <View style={localStyles.modalGrid}>
                            <TouchableOpacity 
                                style={[localStyles.typeOption, { backgroundColor: theme.bg }]}
                                onPress={() => { setShowTypeModal(false); navigation.navigate('CreatePractice', { type: 'flashcard' }); }}
                            >
                                <View style={localStyles.typeIconCircle}>
                                    <Ionicons name="layers" size={28} color="#153c2a" />
                                </View>
                                <Text style={[localStyles.typeTitle, { color: theme.text }]}>Flashcards</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[localStyles.typeOption, { backgroundColor: theme.bg }]}
                                onPress={() => { setShowTypeModal(false); navigation.navigate('CreatePractice', { type: 'test' }); }}
                            >
                                <View style={localStyles.typeIconCircle}>
                                    <Ionicons name="checkbox" size={28} color="#153c2a" />
                                </View>
                                <Text style={[localStyles.typeTitle, { color: theme.text }]}>Practice Test</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingTop:40, paddingBottom: 30, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', position: 'relative' },
    headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center' },
    headerSub: { fontSize: 13, color: '#d1fae5', marginTop: 4, lineHeight: 18, textAlign: 'center' },
    topIconBtn: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    topAddBtn: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 10, elevation: 2 },
    topAddBtnText: { color: '#153c2a', fontWeight: '900', fontSize: 12, marginLeft: 4 },
    mainTabsWrapper: { flexDirection: 'row', marginHorizontal: 22, marginTop: 20, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4 },
    mainTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
    mainTabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    mainTabText: { fontSize: 15, fontWeight: '600', color: '#64748B', textAlign: 'center' },
    subTabContainer: { flexDirection: 'row', paddingHorizontal: 25, marginTop: 20, gap: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    subTabItem: { paddingBottom: 12, position: 'relative' },
    subTabText: { fontSize: 13, color: '#94A3B8', fontWeight: '700' },
    subTabTextActive: { color: '#153c2a', fontWeight: '900' },
    activeIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 3, backgroundColor: '#153c2a', borderRadius: 3 },
    listContent: { padding: 20, paddingBottom: 100 },
    card: { borderRadius: 10, padding: 20, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    cardTitle: { fontSize: 15, fontWeight: '900', marginBottom: 6 },
    metaText: { fontSize: 13, color: '#94A3B8', marginBottom: 4, fontWeight: '600' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    scoreContainer: { padding: 15, borderRadius: 10 },
    scoreLabel: { fontSize: 13, fontWeight: '800', color: '#64748B' },
    scoreValue: { fontSize: 18, fontWeight: '900' },
    progressBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    scoreSub: { fontSize: 12, color: '#94A3B8', marginTop: 8, fontWeight: '700' },
    actionBtn: { marginTop: 20, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    actionBtnText: { fontWeight: '900', fontSize: 15 },
    closedText: { marginTop: 15, textAlign: 'center', color: '#EF4444', fontSize: 12, fontWeight: '600' },
    emptyState: { alignItems: 'center', marginTop: 80 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { width: '100%', padding: 25, borderRadius: 10, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: '900' },
    closeIconBg: { backgroundColor: '#F1F5F9', padding: 6, borderRadius: 10 },
    modalSub: { fontSize: 13, color: '#94A3B8', marginBottom: 25, fontWeight: '600' },
    modalGrid: { flexDirection: 'row', gap: 15 },
    typeOption: { flex: 1, padding: 20, borderRadius: 10, alignItems: 'center', elevation: 1 },
    typeIconCircle: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#E7F5EE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    typeTitle: { fontSize: 15, fontWeight: '900' }
});