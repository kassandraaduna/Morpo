import React, { useEffect, useState, useContext, useCallback } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
    StyleSheet, TextInput, RefreshControl, Image, Platform, StatusBar, ScrollView 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';

const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
};

// Cache-busting avatar URI generator
const getAvatarUri = (url, u) => {
    if (!url) return null;
    if (url.startsWith('data:image') || url.startsWith('file:')) return url;
    return `${toAbsUrl(url)}?v=${u?.updatedAt || u?.student?.updatedAt || '1'}`;
};

export default function StudentMonitoring({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // States for Section Filtering
    const [availableSections, setAvailableSections] = useState([]);
    const [activeSectionTab, setActiveSectionTab] = useState('ALL');

    const fetchMonitoring = async () => {
        try {
            // Get logged-in user to pass their ID for scoped filtering
            const userRaw = await AsyncStorage.getItem('user');
            const userObj = userRaw ? JSON.parse(userRaw) : null;
            const instructorParam = userObj?._id ? `?instructorId=${userObj._id}` : '';

            // The backend automatically filters by assignments if instructorId is provided
            const res = await api.get(`/instructor/assessment-monitoring${instructorParam}`);
            const data = res.data.data || [];
            setStudents(data);

            // Dynamically extract unique sections from the assigned students
            const sections = [...new Set(data.map(s => String(s.section || '').toUpperCase()).filter(Boolean))].sort();
            setAvailableSections(sections);

        } catch (err) {
            console.error("Monitoring Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchMonitoring(); }, []);

    // Apply Search AND Section Filters
    const filteredStudents = students.filter(s => {
        const studentSection = String(s.section || '').toUpperCase();
        
        const matchesSection = activeSectionTab === 'ALL' || studentSection === activeSectionTab;
        const matchesSearch = (s.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
                              (s.section || '').toLowerCase().includes(search.toLowerCase());
                              
        return matchesSection && matchesSearch;
    });

    const renderStudent = ({ item }) => {
        // Robust check for nested avatar locations from aggregated backend data
        const studentAvatar = item.avatar || item.studentAvatar || item.student?.avatar || null;

        return (
            <TouchableOpacity 
                style={[localStyles.studentCard, { backgroundColor: theme.card }]}
                onPress={() => navigation.navigate('StudentProgressDetail', { student: item })}
            >
                <View style={localStyles.avatarCircle}>
                    {studentAvatar ? (
                        <Image source={{ uri: getAvatarUri(studentAvatar, item) }} style={localStyles.avatarImage} />
                    ) : (
                        <Text style={localStyles.avatarText}>{getInitials(item.studentName)}</Text>
                    )}
                </View>
                <View style={{ flex: 1, marginLeft: 15, marginRight: 10 }}>
                    <Text style={[localStyles.name, { color: theme.text }]} numberOfLines={1}>
                        {(item.studentName || 'Unknown').toUpperCase()}
                    </Text>
                    <Text style={{ color: theme.subText, fontSize: 12, marginTop: 2, fontWeight: '600' }}>
                        {item.yearLevel || 'N/A'} • {item.section || 'N/A'}
                    </Text>
                </View>
                <View style={localStyles.badge}>
                    <Text style={localStyles.badgeText}>{item.assessments?.length || 0} QUIZZES</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.subText} />
            </TouchableOpacity>
        );
    };

    useFocusEffect(
    useCallback(() => {
        StatusBar.setBarStyle('light-content');
        if (Platform.OS === 'android') {
            StatusBar.setBackgroundColor('#153c2a');
        }
        }, [])
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />

            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={localStyles.headerTextContainer}>
                        <Text style={localStyles.title}>Student Monitoring</Text>
                        <Text style={localStyles.subtitle}>Track student progress and assessment scores</Text>
                    </View>
                </View>
                
                <View style={localStyles.searchBox}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput 
                        placeholder="Search student or section..." 
                        placeholderTextColor="#94A3B8"
                        style={localStyles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                        clearButtonMode="while-editing"
                    />
                </View>
            </View>

            <View style={localStyles.filterWrapper}>
                <Text style={localStyles.filterPrefix}>Filter section:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.filterScroll}>
                    {['ALL', ...availableSections].map((sec) => (
                        <TouchableOpacity
                            key={sec}
                            onPress={() => setActiveSectionTab(sec)}
                            style={[localStyles.filterBtn, activeSectionTab === sec && localStyles.filterBtnActive]}
                        >
                            <Text style={[localStyles.filterBtnText, { color: activeSectionTab === sec ? '#fff' : '#64748B' }]}>
                                {sec === 'ALL' ? 'ALL' : `${sec}`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#153c2a" /></View>
            ) : (
                <FlatList
                    data={filteredStudents}
                    keyExtractor={(item) => item.studentId || Math.random().toString()}
                    renderItem={renderStudent}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchMonitoring();}} tintColor="#153c2a" />}
                    ListEmptyComponent={
                        <View style={localStyles.emptyState}>
                            <Ionicons name="people-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
                            <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>
                                {search || activeSectionTab !== 'ALL' ? "No matching students found." : "No students enrolled."}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' },
    backBtn: { position: 'absolute', left: 0, zIndex: 10 },
    headerTextContainer: { alignItems: 'center', paddingHorizontal: 35 },
    title: { fontSize: 25, fontWeight: '900', color: '#fff', textAlign: 'center' },
    subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2, textAlign: 'center' },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, height: 45, borderRadius: 10 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: '#334155' },

    filterWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 5 },
    filterPrefix: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginRight: 10, textTransform: 'uppercase' },
    filterScroll: { paddingRight: 20 },
    filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    filterBtnActive: { backgroundColor: '#153c2a', borderColor: '#153c2a' },
    filterBtnText: { fontSize: 12, fontWeight: '800' },

    studentCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
    avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E7F5EE', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    avatarText: { color: '#153c2a', fontWeight: '900', fontSize: 20, letterSpacing: 1 },
    name: { fontSize: 15, fontWeight: '800' },
    badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 10 },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#64748B' },
    emptyState: { alignItems: 'center', marginTop: 60 }
});