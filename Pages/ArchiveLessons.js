import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './src/context/ThemeContext';
import api from './src/services/api';
import { toastSuccess, toastError } from './src/components/ToastMsg';

export default function ArchiveLessons({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lessons'); // 'lessons' | 'assessments'
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [archivedLessons, setArchivedLessons] = useState([]);
  const [archivedAssessments, setArchivedAssessments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal Configuration State
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    actionType: 'restore', // 'restore' | 'delete'
    isBatch: false,
    targetId: null,
    targetTitle: '',
  });

  const closeActionModal = () =>
    setModalConfig((prev) => ({ ...prev, visible: false }));

  const loadUserAndData = useCallback(async () => {
    try {
      setLoading(true);
      const rawUser = await AsyncStorage.getItem('user');
      if (!rawUser) {
        setLoading(false);
        return;
      }
      const currentUser = JSON.parse(rawUser);
      setUser(currentUser);
      await fetchArchivedItems(currentUser);
    } catch (err) {
      toastError('Failed to load archived items.');
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserAndData();
      return () => setSelectedIds([]);
    }, [loadUserAndData])
  );

  const fetchArchivedItems = async (currentUser) => {
    try {
      const instructorParam =
        currentUser?.role?.toLowerCase() === 'instructor'
          ? `&instructorId=${currentUser._id}`
          : '';

      const [lessonsRes, assessmentsRes] = await Promise.all([
        api.get(`/lessons?includeArchived=true${instructorParam}&_t=${Date.now()}`),
        api.get(`/assessments?includeArchived=true${instructorParam}&_t=${Date.now()}`),
      ]);

      const allLessons = Array.isArray(lessonsRes.data?.data)
        ? lessonsRes.data.data
        : Array.isArray(lessonsRes.data)
        ? lessonsRes.data
        : [];
      const allAssessments = Array.isArray(assessmentsRes.data?.data)
        ? assessmentsRes.data.data
        : Array.isArray(assessmentsRes.data)
        ? assessmentsRes.data
        : [];

      setArchivedLessons(allLessons.filter((item) => item.isArchived === true));
      setArchivedAssessments(
        allAssessments.filter((item) => item.isArchived === true)
      );
    } catch (err) {
      toastError('Error fetching archive lists.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllCurrentTab = () => {
    const currentList =
      activeTab === 'lessons' ? archivedLessons : archivedAssessments;
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map((item) => item._id));
    }
  };

  const executeRestore = async () => {
    closeActionModal();
    const idsToRestore = modalConfig.isBatch
      ? selectedIds
      : [modalConfig.targetId];

    try {
      setLoading(true);
      if (activeTab === 'lessons') {
        await Promise.all(
          idsToRestore.map((id) =>
            api.put(`/lessons/${id}`, {
              isArchived: false,
              modifiedBy: user?._id,
            })
          )
        );
      } else {
        // Dedicated restore endpoint for assessments
        await Promise.all(
          idsToRestore.map((id) => api.put(`/assessments/${id}/restore`))
        );
      }

      toastSuccess(
        `Successfully restored ${idsToRestore.length} ${
          activeTab === 'lessons' ? 'lesson(s)' : 'assessment(s)'
        }.`
      );
      setSelectedIds([]);
      await fetchArchivedItems(user);
    } catch (err) {
      toastError('Failed to restore selected item(s).');
      setLoading(false);
    }
  };

  const executeDelete = async () => {
    closeActionModal();
    const idsToDelete = modalConfig.isBatch
      ? selectedIds
      : [modalConfig.targetId];

    try {
      setLoading(true);
      const endpoint = activeTab === 'lessons' ? '/lessons' : '/assessments';
      await Promise.all(
        idsToDelete.map((id) => api.delete(`${endpoint}/${id}`))
      );

      toastSuccess(
        `Permanently deleted ${idsToDelete.length} ${
          activeTab === 'lessons' ? 'lesson(s)' : 'assessment(s)'
        }.`
      );
      setSelectedIds([]);
      await fetchArchivedItems(user);
    } catch (err) {
      toastError('Failed to delete selected item(s).');
      setLoading(false);
    }
  };

  const currentData = (
    activeTab === 'lessons' ? archivedLessons : archivedAssessments
  ).filter((item) =>
    String(item.title || '')
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase())
  );

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.includes(item._id);
    return (
      <TouchableOpacity
        style={[
          localStyles.lessonCard,
          { backgroundColor: theme?.card || '#FFF' },
          isSelected && { borderColor: '#153c2a', borderWidth: 2 },
        ]}
        onPress={() => toggleSelect(item._id)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={22}
          color={isSelected ? '#153c2a' : '#94A3B8'}
          style={{ marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              localStyles.cardTitle,
              { color: theme?.text || '#1E293B' },
            ]}
          >
            {item.title || 'Untitled'}
          </Text>
          <Text style={localStyles.cardMeta}>
            {activeTab === 'lessons' ? 'Lesson' : 'Assessment'} • Archived
          </Text>
        </View>

        <View style={localStyles.actionRow}>
          <TouchableOpacity
            style={localStyles.actionBtn}
            onPress={() =>
              setModalConfig({
                visible: true,
                actionType: 'restore',
                isBatch: false,
                targetId: item._id,
                targetTitle: item.title,
              })
            }
          >
            <Ionicons name="refresh-circle" size={28} color="#0ec21d" />
          </TouchableOpacity>
          <TouchableOpacity
            style={localStyles.actionBtn}
            onPress={() =>
              setModalConfig({
                visible: true,
                actionType: 'delete',
                isBatch: false,
                targetId: item._id,
                targetTitle: item.title,
              })
            }
          >
            <Ionicons name="trash" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme?.bg || '#F8FAFC' }}>
      {/* Header */}
      <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
        <View style={localStyles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={localStyles.centered}>
            <Text style={localStyles.title}>Archive Library</Text>
            <Text style={localStyles.subtitle}>
              Restore or permanently delete archived items
            </Text>
          </View>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={localStyles.tabContainer}>
        <TouchableOpacity
          style={[
            localStyles.tabButton,
            activeTab === 'lessons' && localStyles.activeTab,
          ]}
          onPress={() => {
            setActiveTab('lessons');
            setSelectedIds([]);
          }}
        >
          <Text
            style={[
              localStyles.tabText,
              activeTab === 'lessons' && localStyles.activeTabText,
            ]}
          >
            Lessons ({archivedLessons.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            localStyles.tabButton,
            activeTab === 'assessments' && localStyles.activeTab,
          ]}
          onPress={() => {
            setActiveTab('assessments');
            setSelectedIds([]);
          }}
        >
          <Text
            style={[
              localStyles.tabText,
              activeTab === 'assessments' && localStyles.activeTabText,
            ]}
          >
            Assessments ({archivedAssessments.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Select All */}
      <View style={localStyles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color="#64748B"
          style={localStyles.searchIcon}
        />
        <TextInput
          style={localStyles.searchInput}
          placeholder={`Search archived ${activeTab}...`}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {currentData.length > 0 && (
          <TouchableOpacity onPress={selectAllCurrentTab}>
            <Text
              style={{ color: '#153c2a', fontWeight: '700', fontSize: 13 }}
            >
              {selectedIds.length === currentData.length
                ? 'Deselect All'
                : 'Select All'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List Content */}
      {loading ? (
        <View style={localStyles.centered}>
          <ActivityIndicator size="large" color="#153c2a" />
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          ListEmptyComponent={
            <View style={localStyles.centered}>
              <Ionicons
                name="archive-outline"
                size={54}
                color="#94A3B8"
              />
              <Text style={{ color: '#64748B', marginTop: 10 }}>
                No archived {activeTab} found.
              </Text>
            </View>
          }
        />
      )}

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <View style={localStyles.batchActionBar}>
          <Text style={localStyles.batchText}>
            {selectedIds.length} selected
          </Text>
          <View style={localStyles.batchButtons}>
            <TouchableOpacity
              style={localStyles.batchRestoreBtn}
              onPress={() =>
                setModalConfig({
                  visible: true,
                  actionType: 'restore',
                  isBatch: true,
                  targetId: null,
                  targetTitle: `${selectedIds.length} item(s)`,
                })
              }
            >
              <Ionicons name="refresh" size={18} color="#FFF" />
              <Text style={localStyles.batchBtnText}>Restore</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={localStyles.batchDeleteBtn}
              onPress={() =>
                setModalConfig({
                  visible: true,
                  actionType: 'delete',
                  isBatch: true,
                  targetId: null,
                  targetTitle: `${selectedIds.length} item(s)`,
                })
              }
            >
              <Ionicons name="trash" size={18} color="#FFF" />
              <Text style={localStyles.batchBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirmation Modal (Single & Batch) */}
      <Modal
        visible={modalConfig.visible}
        transparent
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContainer}>
            <Text style={localStyles.modalTitle}>
              {modalConfig.actionType === 'restore'
                ? 'Confirm Restore'
                : 'Confirm Deletion'}
            </Text>
            <Text style={localStyles.modalMessage}>
              {modalConfig.actionType === 'restore'
                ? `Are you sure you want to restore "${modalConfig.targetTitle}" back to your active list?`
                : `Are you sure you want to permanently delete "${modalConfig.targetTitle}"? This cannot be undone.`}
            </Text>
            <View style={localStyles.modalButtonGroup}>
              <TouchableOpacity
                style={[localStyles.modalBtn, localStyles.cancelBtn]}
                onPress={closeActionModal}
              >
                <Text style={localStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  localStyles.modalBtn,
                  modalConfig.actionType === 'restore'
                    ? localStyles.confirmRestoreBtn
                    : localStyles.confirmDeleteBtn,
                ]}
                onPress={
                  modalConfig.actionType === 'restore'
                    ? executeRestore
                    : executeDelete
                }
              >
                <Text style={localStyles.confirmBtnText}>
                  {modalConfig.actionType === 'restore' ? 'Restore' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 25,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 25, fontWeight: '900', color: '#fff', marginTop: 10 },
  subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 6, marginLeft: 4 },
  batchActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 10,
  },
  batchText: { fontSize: 16, fontWeight: 'bold', color: '#153c2a' },
  batchButtons: { flexDirection: 'row', gap: 10 },
  batchRestoreBtn: {
    flexDirection: 'row',
    backgroundColor: '#0ec21d',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  batchDeleteBtn: {
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  batchBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    width: '90%',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#153c2a',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  confirmRestoreBtn: { backgroundColor: '#153c2a' },
  confirmDeleteBtn: { backgroundColor: '#EF4444' },
  confirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 5,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B' },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 15,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tabText: { fontWeight: '600', color: '#64748B', fontSize: 13 },
  activeTabText: { color: '#153c2a', fontWeight: '700' },
});