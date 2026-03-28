import React, { useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeContext } from './src/context/ThemeContext';

export default function StudentProgressDetail({ route, navigation }) {
    const { student } = route.params;
    const { theme } = useContext(ThemeContext);

    const renderQuizItem = ({ item }) => (
        <View style={[localStyles.quizCard, { backgroundColor: theme.card }]}>
            <View style={{ flex: 1 }}>
                <Text style={[localStyles.quizTitle, { color: theme.text }]}>{item.title.toUpperCase()}</Text>
                <Text style={localStyles.quizMeta}>Submitted: {new Date(item.lastSubmittedAt).toLocaleDateString()}</Text>
                <Text style={localStyles.quizMeta}>Attempts: {item.takeCount}</Text>
            </View>
            <View style={localStyles.scoreColumn}>
                <Text style={localStyles.scoreValue}>{item.lastPercent}%</Text>
                <Text style={localStyles.scoreLabel}>{item.lastScore}/{item.lastTotal}</Text>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <View style={localStyles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={localStyles.profileSection}>
                    <View style={localStyles.largeAvatar}>
                        <Text style={localStyles.largeAvatarText}>{student.studentName[0]}</Text>
                    </View>
                    <Text style={localStyles.headerName}>{student.studentName.toUpperCase()}</Text>
                    <Text style={localStyles.headerSub}>{student.yearLevel} • {student.section}</Text>
                </View>
            </View>

            <View style={{ flex: 1, padding: 20 }}>
                <Text style={[localStyles.sectionTitle, { color: theme.text }]}>ASSESSMENT HISTORY</Text>
                
                <FlatList
                    data={student.assessments}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={renderQuizItem}
                    ListEmptyComponent={
                        <Text style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
                            No assessment data found for this student.
                        </Text>
                    }
                />
            </View>
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { backgroundColor: '#153c2a', paddingTop: 60, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    backBtn: { marginLeft: 20, marginBottom: 10 },
    profileSection: { alignItems: 'center' },
    largeAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: '#fff' },
    largeAvatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
    headerName: { color: '#fff', fontSize: 20, fontWeight: '900' },
    headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 5 },
    sectionTitle: { fontSize: 12, fontWeight: '900', marginBottom: 20, letterSpacing: 1 },
    quizCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 12, elevation: 2 },
    quizTitle: { fontSize: 13, fontWeight: '800', marginBottom: 5 },
    quizMeta: { fontSize: 10, color: '#999', marginTop: 2 },
    scoreColumn: { alignItems: 'flex-end', marginLeft: 15 },
    scoreValue: { fontSize: 20, fontWeight: '900', color: '#153c2a' },
    scoreLabel: { fontSize: 10, color: '#999', fontWeight: 'bold' }
});