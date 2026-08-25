import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, Modal, StatusBar } from 'react-native';
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

  // ─── Custom Modal State ──────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({
      visible: false, title: '', message: '', iconName: 'help', iconColor: '#153c2a', iconBg: '#E7F5EE', 
      confirmText: 'Confirm', hideCancel: false, onConfirm: () => {}
  });

  useEffect(() => {
    // Ensure properly sorted from Newest to Oldest
    const sorted = [...initialNotifs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setNotifications(sorted);
  }, [initialNotifs]);

  const triggerCustomAlert = (title, message, onConfirm, iconName = 'help', iconColor = '#153c2a', iconBg = '#E7F5EE', confirmText = 'Confirm', hideCancel = false) => {
      setConfirmModal({ visible: true, title, message, onConfirm, iconName, iconColor, iconBg, confirmText, hideCancel });
  };

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
    triggerCustomAlert(
      "Clear Notifications",
      "Are you sure you want to delete all notifications forever?",
      async () => {
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
      },
      "trash-outline", 
      "#EF4444", 
      "#FEE2E2", 
      "Clear All"
    );
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

  const renderConfirmModal = () => {
      return (
          <Modal visible={confirmModal.visible} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                  <View style={[styles.modalCard, { backgroundColor: theme?.card || '#FFF' }]}>
                      <View style={[styles.modalIconCircle, { backgroundColor: confirmModal.iconBg }]}>
                          <Ionicons name={confirmModal.iconName} size={28} color={confirmModal.iconColor} />
                      </View>
                      <Text style={[styles.modalTitle, { color: theme?.text || '#1E293B', textAlign: 'center' }]}>{confirmModal.title}</Text>
                      <Text style={styles.modalMessage}>{confirmModal.message}</Text>
                      
                      <View style={styles.modalBtnRow}>
                          {!confirmModal.hideCancel && (
                              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}>
                                  <Text style={styles.modalCancelText}>Cancel</Text>
                              </TouchableOpacity>
                          )}
                          
                          <TouchableOpacity 
                              style={[
                                  styles.modalConfirmBtn, 
                                  (confirmModal.iconName === 'warning' || confirmModal.iconName === 'trash-outline') && { backgroundColor: '#EF4444' }
                              ]} 
                              onPress={() => { const action = confirmModal.onConfirm; setConfirmModal(prev => ({ ...prev, visible: false })); action(); }}
                          >
                              <Text style={styles.modalConfirmText}>{confirmModal.confirmText}</Text>
                          </TouchableOpacity>
                      </View>
                  </View>
              </View>
          </Modal>
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
      
      {renderConfirmModal()}
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
  notifTime: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 6 },
  
  // Custom Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 340, padding: 25, borderRadius: 10, alignItems: 'center', elevation: 10 },
  modalIconCircle: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 25, fontWeight: '600', lineHeight: 18 },
  modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontWeight: '800', color: '#64748B', fontSize: 13 },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#153c2a', alignItems: 'center' },
  modalConfirmText: { fontWeight: '800', color: '#FFF', fontSize: 13 }
});