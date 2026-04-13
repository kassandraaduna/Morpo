import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, RefreshControl, StyleSheet, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api, { FILE_BASE } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';

export default function InstructorHomepage({ navigation }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ students: 0, lessons: 0, avgScore: 0 });
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useContext(ThemeContext);

  const loadDashboardData = async () => {
    try {
      const rawUser = await AsyncStorage.getItem('user');
      if (!rawUser) return;
      const currentUser = JSON.parse(rawUser);
      setUser(currentUser);

      const [overviewRes, monitoringRes, lessonRes] = await Promise.all([
        api.get('/admin/dashboard-overview'),
        api.get('/instructor/assessment-monitoring'),
        api.get('/lessons')
      ]);

      const allAssessments = monitoringRes.data.data.flatMap(s => s.assessments);
      const totalPercent = allAssessments.reduce((acc, curr) => acc + (curr.lastPercent || 0), 0);
      const avg = allAssessments.length > 0 ? (totalPercent / allAssessments.length).toFixed(0) : 0;

      setStats({ 
        students: overviewRes.data.counts.students, 
        lessons: lessonRes.data.data.length, 
        avgScore: avg 
      });

      const activity = monitoringRes.data.data.flatMap(s => 
        s.assessments.map(a => ({
          studentName: s.studentName,
          quizTitle: a.title,
          percent: a.lastPercent,
          date: a.lastSubmittedAt
        }))
      ).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

      setRecentSubmissions(activity);
    } catch (err) {
      console.error("Instructor Dashboard Load Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const unsubscribe = navigation.addListener('focus', loadDashboardData);
    return unsubscribe;
  }, [navigation]);

  if (!user || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color="#153c2a" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadDashboardData();}} />}
    >
      <StatusBar barStyle="dark-content" />

      <View style={localStyles.header}>
        <Text style={[localStyles.appTitle, { color: theme.text }]}>MyphoLens</Text>
        <TouchableOpacity 
          style={[localStyles.profilePill, { backgroundColor: theme.card }]}
          onPress={() => navigation.navigate('Profile')}
        >
          {user.avatar ? (
            <Image source={{ uri: `${FILE_BASE}${user.avatar}` }} style={localStyles.miniAvatar} />
          ) : (
            <Ionicons name="person-circle-outline" size={24} color={theme.text} style={{ marginRight: 5 }} />
          )}
          <Text style={{ color: theme.text, fontWeight: 'bold' }}>{user.fname}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Text style={[localStyles.greeting, { color: theme.text }]}>Hello, Instructor {user.fname}</Text>
        
        {/* SEARCH BAR */}
        <View style={[localStyles.searchBar, { backgroundColor: theme.card }]}>
          <Ionicons name="search-outline" size={18} color={theme.subText} />
          <TextInput placeholder="Search students or records..." placeholderTextColor="#999" style={{ flex: 1, marginLeft: 10, color: theme.text }} />
        </View>

        {/* 2. STATS GRID (Card Style) */}
        <View style={localStyles.statsRow}>
            <View style={[localStyles.statItem, { backgroundColor: theme.card }]}>
                <Text style={localStyles.statVal}>{stats.students}</Text>
                <Text style={localStyles.statLab}>STUDENTS</Text>
            </View>
            <View style={[localStyles.statItem, { backgroundColor: theme.card }]}>
                <Text style={localStyles.statVal}>{stats.lessons}</Text>
                <Text style={localStyles.statLab}>LESSONS</Text>
            </View>
            <View style={[localStyles.statItem, { backgroundColor: theme.card }]}>
                <Text style={[localStyles.statVal, { color: '#153c2a' }]}>{stats.avgScore}%</Text>
                <Text style={localStyles.statLab}>AVG SCORE</Text>
            </View>
        </View>

        <Text style={[localStyles.sectionTitle, { color: theme.text }]}>QUICK ACTIONS</Text>
        <View style={localStyles.grid}>
          {[
            { label: 'UPLOAD LESSON', icon: 'cloud-upload-outline', screen: 'UploadLesson' },
            { label: 'ADD ASSESSMENT', icon: 'add-circle-outline', screen: 'Assessments' },
            { label: 'MODEL LIBRARY', icon: 'cube-outline', screen: 'Learn' },
            { label: 'MONITORING', icon: 'people-outline', screen: 'StudentMonitoring' },
            { label: 'DATASET LIB', icon: 'library-outline', screen: 'Scan' },
            { label: 'SETTINGS', icon: 'settings-outline', screen: 'Profile' },
          ].map((item, i) => (
            <TouchableOpacity 
                key={i} 
                style={[localStyles.quickCard, { backgroundColor: theme.card }]}
                onPress={() => navigation.navigate(item.screen)}
            >
              <Ionicons name={item.icon} size={28} color="#153c2a" />
              <Text style={[localStyles.gridLabel, { color: theme.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 15 }}>
          <Text style={[localStyles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>RECENT PERFORMANCE</Text>
          <TouchableOpacity onPress={() => navigation.navigate('StudentMonitoring')}>
            <Text style={{ color: '#153c2a', fontWeight: 'bold', fontSize: 12 }}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        {recentSubmissions.map((item, i) => (
          <View key={i} style={[localStyles.activityCard, { backgroundColor: theme.card }]}>
            <View style={localStyles.avatarCircle}>
                <Text style={localStyles.avatarText}>{item.studentName[0]}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[localStyles.studentName, { color: theme.text }]}>{item.studentName}</Text>
                <Text style={localStyles.quizSub}>{item.quizTitle?.toUpperCase()}</Text>
            </View>
            <Text style={localStyles.scoreText}>{item.percent}%</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  appTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  profilePill: { flexDirection: 'row', alignItems: 'center', padding: 5, paddingRight: 15, borderRadius: 20, elevation: 2 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  greeting: { fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 45, borderRadius: 12, marginBottom: 25 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  statItem: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center', elevation: 2 },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLab: { fontSize: 8, fontWeight: '800', color: '#999', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickCard: { width: '31%', aspectRatio: 1, borderRadius: 15, padding: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 3 },
  gridLabel: { fontSize: 7.5, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },
  activityCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, marginBottom: 10, elevation: 2 },
  avatarCircle: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#e6f4ea', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#153c2a', fontWeight: 'bold', fontSize: 12 },
  studentName: { fontSize: 14, fontWeight: '800' },
  quizSub: { fontSize: 9, color: '#999', marginTop: 2 },
  scoreText: { color: '#153c2a', fontWeight: '900', fontSize: 16 }
});