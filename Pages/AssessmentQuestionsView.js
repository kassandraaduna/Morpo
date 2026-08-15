import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Platform, StatusBar,  FlatList, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError } from './src/components/ToastMsg';
import { WebView } from 'react-native-webview';

const getInitials = (name) => {
  if (!name) return 'S';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

export default function AssessmentQuestionsView({ route, navigation }) {
  const { assessment } = route.params;
  const { theme } = useContext(ThemeContext);
  const [activeSubTab, setActiveSubTab] = useState('questions'); 
  const [studentStatusList, setStudentStatusList] = useState([]);
  const [rawMappedList, setRawMappedList] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState('default');

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  useEffect(() => {
    let result = [...rawMappedList];

    if (filterMode === 'pending') {
      result = result.filter(s => !s.hasTaken);
    } else if (filterMode === 'complete') {
      result = result.filter(s => s.hasTaken);
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    setStudentStatusList(result);
  }, [filterMode, rawMappedList]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/instructor/assessment-monitoring'); 
      const allData = res.data?.data || [];

      let filteredList = allData;
      if (assessment.targetSections?.length > 0) {
        filteredList = allData.filter(student => {
          const studentSection = String(student.section || '').toUpperCase();
          return assessment.targetSections.some(target => 
            String(target).toUpperCase() === studentSection || studentSection.includes(String(target).toUpperCase())
          );
        });
      }

      const mapped = filteredList.map(item => {
        const quizRecord = item.assessments?.find(a => String(a.assessmentId) === String(assessment._id));
        return {
          _id: item.studentId, 
          name: item.studentName,
          yearLevel: item.yearLevel,
          section: item.section,
          avatar: item.avatar,
          hasTaken: !!quizRecord,
          percent: quizRecord ? quizRecord.lastPercent : null,
          rawScore: quizRecord ? quizRecord.lastScore : 0,
          totalItems: quizRecord ? quizRecord.lastTotal : (assessment.questions?.length || 0),
          attempts: quizRecord ? quizRecord.takeCount : 0, 
        };
      });

      setRawMappedList(mapped);
    } catch (e) {
      toastError("Failed to sync student status.");
    } finally {
      setLoading(false);
    }
  };

  const renderStudentItem = ({ item }) => {
    const isPassing = item.percent >= (assessment.passingScore || 70);

    return (
      <View style={[localStyles.studentCard, { backgroundColor: theme.card }]}>
        <View style={localStyles.rowLeft}>
          {item.avatar ? (
            <Image source={{ uri: toAbsUrl(item.avatar) }} style={localStyles.avatar} />
          ) : (
            <View style={localStyles.initialsCircle}>
              <Text style={localStyles.initialsText}>{getInitials(item.name)}</Text>
            </View>
          )}
          
          <View style={{ flex: 1 }}>
            <Text style={[localStyles.studentName, { color: theme.text }]}>
              {item.name.toUpperCase()}
            </Text>
            <Text style={localStyles.studentMeta}>{item.yearLevel} • {item.section}</Text>
          </View>
        </View>
        
        <View style={localStyles.rowRight}>
          {item.hasTaken ? (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={localStyles.statusBadgeSuccess}>
                <Text style={localStyles.statusTextSuccess}>COMPLETED</Text>
              </View>

              <Text style={[localStyles.scoreText, { color: isPassing ? '#10B981' : '#EF4444' }]}>
                {item.rawScore} / {item.totalItems}
              </Text>
              <Text style={localStyles.attemptMeta}>
                {item.percent}% Grade • {item.attempts} {item.attempts === 1 ? 'attempt' : 'attempts'}
              </Text>

            </View>
          ) : (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={localStyles.statusBadgePending}>
                <Text style={localStyles.statusTextPending}>PENDING</Text>
              </View>
              <Text style={localStyles.attemptMeta}>No records found</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
<View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      <View style={localStyles.header}>
        <View style={localStyles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={[localStyles.headerTextContainer, {alignItems: 'center', justifyContent: 'center'}]}>
            <Text style={localStyles.headerTitle}>Assessment Details</Text>
            <Text style={localStyles.headerSubtitle}>
              Track assessment results and view assessment questions
            </Text>
          </View>
        </View>
      </View>

      <View style={localStyles.tabBar}>
        <TouchableOpacity onPress={() => setActiveSubTab('questions')} style={[localStyles.tab, activeSubTab === 'questions' && localStyles.activeTab]}>
          <Text style={[localStyles.tabLabel, { color: activeSubTab === 'questions' ? '#153c2a' : '#64748B' }]}>ASSESSMENT QUESTIONS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveSubTab('takes')} style={[localStyles.tab, activeSubTab === 'takes' && localStyles.activeTab]}>
          <Text style={[localStyles.tabLabel, { color: activeSubTab === 'takes' ? '#153c2a' : '#64748B' }]}>ASSESSMENT RESULT</Text>
        </TouchableOpacity>
      </View>

      <View style={localStyles.titleSection}>
        <Text style={localStyles.assessmentTitle}>{assessment.title}</Text>
      </View>

      {activeSubTab === 'takes' && (
        <View style={localStyles.filterContainer}>
          <Text style={localStyles.filterPrefix}>Sort by:</Text>
          {['default', 'pending', 'complete'].map((mode) => (
            <TouchableOpacity 
              key={mode} 
              onPress={() => setFilterMode(mode)} 
              style={[localStyles.filterBtn, filterMode === mode && localStyles.filterBtnActive]}
            >
              <Text style={[localStyles.filterBtnText, { color: filterMode === mode ? '#fff' : '#64748B' }]}>
                {mode === 'default' ? 'ALL' : mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeSubTab === 'questions' ? (
        assessment?.deliveryMode === 'external' && assessment?.externalUrl ? (
          <View style={{ flex: 1, minHeight: 500, marginHorizontal: 22, marginBottom: 30, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' }}>
            <WebView 
              source={{ uri: assessment.externalUrl }} 
              style={{ flex: 1 }} 
              startInLoadingState={true}
              renderLoading={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#153c2a" />
                </View>
              )}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 30 }}>
            {(assessment?.questions || []).map((q, idx) => (
              <View key={idx} style={[localStyles.qCard, { backgroundColor: theme.card }]}>
                <Text style={[localStyles.qText, { color: theme.text }]}>{idx + 1}. {q.text}</Text>
                {(q.options || []).map((opt, i) => (
                  <View key={i} style={localStyles.optRow}>
                    <Ionicons 
                      name={q.correctIndex === i ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={q.correctIndex === i ? "#10B981" : "#ccc"} 
                    />
                    <Text style={[localStyles.optText, q.correctIndex === i && { color: '#10B981', fontWeight: 'bold' }]}>{opt}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        <View style={{ flex: 1 }}>
          {loading ? <ActivityIndicator size="large" color="#153c2a" style={{ marginTop: 40 }} /> : (
            <FlatList 
              data={studentStatusList} 
              keyExtractor={(item) => String(item._id)} 
              renderItem={renderStudentItem} 
              contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 30 }} 
              ListEmptyComponent={<Text style={localStyles.emptyText}>No students found for this filter.</Text>}
            />
          )}
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
header: { 
    backgroundColor: '#153c2a', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 20, 
    borderBottomLeftRadius: 10, 
    borderBottomRightRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10, 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 10
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  headerTitle: { 
    fontSize: 25, 
    fontWeight: '900', 
    color: '#fff',
  },
  headerSubtitle: { 
    fontSize: 13, 
    color: '#d1fae5', 
    marginTop: 2 
  },
  tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', marginHorizontal: 22, marginTop: 20, marginBottom: 10, borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabLabel: { fontSize: 13, fontWeight: '800' },
  titleSection: { paddingHorizontal: 22, paddingBottom: 15, paddingTop: 5 },
  titleLabel: { fontSize: 13, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 2 },
  assessmentTitle: { fontSize: 20, fontWeight: '900', color: '#153c2a' },

  filterContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginBottom: 15 },
  filterPrefix: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginRight: 10, textTransform: 'uppercase' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#153c2a' },
  filterBtnText: { fontSize: 13, fontWeight: '700' },

  studentCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, marginBottom: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  initialsCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E7F5EE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  initialsText: { color: '#153c2a', fontSize: 20, fontWeight: '900' },
  studentName: { fontSize: 13.5, fontWeight: '900' },
  studentMeta: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  rowRight: { justifyContent: 'center' },
  scoreText: { fontSize: 20, fontWeight: '900' },
  attemptMeta: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  statusBadgeSuccess: { backgroundColor: '#E1F8F0', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  statusTextSuccess: { fontSize: 12, fontWeight: '900', color: '#10B981' },
  statusBadgePending: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  statusTextPending: { fontSize: 12, fontWeight: '900', color: '#64748B' },
  qCard: { padding: 18, borderRadius: 10, marginBottom: 15, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  qText: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  optText: { marginLeft: 10, fontSize: 14, color: '#475569' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94A3B8', fontWeight: '800' }
});