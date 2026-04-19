import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from './src/services/api';
import moment from 'moment';

export default function AssessmentQuestionsView({ route, navigation }) {
  const { assessment } = route.params;
  const [activeSubTab, setActiveSubTab] = useState('questions'); 
  const [studentStatusList, setStudentStatusList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeSubTab === 'takes') fetchMonitoringData();
  }, [activeSubTab]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      // 1. Fetch all students and the specific submission records for this quiz
      const [allStudentsRes, submissionsRes] = await Promise.all([
        api.get('/admin/users?role=student'), // Get all students
        api.get(`/instructor/assessment-monitoring?assessmentId=${assessment._id}`) // Get who took it
      ]);

      const allStudents = allStudentsRes.data?.data || [];
      const takers = submissionsRes.data?.data || [];

      // 2. Filter students based on Assessment Targets (Section/Year)
      // If targetSections is empty, it means it's assigned to everyone.
      let eligibleStudents = allStudents;
      if (assessment.targetSections?.length > 0) {
        eligibleStudents = allStudents.filter(s => 
          assessment.targetSections.includes(s.section)
        );
      }

      // 3. Map status (Taken vs Not Taken)
      const combinedList = eligibleStudents.map(student => {
        const record = takers.find(t => t.studentId === student._id);
        return {
          ...student,
          hasTaken: !!record,
          score: record ? record.lastPercent : null,
          attempts: record ? record.attemptCount : 0,
          completedAt: record ? record.updatedAt : null
        };
      });

      // Sort: Put those who haven't taken it at the top or bottom as preferred
      setStudentStatusList(combinedList.sort((a, b) => b.hasTaken - a.hasTaken));
    } catch (e) {
      console.error("Monitoring Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const renderStudentItem = ({ item }) => (
    <View style={localStyles.studentRow}>
      <View style={{ flex: 1 }}>
        <Text style={localStyles.studentName}>{item.fname} {item.lname}</Text>
        <Text style={localStyles.studentMeta}>{item.yearLevel} - {item.section}</Text>
      </View>
      
      <View style={{ alignItems: 'flex-end' }}>
        {item.hasTaken ? (
          <>
            <View style={localStyles.statusBadgeSuccess}>
              <Text style={localStyles.statusText}>COMPLETED</Text>
            </View>
            <Text style={[localStyles.scoreText, { color: item.score >= (assessment.passingScore || 70) ? '#10B981' : '#EF4444' }]}>
              {item.score}% ({item.attempts} attempts)
            </Text>
          </>
        ) : (
          <>
            <View style={localStyles.statusBadgePending}>
              <Text style={[localStyles.statusText, { color: '#64748B' }]}>PENDING</Text>
            </View>
            <Text style={localStyles.studentMeta}>No records</Text>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={localStyles.headerText}>Monitoring: {assessment.targetSections?.length > 0 ? assessment.targetSections.join(', ') : 'All Sections'}</Text>
      </View>

      <View style={localStyles.tabBar}>
        <TouchableOpacity onPress={() => setActiveSubTab('questions')} style={[localStyles.tab, activeSubTab === 'questions' && localStyles.activeTab]}>
          <Text style={[localStyles.tabLabel, activeSubTab === 'questions' && { color: '#153c2a' }]}>QUESTIONS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveSubTab('takes')} style={[localStyles.tab, activeSubTab === 'takes' && localStyles.activeTab]}>
          <Text style={[localStyles.tabLabel, activeSubTab === 'takes' && { color: '#153c2a' }]}>STUDENT STATUS</Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === 'questions' ? (
        <ScrollView contentContainerStyle={{ padding: 22 }}>
          <Text style={localStyles.title}>{assessment.title}</Text>
          {assessment.questions.map((q, idx) => (
            <View key={idx} style={localStyles.qCard}>
              <Text style={localStyles.qText}>{idx + 1}. {q.text}</Text>
              {q.options.map((opt, i) => (
                <View key={i} style={localStyles.optRow}>
                  <Ionicons name={q.correctIndex === i ? "checkmark-circle" : "ellipse-outline"} size={16} color={q.correctIndex === i ? "#10B981" : "#ccc"} />
                  <Text style={[localStyles.optText, q.correctIndex === i && { color: '#10B981', fontWeight: 'bold' }]}>{opt}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {loading ? <ActivityIndicator size="large" color="#153c2a" style={{ marginTop: 40 }} /> : (
            <FlatList
              data={studentStatusList}
              keyExtractor={(item) => item._id}
              renderItem={renderStudentItem}
              contentContainerStyle={{ padding: 22 }}
              ListEmptyComponent={<Text style={localStyles.emptyText}>No eligible students found for this section.</Text>}
            />
          )}
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
    header: { backgroundColor: '#153c2a', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center' },
    headerText: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 15, flex: 1 },
    tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', marginHorizontal: 22, marginTop: 20, marginBottom: 20, borderRadius: 12, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeTab: { backgroundColor: '#fff', elevation: 2 },
    tabLabel: { fontSize: 10, fontWeight: '900', color: '#64748B' },
    title: { fontSize: 20, fontWeight: '900', color: '#153c2a', marginBottom: 20 },
    qCard: { padding: 15, backgroundColor: '#F8FAFC', borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    qText: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
    optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    optText: { marginLeft: 10, fontSize: 13, color: '#475569' },
    studentRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    studentName: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    studentMeta: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
    statusBadgeSuccess: { backgroundColor: '#E1F8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginBottom: 4 },
    statusBadgePending: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginBottom: 4 },
    statusText: { fontSize: 9, fontWeight: '900', color: '#10B981' },
    scoreText: { fontSize: 14, fontWeight: '900' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#94A3B8', fontWeight: '700' }
});