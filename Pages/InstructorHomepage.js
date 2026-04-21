import React, { useEffect, useState, useContext, useCallback } from 'react';
import {  View, Text, ScrollView, TouchableOpacity, Image,  ActivityIndicator, RefreshControl, StatusBar, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';
import api, { toAbsUrl } from './src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './src/styles/Styles'; 

const getInitials = (name) => {
  if (!name) return 'I';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

export default function InstructorHomepage({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ instructors: 0, students: 0, avgScore: 0 });
  const [performanceRows, setPerformanceRows] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const userRaw = await AsyncStorage.getItem('user');
      const currentUser = userRaw ? JSON.parse(userRaw) : null;
      setUser(currentUser);

      const [ovRes, perfRes] = await Promise.all([
        api.get('/admin/dashboard-overview'),
        api.get('/instructor/assessment-monitoring')
      ]);

      const studentsData = perfRes.data?.data || [];

      let grandTotal = 0;
      let totalAttempts = 0;
      studentsData.forEach(student => {
        student.assessments?.forEach(asm => {
          grandTotal += (asm.lastPercent || 0);
          totalAttempts++;
        });
      });

      setStats({
        instructors: ovRes.data.counts.instructors || 0,
        students: ovRes.data.counts.students || 0,
        avgScore: totalAttempts > 0 ? (grandTotal / totalAttempts).toFixed(1) : 0
      });

      setPerformanceRows(studentsData);
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getToneColor = (progress) => {
    if (progress < 50) return '#EF4444'; 
    if (progress < 75) return '#F59E0B'; 
    return '#10B981'; 
  };

  if (loading) return (
    <View style={localStyles.centered}>
      <ActivityIndicator size="large" color="#153c2a" />
    </View>
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
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#153c2a" />}
      >
        <View style={localStyles.statsWrapper}>
          <StatBox label="Instructors" value={stats.instructors} icon="people" />
          <StatBox label="Students" value={stats.students} icon="school" />
          <StatBox label="Avg Score" value={`${stats.avgScore}%`} icon="bar-chart" />
        </View>

        <View style={localStyles.contentBody}>
          <Text style={localStyles.sectionLabel}>Quick Actions</Text>
          <View style={localStyles.actionGrid}>
            <ActionItem icon="cloud-upload" label="Upload Lesson" onPress={() => navigation.navigate('UploadLesson')} />
            <ActionItem icon="clipboard" label="Assessments" onPress={() => navigation.navigate('Learn', { initialTab: 'Assessments' })} />
            <ActionItem icon="cube" label="3D Models" onPress={() => navigation.navigate('Learn', { initialTab: 'Models' })} />
            <ActionItem icon="analytics" label="Student Monitoring" onPress={() => navigation.navigate('StudentMonitoring')} />
            <ActionItem icon="images" label="Dataset Library" onPress={() => navigation.navigate('Profile', { screen: 'DatasetLibrary' })} />
            <ActionItem icon="bookmark" label="Bookmarks" onPress={() => navigation.navigate('Bookmarks')} />
          </View>

          <View style={localStyles.listHeader}>
            <Text style={localStyles.sectionLabel}>Student Performance</Text>
            <TouchableOpacity onPress={() => navigation.navigate('StudentMonitoring')}>
              <Text style={localStyles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {performanceRows.map((row) => {
            const studentProgress = row.assessments?.length > 0 
              ? Math.round(row.assessments.reduce((acc, curr) => acc + (curr.lastPercent || 0), 0) / row.assessments.length)
              : 0;
            const color = getToneColor(studentProgress);

            return (
              <TouchableOpacity 
                key={row.studentId} 
                onPress={() => navigation.navigate('StudentProgressDetail', { student: row })}
                style={[localStyles.studentCard, { backgroundColor: theme.card }]}
              >
                <View style={localStyles.rowLeft}>
                  {row.avatar ? (
                    <Image source={{ uri: toAbsUrl(row.avatar) }} style={localStyles.rowAvatar} />
                  ) : (
                    <View style={localStyles.rowInitialsCircle}>
                      <Text style={localStyles.rowInitialsText}>{getInitials(row.studentName)}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={[localStyles.studentName, { color: theme.text }]}>{row.studentName.toUpperCase()}</Text>
                    <Text style={localStyles.studentMeta}>{row.yearLevel} • {row.section}</Text>
                  </View>
                </View>
                
                <View style={localStyles.rowRight}>
                  <Text style={[localStyles.percentText, { color }]}>{studentProgress}%</Text>
                  <View style={localStyles.progressTrack}>
                    <View style={[localStyles.progressFill, { width: `${studentProgress}%`, backgroundColor: color }]} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const ActionItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={localStyles.actionBtn} onPress={onPress} activeOpacity={0.7}>
    <View style={localStyles.iconCircle}>
      <Ionicons name={icon} size={24} color="#153c2a" />
    </View>
    <Text style={localStyles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const StatBox = ({ label, value, icon }) => (
  <View style={localStyles.statBox}>
    <View style={localStyles.statIconCircle}>
      <Ionicons name={icon} size={18} color="#153c2a" />
    </View>
    <Text style={localStyles.statValue}>{value}</Text>
    <Text style={localStyles.statLabel}>{label.toUpperCase()}</Text>
  </View>
);

const localStyles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coloredHeader: { backgroundColor: '#153c2a', paddingTop: 60, paddingBottom: 30, paddingHorizontal: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetText: { fontSize: 20, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  userName: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 2 },
  headerAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  initialsCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: '#153c2a', fontSize: 18, fontWeight: '800' },
  
  statsWrapper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 25 },
  statBox: { width: '31%', backgroundColor: '#fff', borderRadius: 20, padding: 15, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  statIconCircle: { backgroundColor: '#F0F9F4', padding: 8, borderRadius: 12, marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#153c2a' },
  statLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginTop: 2 },

  contentBody: { paddingHorizontal: 22, marginTop: 25 },
  sectionLabel: { fontSize: 14, fontWeight: '900', color: '#153c2a', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 18 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 25 },
  actionBtn: { width: '31%', alignItems: 'center', marginBottom: 18 },
  iconCircle: { width: 70, height: 70, backgroundColor: '#F0F9F4', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10, elevation: 2 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  viewAllText: { color: '#153c2a', fontWeight: '900', fontSize: 12 },
  studentCard: { flexDirection: 'row', padding: 18, borderRadius: 24, marginBottom: 14, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 14 },
  rowInitialsCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E7F5EE', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  rowInitialsText: { fontSize: 16, fontWeight: '800', color: '#153c2a' },
  studentName: { fontSize: 14, fontWeight: '900' },
  studentMeta: { fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 3 },
  rowRight: { alignItems: 'flex-end' },
  percentText: { fontSize: 17, fontWeight: '900' },
  progressTrack: { width: 70, height: 5, backgroundColor: '#F1F5F9', borderRadius: 2.5, marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 2.5 }
});