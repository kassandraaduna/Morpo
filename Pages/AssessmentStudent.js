import React, { useEffect, useState, useContext } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  RefreshControl, StyleSheet, Platform, StatusBar, Modal, Dimensions 
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');

export default function AssessmentStudent({ navigation }) {
  const { theme } = useContext(ThemeContext);
  
  const [currentUser, setCurrentUser] = useState(null); 
  const [mainTab, setMainTab] = useState('instructor'); 
  const [subTab, setSubTab] = useState('all'); 
  const [showTypeModal, setShowTypeModal] = useState(false);
  
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        const userObj = JSON.parse(userRaw);
        setCurrentUser(userObj);
        
        const res = await api.get(`/assessments?studentId=${userObj._id}`);
        setAssessments(res.data?.data || []);
      }
    } catch (err) {
      toastError('Failed to load assessments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredData = assessments.filter(item => {
    const isPractice = item.createdBy === currentUser?._id; 

    if (mainTab === 'instructor') {
      if (isPractice) return false; 
    } else {
      if (!isPractice) return false; 
    }

    if (mainTab === 'instructor') {
      if (subTab === 'completed') return item.isCompleted;
      if (subTab === 'new') return !item.isCompleted && !item.isClosed;
    }
    return true;
  });


  const renderAssessmentCard = ({ item }) => {
    const lastScore = item.latestAttempt?.percent || 0;
    const isClosed = item.isClosed;
    const canRetake = item.canRetake;
    const timerText = item.timer?.enabled ? `${item.timer.minutes} min timer` : 'No timer';

    return (
      <View style={[localStyles.card, { backgroundColor: theme.card }]}>
        <View style={localStyles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[localStyles.cardTitle, { color: theme.text }]}>{item.title.toUpperCase()}</Text>
            <Text style={localStyles.metaText}>
              {item.questions?.length || 0} questions - {timerText}
            </Text>
            <Text style={localStyles.metaText}>
                Deadline: {item.deadlineAt ? new Date(item.deadlineAt).toLocaleString() : 'No deadline'}
            </Text>
          </View>
          
          <View style={{ alignItems: 'flex-end' }}>
            {isClosed ? (
              <View style={[localStyles.statusBadge, { backgroundColor: '#f3f4f6' }]}>
                <Text style={[localStyles.badgeText, { color: '#6b7280' }]}>CLOSED</Text>
              </View>
            ) : item.isCompleted ? (
              <View style={[localStyles.statusBadge, { backgroundColor: '#e6f4ea' }]}>
                <Text style={[localStyles.badgeText, { color: '#2d6a4f' }]}>COMPLETED {canRetake ? '/ RETAKE' : ''}</Text>
              </View>
            ) : (
                <View style={[localStyles.statusBadge, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[localStyles.badgeText, { color: '#d97706' }]}>NEW</Text>
                </View>
            )}
          </View>
        </View>

        <View style={localStyles.scoreContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={localStyles.scoreLabel}>Last Score</Text>
            <Text style={[localStyles.scoreValue, { color: theme.text }]}>{item.isCompleted ? `${lastScore}%` : 'Pending'}</Text>
          </View>
          <View style={localStyles.progressBg}>
            <View style={[localStyles.progressFill, { width: `${lastScore}%`, backgroundColor: lastScore > 70 ? '#10b981' : '#f59e0b' }]} />
          </View>
          <Text style={localStyles.scoreSub}>
              {item.isCompleted ? `${item.latestAttempt?.score || 0} / ${item.latestAttempt?.total || 0} correct answers` : 'Answer all questions then submit.'}
          </Text>
        </View>

        {isClosed ? (
          <Text style={localStyles.closedText}>This assessment is closed.</Text>
        ) : (
          <TouchableOpacity 
            style={[localStyles.actionBtn, { 
                backgroundColor: item.isCompleted ? '#153c2a' : '#ffffff', 
                borderColor: '#153c2a', 
                borderWidth: 1 
            }]}
            onPress={() => navigation.navigate('TakeAssessment', { assessmentId: item._id })}
          >
            <Text style={[localStyles.actionBtnText, { color: item.isCompleted ? '#ffffff' : '#153c2a' }]}>
              {item.isCompleted ? 'Retake' : 'Start Assessment'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="dark-content" />
      
      <View style={localStyles.header}>
        <View style={localStyles.headerTopRow}>
            <View style={{ flex: 1 }}>
                <Text style={[localStyles.headerTitle, { color: theme.text }]}>Assessment</Text>
                <Text style={localStyles.headerSub}>
                    {mainTab === 'instructor' 
                        ? 'Take quizzes created by instructors to test your skills.' 
                        : 'Build your own flash cards and practice tests for self-review.'}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={localStyles.topBtn} onPress={() => navigation.navigate('History')}>
                    <Text style={localStyles.topBtnText}>Progress</Text>
                </TouchableOpacity>
                {mainTab === 'practice' && (
                    <TouchableOpacity style={[localStyles.topBtn, { backgroundColor: '#153c2a', borderColor: '#153c2a' }]} onPress={() => setShowTypeModal(true)}>
                        <Text style={[localStyles.topBtnText, { color: '#fff' }]}>+ Add Practice</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>

        <View style={localStyles.mainTabs}>
            <TouchableOpacity 
              onPress={() => setMainTab('instructor')} 
              style={[localStyles.mainTab, mainTab === 'instructor' && localStyles.mainTabActive]}
            >
                <Text style={[localStyles.mainTabText, mainTab === 'instructor' && { color: '#fff' }]}>Instructor Assessments</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setMainTab('practice')} 
              style={[localStyles.mainTab, mainTab === 'practice' && localStyles.mainTabActive]}
            >
                <Text style={[localStyles.mainTabText, mainTab === 'practice' && { color: '#fff' }]}>Practice Studio</Text>
            </TouchableOpacity>
        </View>

        {mainTab === 'instructor' && (
            <View style={localStyles.subTabRow}>
                {['all', 'completed', 'new'].map((tab) => (
                    <TouchableOpacity key={tab} onPress={() => setSubTab(tab)} style={localStyles.subTabItem}>
                        <Text style={[localStyles.subTabText, subTab === tab && localStyles.subTabTextActive]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)} Assessments
                        </Text>
                        {subTab === tab && <View style={localStyles.activeIndicator} />}
                    </TouchableOpacity>
                ))}
            </View>
        )}
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item._id}
        renderItem={renderAssessmentCard}
        contentContainerStyle={localStyles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchData();}} tintColor="#153c2a" />}
        ListEmptyComponent={
            <View style={localStyles.emptyState}>
                <Text style={{ color: theme.subText, textAlign: 'center', fontWeight: 'bold' }}>
                    {mainTab === 'practice' ? 'No practice quizzes yet.' : 'No assessments assigned.'}
                </Text>
                {mainTab === 'practice' && <Text style={{ color: theme.subText, fontSize: 12 }}>Create your own flash cards or test sets for review.</Text>}
            </View>
        }
      />

      <Modal visible={showTypeModal} transparent animationType="fade">
        <View style={localStyles.modalOverlay}>
            <View style={[localStyles.modalCard, { backgroundColor: theme.card }]}>
                <View style={localStyles.modalHeader}>
                    <Text style={[localStyles.modalTitle, { color: theme.text }]}>Choose Practice Type</Text>
                    <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>
                <Text style={localStyles.modalSub}>Create a private study tool just for your own review.</Text>
                
                <View style={localStyles.modalGrid}>
                  <TouchableOpacity 
                    style={[localStyles.typeOption, { borderColor: '#eee' }]}
                    onPress={() => {
                      setShowTypeModal(false);
                      navigation.navigate('CreatePractice', { type: 'flashcard' }); // Navigate!
                    }}
                  >
                    <Ionicons name="layers" size={32} color="#153c2a" />
                    <Text style={localStyles.typeTitle}>Flash Card</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[localStyles.typeOption, { borderColor: '#eee' }]}
                    onPress={() => {
                      setShowTypeModal(false);
                      navigation.navigate('CreatePractice', { type: 'test' }); // Navigate!
                    }}
                  >
                    <Ionicons name="checkbox" size={32} color="#153c2a" />
                    <Text style={localStyles.typeTitle}>Test</Text>
                  </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 26, fontWeight: '900' },
  headerSub: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 16 },
  topBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  topBtnText: { fontSize: 12, fontWeight: 'bold' },
  mainTabs: { flexDirection: 'row', marginTop: 20, gap: 10 },
  mainTab: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f3f4f6' },
  mainTabActive: { backgroundColor: '#153c2a' },
  mainTabText: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  subTabRow: { flexDirection: 'row', marginTop: 20, gap: 20 },
  subTabItem: { paddingBottom: 10 },
  subTabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  subTabTextActive: { color: '#000', fontWeight: '800' },
  activeIndicator: { height: 3, backgroundColor: '#153c2a', marginTop: 5, borderRadius: 2 },
  listContent: { padding: 20, paddingBottom: 100 },
  card: { borderRadius: 20, padding: 20, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  metaText: { fontSize: 12, color: '#666', marginBottom: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  scoreContainer: { marginTop: 15, backgroundColor: '#f9fafb', padding: 12, borderRadius: 12 },
  scoreLabel: { fontSize: 11, fontWeight: 'bold', color: '#666' },
  scoreValue: { fontSize: 15, fontWeight: '900' },
  progressBg: { height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  scoreSub: { fontSize: 10, color: '#666', marginTop: 8, fontWeight: '600' },
  actionBtn: { marginTop: 20, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontWeight: 'bold', fontSize: 14 },
  closedText: { marginTop: 20, textAlign: 'center', color: '#d61e1e', fontSize: 12, fontStyle: 'italic' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: width * 0.9, padding: 25, borderRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 5, marginBottom: 25 },
  modalGrid: { flexDirection: 'row', gap: 15 },
  typeOption: { flex: 1, padding: 20, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  typeTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  typeSub: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 6, lineHeight: 15 }
});