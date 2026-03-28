import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, RefreshControl, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api, { FILE_BASE } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';

export default function StudentHomepage({ navigation }) {
  const [user, setUser] = useState(null);
  const [scans, setScans] = useState([]);
  const [latestQuiz, setLatestQuiz] = useState(null);
  const [suggestedLessons, setSuggestedLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useContext(ThemeContext);

  const loadDashboardData = async () => {
    try {
      const rawUser = await AsyncStorage.getItem('user');
      if (!rawUser) return;
      const currentUser = JSON.parse(rawUser);
      setUser(currentUser);

      const [scanRes, historyRes, lessonRes] = await Promise.all([
        api.get(`/scan/history/${currentUser._id}`),
        api.get(`/student/${currentUser._id}/assessment-history`),
        api.get('/lessons')
      ]);

      setScans(scanRes.data?.data?.slice(0, 5) || []);

      setSuggestedLessons(lessonRes.data?.data?.slice(0, 5) || []);

      const historyData = historyRes.data?.data || {};
      const allAttempts = [];
      
      Object.values(historyData).forEach(group => {
        group.attempts.forEach(attempt => {
          allAttempts.push({ ...attempt, title: group.title });
        });
      });

      if (allAttempts.length > 0) {
        const sorted = allAttempts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        setLatestQuiz(sorted[0]);
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
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
        <Text style={[localStyles.greeting, { color: theme.text }]}>Hello, {user.fname} {user.lname}</Text>
        
        <View style={[localStyles.searchBar, { backgroundColor: theme.card }]}>
          <Ionicons name="search-outline" size={18} color={theme.subText} />
          <TextInput placeholder="Search" placeholderTextColor="#999" style={{ flex: 1, marginLeft: 10, color: theme.text }} />
        </View>

        <View style={localStyles.grid}>
          {[
            { label: 'AI CLASSIFIER', icon: 'scan-outline', screen: 'Scan' },
            { label: '3D MODELS', icon: 'cube-outline', screen: 'Learn' },
            { label: 'LEARN MYCOLOGY', icon: 'book-outline', screen: 'Learn' },
            { label: 'ASSESSMENTS', icon: 'clipboard-outline', screen: 'Assessments' },
            { label: 'BOOKMARKS', icon: 'bookmark-outline', screen: 'Profile' },
            { label: 'SCAN HISTORY', icon: 'time-outline', screen: 'Scan' },
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

        <Text style={[localStyles.sectionTitle, { color: theme.text }]}>RECENT SCANS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {scans.length > 0 ? scans.map((scan, i) => (
            <TouchableOpacity key={i} style={[localStyles.scanCard, { backgroundColor: theme.card }]}>
              <View style={localStyles.scanRow}>
                <Image source={{ uri: `${FILE_BASE}${scan.imageUrl}` }} style={localStyles.scanThumb} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                      <Text style={{ fontWeight: '800', color: theme.text }}>
                        {scan?.classification?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                        <Ionicons name="bookmark-outline" size={16} color={theme.subText} />
                    </View>
                    <Text style={localStyles.scanMeta}>{new Date(scan.createdAt).toLocaleDateString()}</Text>
                    <Text style={[localStyles.scanMeta, { color: '#153c2a', fontWeight: 'bold' }]}>{scan.confidence}% confidence</Text>
                </View>
              </View>
              <Text style={localStyles.scanDesc} numberOfLines={2}>{scan.description}</Text>
              <View style={localStyles.scanActions}>
                  <TouchableOpacity style={localStyles.outlineBtn}><Text style={localStyles.outlineText}>LEARN MORE</Text></TouchableOpacity>
                  <TouchableOpacity style={localStyles.outlineBtn} onPress={() => navigation.navigate('Learn')}><Text style={localStyles.outlineText}>VIEW MODEL</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          )) : <Text style={{color: theme.subText, fontSize: 12, fontStyle:'italic'}}>No recent scans.</Text>}
        </ScrollView>

        <Text style={[localStyles.sectionTitle, { color: theme.text, marginTop: 30 }]}>LATEST ASSESSMENT SCORE</Text>
        {latestQuiz ? (
            <View style={[localStyles.assessmentCard, { backgroundColor: theme.card }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[localStyles.assessmentTitle, { color: theme.text }]}>
                      {latestQuiz?.title?.toUpperCase() || 'ASSESSMENT'}
                    </Text>
                    <Text style={localStyles.assessmentMeta}>Submitted on {new Date(latestQuiz.submittedAt).toLocaleDateString()}</Text>
                    <Text style={[localStyles.assessmentFeedback, { color: theme.text }]} numberOfLines={2}>{latestQuiz.feedback}</Text>
                </View>
                <View style={localStyles.scoreBoxNoBg}>
                    <Text style={localStyles.scoreTextOnly}>{latestQuiz.percent}%</Text>
                    <TouchableOpacity style={localStyles.viewBtnLink} onPress={() => navigation.navigate('Assessments')}>
                        <Text style={localStyles.viewBtnLinkText}>VIEW</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ) : (
            <View style={[localStyles.assessmentCard, { backgroundColor: theme.card, justifyContent:'center' }]}>
                <Text style={{ color: theme.subText, textAlign:'center' }}>No assessments completed yet.</Text>
            </View>
        )}

        <Text style={[localStyles.sectionTitle, { color: theme.text, marginTop: 30 }]}>SUGGESTED TOPICS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {suggestedLessons.map((lesson, i) => (
            <TouchableOpacity 
                key={i} 
                style={localStyles.topicCard}
                onPress={() => navigation.navigate('LessonStudent', { lessonId: lesson._id })}
            >
              <View style={[localStyles.topicImage, { backgroundColor: '#153c2a10' }]}>
                  <Ionicons name="document-text" size={35} color="#153c2a" />
              </View>
              <Text style={[localStyles.topicText, { color: theme.text }]} numberOfLines={1}>
                {lesson?.title?.toUpperCase() || 'LESSON'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickCard: { width: '31%', aspectRatio: 1, borderRadius: 15, padding: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 3 },
  gridLabel: { fontSize: 8, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },
  scanCard: { width: 280, padding: 15, borderRadius: 20, marginRight: 15, elevation: 3 },
  scanRow: { flexDirection: 'row', alignItems: 'center' },
  scanThumb: { width: 65, height: 65, borderRadius: 12, backgroundColor: '#eee' },
  scanMeta: { fontSize: 10, color: '#999', marginTop: 1 },
  scanDesc: { fontSize: 11, marginTop: 10, lineHeight: 16, height: 32 },
  scanActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  outlineBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#153c2a', alignItems: 'center' },
  outlineText: { fontSize: 9, fontWeight: 'bold', color: '#153c2a' },
  assessmentCard: { flexDirection: 'row', padding: 20, borderRadius: 20, elevation: 3, alignItems: 'center' },
  assessmentTitle: { fontSize: 14, fontWeight: '900' },
  assessmentMeta: { fontSize: 10, color: '#999', marginVertical: 4 },
  assessmentFeedback: { fontSize: 11, lineHeight: 16, color: '#666' },
  scoreBoxNoBg: { marginLeft: 15, alignItems: 'center', minWidth: 60 },
  scoreTextOnly: { color: '#153c2a', fontSize: 32, fontWeight: '900' },
  viewBtnLink: { marginTop: 2 },
  viewBtnLinkText: { color: '#153c2a', fontSize: 10, fontWeight: 'bold', textDecorationLine: 'underline' },
  topicCard: { width: 130, marginRight: 15 },
  topicImage: { width: '100%', height: 90, borderRadius: 15, marginBottom: 8, justifyContent: 'center', alignItems: 'center' },
  topicText: { fontSize: 10, fontWeight: '800', textAlign: 'center' }
});