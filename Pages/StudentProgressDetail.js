import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';
import { toAbsUrl } from './src/services/api';

const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
};

export default function StudentProgressDetail({ route, navigation }) {
    const { student } = route.params;
    const { theme } = useContext(ThemeContext);

    const renderQuizItem = ({ item }) => {
        const isPassing = item.lastPercent >= 50;

        return (
            <View style={[localStyles.quizCard, { backgroundColor: theme.card }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[localStyles.quizTitle, { color: theme.text }]}>{item.title.toUpperCase()}</Text>
                    <Text style={localStyles.quizMeta}>Submitted: {new Date(item.lastSubmittedAt).toLocaleDateString()}</Text>
                    <Text style={localStyles.quizMeta}>Attempts: {item.takeCount}</Text>
                </View>
                <View style={localStyles.scoreColumn}>
                    <Text style={[localStyles.scoreValue, { color: isPassing ? '#10B981' : '#EF4444' }]}>
                        {item.lastScore || 0} / {item.lastTotal || 0}
                    </Text>
                    <Text style={localStyles.scoreLabel}>{item.lastPercent || 0}% Grade</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />

            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerTopRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={localStyles.headerTopTitle}>Student Performance Overview</Text>
                </View>

                <View style={localStyles.profileSection}>
                    <View style={localStyles.largeAvatar}>
                        {student.avatar ? (
                            <Image source={{ uri: toAbsUrl(student.avatar) }} style={localStyles.largeAvatarImage} />
                        ) : (
                            <Text style={localStyles.largeAvatarText}>{getInitials(student.studentName)}</Text>
                        )}
                    </View>
                    <Text style={localStyles.headerName}>{(student.studentName || 'Unknown').toUpperCase()}</Text>
                    <Text style={localStyles.headerSub}>{student.yearLevel || 'N/A'} • {student.section || 'N/A'}</Text>
                </View>
            </View>

            <View style={{ flex: 1 }}>
                <FlatList
                    data={student.assessments}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={renderQuizItem}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    ListHeaderComponent={
                        <Text style={[localStyles.sectionTitle, { color: theme.text }]}>ASSESSMENT HISTORY</Text>
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40 }}>
                            <Ionicons name="document-text-outline" size={50} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
                            <Text style={{ color: theme.subText, fontSize: 14, fontWeight: '600' }}>
                                No assessment data found for this student.
                            </Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
    headerTopTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
    profileSection: { alignItems: 'center' },
    largeAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E7F5EE', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 3, borderColor: '#fff', overflow: 'hidden' },
    largeAvatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    largeAvatarText: { color: '#153c2a', fontSize: 32, fontWeight: '900', letterSpacing: 2 },
    headerName: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
    headerSub: { color: '#d1fae5', fontSize: 13, marginTop: 4, fontWeight: '600' },
    sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 15, color: '#153c2a' },
    quizCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 10, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    quizTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
    quizMeta: { fontSize: 13, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
    scoreColumn: { alignItems: 'flex-end', marginLeft: 15 },
    scoreValue: { fontSize: 22, fontWeight: '900' },
    scoreLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '800', marginTop: 2 }
});