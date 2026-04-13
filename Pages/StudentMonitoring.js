import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';

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

    const filteredStudents = students.filter(s => 
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        s.section.toLowerCase().includes(search.toLowerCase())
    );

    const renderStudent = ({ item }) => (
        <TouchableOpacity 
            style={[localStyles.studentCard, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('StudentProgressDetail', { student: item })}
        >
            <View style={localStyles.avatarCircle}>
                <Text style={localStyles.avatarText}>{item.studentName[0]}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={[localStyles.name, { color: theme.text }]}>{item.studentName.toUpperCase()}</Text>
                <Text style={{ color: theme.subText, fontSize: 11 }}>{item.yearLevel} • {item.section}</Text>
            </View>
            <View style={localStyles.badge}>
                <Text style={localStyles.badgeText}>{item.assessments.length} QUIZZES</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <View style={localStyles.header}>
                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[localStyles.title, { color: theme.text }]}>Student Monitoring</Text>
                </View>
                
                <View style={[localStyles.searchBox, { backgroundColor: theme.card }]}>
                    <Ionicons name="search" size={18} color={theme.subText} />
                    <TextInput 
                        placeholder="Search student or section..." 
                        placeholderTextColor="#999"
                        style={{ flex: 1, marginLeft: 10, color: theme.text }}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#153c2a" />
            ) : (
                <FlatList
                    data={filteredStudents}
                    keyExtractor={(item) => item.studentId}
                    renderItem={renderStudent}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchMonitoring();}} />}
                    ListEmptyComponent={<Text style={localStyles.empty}>No students enrolled.</Text>}
                />
            )}
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '900', marginLeft: 15 },
    searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 45, borderRadius: 12, marginTop: 20, elevation: 2 },
    studentCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, marginBottom: 12, elevation: 3 },
    avatarCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#153c2a', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    name: { fontSize: 13, fontWeight: '800' },
    badge: { backgroundColor: '#e6f4ea', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 10 },
    badgeText: { fontSize: 9, fontWeight: 'bold', color: '#153c2a' },
    empty: { textAlign: 'center', marginTop: 50, color: '#999', fontWeight: 'bold' }
});