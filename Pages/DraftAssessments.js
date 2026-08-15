import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './src/context/ThemeContext';
import api from './src/services/api';
import { toastSuccess, toastError } from './src/components/ToastMsg';

export default function DraftAssessments({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drafts, setDrafts] = useState([]);

  // Unified Custom Modal State (replaces native Alert.alert) 
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    targetDraft: null,
    action: null, // 'publish' | 'delete'
  });

  const closeActionModal = () => {
    setModalConfig({
      visible: false,
      title: '',
      message: '',
      targetDraft: null,
      action: null,
    });
  };

  const loadDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const rawUser = await AsyncStorage.getItem('user');
      if (!rawUser) {
        setLoading(false);
        return;
      }
      const currentUser = JSON.parse(rawUser);
      setUser(currentUser);
      await fetchDraftAssessments(currentUser);
    } catch (err) {
      toastError('Failed to load assessment drafts.');
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (user) await fetchDraftAssessments(user);
    setRefreshing(false);
  };

  const fetchDraftAssessments = async (currentUser) => {
    try {
      const instructorParam =
        currentUser?.role?.toLowerCase() === 'instructor'
          ? `?instructorId=${currentUser._id}&status=draft`
          : '?status=draft';

      const res = await api.get(`/assessments${instructorParam}`);
      const allAssessments = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      const onlyDrafts = allAssessments.filter(
        (item) =>
          String(item.status || '').toLowerCase() === 'draft' &&
          !item.isArchived
      );

      setDrafts(onlyDrafts);
    } catch (err) {
      toastError('Failed to fetch draft assessments.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Publish Confirmation Modal (With Pre-Publish Validation)
  const triggerPublishModal = (draft) => {
    const activeSections = draft.targetSections || [];
    if (activeSections.length === 0) {
      return toastError(
        'Please assign at least one target section via Edit before publishing.'
      );
    }
    if (!draft.availableAt) {
      return toastError(
        'Please set an access date via Edit before publishing.'
      );
    }
    if (!draft.deadlineAt) {
      return toastError(
        'Please set a due date via Edit before publishing.'
      );
    }

    setModalConfig({
      visible: true,
      title: 'Publish Assessment',
      message: `Are you sure you want to publish "${draft.title}" now? Students in assigned sections will be able to view and take it.`,
      targetDraft: draft,
      action: 'publish',
    });
  };

  // Trigger Delete Confirmation Modal
  const triggerDeleteModal = (draft) => {
    setModalConfig({
      visible: true,
      title: 'Delete Draft',
      message: `Are you sure you want to permanently delete "${draft.title}"? This action cannot be undone.`,
      targetDraft: draft,
      action: 'delete',
    });
  };

  // Execute Confirmed Action from Custom Modal
  const handleConfirmAction = async () => {
    const { targetDraft, action } = modalConfig;
    closeActionModal();

    if (!targetDraft || !action) return;

    try {
      setLoading(true);
      if (action === 'publish') {
        await api.put(`/assessments/${targetDraft._id}`, {
          ...targetDraft,
          status: 'published',
        });
        toastSuccess('Assessment published successfully!');
      } else if (action === 'delete') {
        await api.delete(`/assessments/${targetDraft._id}`);
        toastSuccess('Draft deleted.');
      }
      await fetchDraftAssessments(user);
    } catch (err) {
      toastError(`Failed to ${action} draft.`);
      setLoading(false);
    }
  };

  const formatDateLabel = (isoString) => {
    if (!isoString) return 'Not set';
    const dt = new Date(isoString);
    if (isNaN(dt.getTime())) return 'Not set';
    return dt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDraftItem = ({ item }) => {
    const isExternal = item.deliveryMode === 'external';
    const questionCount = Array.isArray(item.questions)
      ? item.questions.length
      : 0;
    const sectionsCount = Array.isArray(item.targetSections)
      ? item.targetSections.length
      : 0;

    return (
      <View
        style={[
          localStyles.card,
          { backgroundColor: theme?.card || '#FFF' },
        ]}
      >
        <View style={localStyles.cardHeader}>
          <View style={localStyles.badgeRow}>
            <View style={localStyles.draftBadge}>
              <Text style={localStyles.draftBadgeText}>DRAFT</Text>
            </View>
            <View
              style={[
                localStyles.modeBadge,
                isExternal ? localStyles.extBadge : localStyles.intBadge,
              ]}
            >
              <Text style={localStyles.modeBadgeText}>
                {isExternal ? 'EXTERNAL LINK' : 'INTERNAL QUIZ'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => triggerDeleteModal(item)}
            style={localStyles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <Text
          style={[localStyles.cardTitle, { color: theme?.text || '#0F172A' }]}
        >
          {item.title || 'Untitled Assessment'}
        </Text>

        <View style={localStyles.metaContainer}>
          {!isExternal && (
            <Text style={localStyles.metaText}>
              {questionCount} Question(s)
            </Text>
          )}
          <Text style={localStyles.metaText}>
            Sections: {sectionsCount > 0 ? item.targetSections.join(', ') : 'None assigned'}
          </Text>
          <Text style={localStyles.metaText}>
            Due: {formatDateLabel(item.deadlineAt)}
          </Text>
        </View>

        {/* Card Actions */}
        <View style={localStyles.cardFooter}>
          {/* ROUTES TO THE NEW EDIT SCREEN */}
          <TouchableOpacity
            style={localStyles.settingsBtn}
            onPress={() => navigation.navigate('EditAssessment', { assessment: item })}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={16} color="#153c2a" />
            <Text style={localStyles.settingsBtnText}>Edit Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.publishBtn}
            onPress={() => triggerPublishModal(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#FFF" />
            <Text style={localStyles.publishBtnText}>Publish Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme?.bg || '#F8FAFC' }}>
      <StatusBar barStyle="light-content" backgroundColor="#153c2a" />

      {/* Standard Header */}
      <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
        <View style={localStyles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={localStyles.title}>Assessment Drafts</Text>
            <Text style={localStyles.subtitle}>
              Configure rules, schedule, and publish saved drafts
            </Text>
          </View>
        </View>
      </View>

      {/* List Body */}
      {loading && !refreshing ? (
        <View style={localStyles.centered}>
          <ActivityIndicator size="large" color="#153c2a" />
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderDraftItem}
          contentContainerStyle={localStyles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#153c2a"
            />
          }
          ListEmptyComponent={
            <View style={localStyles.centeredEmpty}>
              <Ionicons
                name="document-text-outline"
                size={56}
                color="#94A3B8"
              />
              <Text style={localStyles.emptyTitle}>No Drafts Found</Text>
              <Text style={localStyles.emptySub}>
                Assessments saved as draft will appear here.
              </Text>
            </View>
          }
        />
      )}

      {/* Custom Confirmation Modal (Publish & Delete) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalConfig.visible}
        onRequestClose={closeActionModal}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContainer}>
            <Text style={localStyles.modalTitle}>{modalConfig.title}</Text>
            <Text style={localStyles.modalMessage}>{modalConfig.message}</Text>
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
                  modalConfig.action === 'publish'
                    ? localStyles.confirmPublishBtn
                    : localStyles.confirmDeleteBtn,
                ]}
                onPress={handleConfirmAction}
              >
                <Text style={localStyles.confirmBtnText}>
                  {modalConfig.action === 'publish' ? 'Publish' : 'Delete'}
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
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  listContent: { padding: 16, paddingBottom: 80 },
  centeredEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
    marginTop: 12,
  },
  emptySub: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  draftBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  draftBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  intBadge: { backgroundColor: '#E0F2FE' },
  extBadge: { backgroundColor: '#F3E8FF' },
  modeBadgeText: { fontSize: 10, fontWeight: '800', color: '#0369A1' },
  deleteBtn: { padding: 4 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  metaContainer: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4,
    marginBottom: 14,
  },
  metaText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F5EE',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#153c2a',
  },
  publishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#153c2a',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  publishBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
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
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#153c2a',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 15 },
  confirmPublishBtn: { backgroundColor: '#153c2a' },
  confirmDeleteBtn: { backgroundColor: '#EF4444' },
  confirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});