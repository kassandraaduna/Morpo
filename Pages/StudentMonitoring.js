import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, RefreshControl, Image, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';

const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
};

export default function StudentMonitoring({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMonitoring = async () => {
        try {
            const res = await api.get('/instructor/assessment-monitoring');
            setStudents(res.data.data || []);
        } catch (err) {
            console.error("Monitoring Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchMonitoring(); }, []);

    const filteredStudents = students.filter(s => {
        const nameMatch = (s.studentName || '').toLowerCase().includes(search.toLowerCase());
        const sectionMatch = (s.section || '').toLowerCase().includes(search.toLowerCase());
        return nameMatch || sectionMatch;
    });

    const renderStudent = ({ item }) => (
        <TouchableOpacity 
            style={[localStyles.studentCard, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('StudentProgressDetail', { student: item })}
        >
            <View style={localStyles.avatarCircle}>
                {item.avatar ? (
                    <Image source={{ uri: toAbsUrl(item.avatar) }} style={localStyles.avatarImage} />
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

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />

            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={localStyles.title}>Student Monitoring</Text>
                        <Text style={localStyles.subtitle}>Track progress and assessment scores</Text>
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
                                {search ? "No matching students found." : "No students enrolled."}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 20  },
    subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, height: 45, borderRadius: 15 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: '#334155' },
    studentCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
    avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E7F5EE', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    avatarText: { color: '#153c2a', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
    name: { fontSize: 15, fontWeight: '800' },
    badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 10 },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#64748B' },
    emptyState: { alignItems: 'center', marginTop: 60 }
});