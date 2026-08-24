import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../Pages/src/context/ThemeContext';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Notifications({ route, navigation }) {
  const { theme } = useContext(ThemeContext);
  
  // Accept notifications and role from route params
  const { notifications: initialNotifs = [], role = 'student' } = route.params || {};
  const [notifications, setNotifications] = useState([]);

  // Use distinct storage keys based on account type
  const READ_KEY = role === 'instructor' ? 'read_notifs_instructor' : 'read_notifs';
  const CLEAR_KEY = role === 'instructor' ? 'cleared_notifs_instructor' : 'cleared_notifs';

  useEffect(() => {
    // Ensure properly sorted from Newest to Oldest
    const sorted = [...initialNotifs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setNotifications(sorted);
  }, [initialNotifs]);

  const handleMarkAsRead = async (id) => {
    try {
      const raw = await AsyncStorage.getItem(READ_KEY);
      const readList = raw ? JSON.parse(raw) : [];
      if (!readList.includes(id)) {
        readList.push(id);
        await AsyncStorage.setItem(READ_KEY, JSON.stringify(readList));
      }
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (e) { console.error('Failed to mark read', e); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const raw = await AsyncStorage.getItem(READ_KEY);
      const readList = raw ? JSON.parse(raw) : [];
      notifications.forEach(n => {
        if (!readList.includes(n._id)) readList.push(n._id);
      });
      await AsyncStorage.setItem(READ_KEY, JSON.stringify(readList));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) { console.error('Failed to mark all read', e); }
  };

  const handleClearIndividual = async (id) => {
    try {
      const raw = await AsyncStorage.getItem(CLEAR_KEY);
      let clearList = raw ? JSON.parse(raw) : [];
      if (!clearList.includes(id)) {
        clearList.push(id);
        // Protect storage limits by keeping only the last 500 dismissed IDs
        if (clearList.length > 500) clearList = clearList.slice(-500);
        await AsyncStorage.setItem(CLEAR_KEY, JSON.stringify(clearList));
      }
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (e) { console.error('Failed to clear individual', e); }
  };

  const handleClearAll = async () => {
    Alert.alert("Clear Notifications", "Are you sure you want to delete all notifications forever?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: async () => {
          try {
            const raw = await AsyncStorage.getItem(CLEAR_KEY);
            let clearList = raw ? JSON.parse(raw) : [];
            notifications.forEach(n => {
              if (!clearList.includes(n._id)) clearList.push(n._id);
            });
            if (clearList.length > 500) clearList = clearList.slice(-500);
            await AsyncStorage.setItem(CLEAR_KEY, JSON.stringify(clearList));
            setNotifications([]);
          } catch (e) { console.error('Failed to clear all', e); }
      }}
    ]);
  };

  const renderNotifItem = ({ item }) => {
    const handlePress = async () => {
        await handleMarkAsRead(item._id);

        // Unified routing for both student and instructor types
        if (item.type === 'dataset') navigation.navigate('DatasetLibrary');
        else if (item.type === 'scan') navigation.navigate('ScanHistory');
        else if (item.type === 'new_assessment' || item.type === 'assessment') {
            navigation.navigate('TakeAssessment', { assessmentId: item.assessmentId });
        }
        else if (item.type === 'assessment_score') {
            navigation.navigate('StudentResultViewer', { assessmentId: item.assessmentId, submissionId: item.submissionId });
        }
        else if (item.type === 'new_lesson' || item.type === 'lesson') {
            navigation.navigate('LessonStudent', { lessonId: item.lessonId });
        }
        else if (item.type === 'assignment' || item.type === 'student') {
            navigation.navigate('StudentMonitoring');
        }
        else if (item.type === 'assessment_submission') {
            if (item.assessment && item.assessment._id) {
                navigation.navigate('AssessmentQuestionsView', { assessment: item.assessment, quiz: item.assessment, quizId: item.assessment._id });
            } else {
                navigation.navigate('StudentMonitoring');
            }
        }
        else if (item.type === 'calendar') navigation.goBack(); 
    };

    return (
      <TouchableOpacity style={styles.notifItem} onPress={handlePress} activeOpacity={0.7}>
        <View style={[styles.notifIconBox, !item.isRead && { backgroundColor: '#C5DEC9' }]}>
          <Ionicons 
            name={item.type === 'dataset' ? 'images' : item.type === 'scan' ? 'scan' : item.type === 'calendar' ? 'calendar' : item.type.includes('assessment') ? 'clipboard' : item.type === 'student' ? 'people' : 'notifications'} 
            size={20} 
            color="#153c2a" 
          />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifText, !item.isRead && { fontWeight: '900' }]}>{item.message}</Text>
          <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
        </View>
        
        {/* Individual Clear Button */}
        <TouchableOpacity onPress={() => handleClearIndividual(item._id)} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={24} color="#CBD5E1" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme?.bg || '#F4F7F6' }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        
        <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerActionBtn}>
                <Ionicons name="checkmark-done" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearAll} style={styles.headerActionBtn}>
                <Ionicons name="trash-outline" size={22} color="#F87171" />
            </TouchableOpacity>
        </View>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>You have no new notifications.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => item._id?.toString() || index.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={renderNotifItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#153c2a',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  backBtn: { padding: 4, justifyContent: 'center' },
  headerTitle: { fontSize: 25, fontWeight: '900', color: '#fff' },
  headerActionBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  listContainer: { padding: 20, paddingBottom: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#64748B', marginTop: 16, fontWeight: '600' },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notifIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E7F5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notifContent: { flex: 1 },
  notifText: { fontSize: 14, fontWeight: '600', color: '#1E293B', lineHeight: 20 },
  notifTime: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 6 }
});