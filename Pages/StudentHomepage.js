import React, { useState, useEffect, useContext } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, TextInput, 
    Image, ActivityIndicator, RefreshControl, StyleSheet, Platform, StatusBar 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api, { FILE_BASE, toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';

const getInitials = (name) => {
  if (!name) return 'S';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

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

      // 1. Get the 5 most recent scans (not just bookmarked ones)
      const allScans = scanRes.data?.data || [];
      const sortedScans = allScans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setScans(sortedScans.slice(0, 5));

      // 2. Sort lessons by most recently accessed/updated
      const recentLessons = (lessonRes.data?.data || []).sort((a, b) => {
          const dateA = new Date(a.lastAccessedAt || a.updatedAt);
          const dateB = new Date(b.lastAccessedAt || b.updatedAt);
          return dateB - dateA;
      });
      setSuggestedLessons(recentLessons.slice(0, 5));

      // 3. Get latest assessment
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

  // Function to toggle bookmark status from the dashboard directly
  const toggleScanBookmark = async (scanId, currentStatus) => {
    // Optimistically update the UI instantly
    setScans(scans.map(scan => 
      scan._id === scanId ? { ...scan, bookmarked: !currentStatus } : scan
    ));
    
    try {
      // Send the update to your backend 
      // (Adjust this route if your backend uses a specific bookmark endpoint)
      await api.put(`/scan/${scanId}`, { bookmarked: !currentStatus });
    } catch (error) {
      console.error("Failed to toggle bookmark", error);
      // Revert UI if the API call fails
      setScans(scans.map(scan => 
        scan._id === scanId ? { ...scan, bookmarked: currentStatus } : scan
      ));
    }
  };

  if (!user || loading) {
    return (
      <View style={localStyles.centered}>
        <ActivityIndicator size="large" color="#153c2a" />
      </View>
    );
  }

  const ActionItem = ({ icon, label, onPress }) => (
    <TouchableOpacity style={localStyles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={localStyles.iconCircle}>
        <Ionicons name={icon} size={28} color="#153c2a" />
      </View>
      <Text style={[localStyles.actionLabel, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={localStyles.coloredHeader}>
        <View style={localStyles.headerTop}>
          <View>
            <Text style={localStyles.greetText}>Welcome back,</Text>
            <Text style={localStyles.userName}>{user?.fname + ' ' + user?.lname || ''}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            {user?.avatar ? (
              <Image source={{ uri: toAbsUrl(user.avatar) }} style={localStyles.headerAvatar} />
            ) : (
              <View style={localStyles.initialsCircle}>
                <Text style={localStyles.initialsText}>{getInitials(user?.fname + ' ' + user?.lname)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadDashboardData();}} tintColor="#153c2a" />}
      >
        <View style={localStyles.contentBody}>

          <Text style={localStyles.sectionLabel}>Quick Links</Text>
          <View style={localStyles.actionGrid}>
            <ActionItem icon="book" label="Lessons" onPress={() => navigation.navigate('Learn', { initialTab: 'lessons' })} />
            <ActionItem icon="cube" label="3D Models" onPress={() => navigation.navigate('Learn', { initialTab: 'models' })} />
            <ActionItem icon="clipboard" label="Assessments" onPress={() => navigation.navigate('Assessments')} />
            <ActionItem icon="scan" label="AI Scanner" onPress={() => navigation.navigate('Scan')} />
            <ActionItem icon="bookmark" label="Bookmarks" onPress={() => navigation.navigate('Bookmarks')} />
            <ActionItem icon="time" label="Scan History" onPress={() => navigation.navigate('ScanHistory')} />
          </View>

          <Text style={[localStyles.sectionLabel, { marginTop: 15 }]}>Recent Scans</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={localStyles.horizontalScrollPadding}
            style={{ flexGrow: 0 }}
          >
            {scans.length > 0 ? scans.map((scan, i) => (
              <View key={i} style={[localStyles.scanCard, { backgroundColor: theme.card }]}>
                <View style={localStyles.scanRow}>
                  <Image source={{ uri: toAbsUrl(scan.imageUrl) }} style={localStyles.scanThumb} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems: 'center'}}>
                        <Text style={{ fontWeight: '900', color: theme.text, flex: 1, fontSize: 13 }} numberOfLines={1}>
                          {scan?.classification?.toUpperCase() || 'UNKNOWN'}
                        </Text>

                        <TouchableOpacity 
                          onPress={() => toggleScanBookmark(scan._id, scan.bookmarked)}
                          style={localStyles.bookmarkBtn}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons 
                            name={scan.bookmarked ? "bookmark" : "bookmark-outline"} 
                            size={20} 
                            color={scan.bookmarked ? "#10b981" : "#94A3B8"} 
                          />
                        </TouchableOpacity>
                      </View>
                      <Text style={localStyles.scanMeta}>{new Date(scan.createdAt).toLocaleDateString()}</Text>
                      <Text style={[localStyles.scanMeta, { color: '#10b981', fontWeight: 'bold' }]}>{scan.confidence}% confidence</Text>
                  </View>
                </View>
              </View>
            )) : (
                <View style={[localStyles.emptyCard, { backgroundColor: theme.card }]}>
                    <Ionicons name="scan-outline" size={30} color={theme.subText} style={{ marginBottom: 5 }} />
                    <Text style={{color: theme.subText, fontSize: 12, fontWeight: 'bold' }}>No recent scans yet.</Text>
                </View>
            )}
          </ScrollView>

          <Text style={[localStyles.sectionLabel, { marginTop: 25 }]}>Latest Assessment Score</Text>
          {latestQuiz ? (
              <View style={[localStyles.assessmentCard, { backgroundColor: theme.card }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[localStyles.assessmentTitle, { color: theme.text }]} numberOfLines={1}>
                        {latestQuiz?.title?.toUpperCase() || 'ASSESSMENT'}
                      </Text>
                      <Text style={localStyles.assessmentMeta}>Submitted: {new Date(latestQuiz.submittedAt).toLocaleDateString()}</Text>
                      <Text style={[localStyles.assessmentFeedback, { color: theme.subText }]} numberOfLines={2}>{latestQuiz.feedback}</Text>
                  </View>
                  <View style={localStyles.scoreBoxNoBg}>
                      <Text style={[localStyles.scoreTextOnly, { color: latestQuiz.percent >= 70 ? '#10B981' : '#EF4444' }]}>
                          {latestQuiz.percent}%
                      </Text>
                      <TouchableOpacity style={localStyles.viewBtnLink} onPress={() => navigation.navigate('Assessments')}>
                          <Text style={localStyles.viewBtnLinkText}>VIEW ALL</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          ) : (
              <View style={[localStyles.emptyCard, { backgroundColor: theme.card }]}>
                  <Text style={{ color: theme.subText, fontWeight: 'bold' }}>No assessments completed yet.</Text>
              </View>
          )}

          <Text style={[localStyles.sectionLabel, { marginTop: 35 }]}>Recently Opened Lessons</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={localStyles.horizontalScrollPadding}
            style={{ flexGrow: 0 }}
          >
            {suggestedLessons.length > 0 ? suggestedLessons.map((lesson, i) => (
              <TouchableOpacity 
                  key={i} 
                  style={localStyles.topicCard}
                  onPress={() => navigation.navigate('LessonStudent', { lessonId: lesson._id })}
              >
                <View style={[localStyles.topicImage, { backgroundColor: '#F0F9F4' }]}>
                    <Ionicons name="document-text" size={35} color="#153c2a" />
                </View>
                <Text style={[localStyles.topicText, { color: theme.text }]} numberOfLines={1}>
                  {lesson?.title?.toUpperCase() || 'LESSON'}
                </Text>
              </TouchableOpacity>
            )) : (
                <Text style={{color: theme.subText, fontSize: 12, fontStyle:'italic'}}>No recent lessons opened.</Text>
            )}
          </ScrollView>

        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  coloredHeader: { backgroundColor: '#153c2a', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 30, paddingHorizontal: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetText: { fontSize: 20, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  userName: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 },
  headerAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  initialsCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: '#153c2a', fontSize: 18, fontWeight: '800' },
  
  contentBody: { paddingHorizontal: 22, marginTop: 25 },
  
  sectionLabel: { fontSize: 14, fontWeight: '900', color: '#153c2a', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  actionBtn: { width: '31%', alignItems: 'center', marginBottom: 18 },
  iconCircle: { width: 75, height: 75, backgroundColor: '#F0F9F4', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  actionLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  
  horizontalScrollPadding: { paddingVertical: 10, paddingHorizontal: 2 },

  scanCard: { width: 280, padding: 18, borderRadius: 24, marginRight: 15, marginBottom: 5, elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  scanRow: { flexDirection: 'row', alignItems: 'center' },
  scanThumb: { width: 65, height: 65, borderRadius: 16, backgroundColor: '#f1f5f9' },
  scanMeta: { fontSize: 12, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  bookmarkBtn: { padding: 4, marginRight: -4 },
  
  assessmentCard: { flexDirection: 'row', padding: 22, borderRadius: 24, elevation: 4, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, marginBottom: 5 },
  assessmentTitle: { fontSize: 15, fontWeight: '900' },
  assessmentMeta: { fontSize: 12, color: '#94A3B8', marginVertical: 6, fontWeight: '600' },
  assessmentFeedback: { fontSize: 13, lineHeight: 18 },
  scoreBoxNoBg: { alignItems: 'flex-end', minWidth: 60 },
  scoreTextOnly: { fontSize: 36, fontWeight: '900' },
  viewBtnLink: { marginTop: 4 },
  viewBtnLinkText: { color: '#153c2a', fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' },
  
  topicCard: { width: 130, marginRight: 15, marginBottom: 5 },
  topicImage: { width: '100%', height: 110, borderRadius: 20, marginBottom: 10, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  topicText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },

  emptyCard: { width: '100%', padding: 25, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }
});