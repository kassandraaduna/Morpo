import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  Switch,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../Pages/src/services/api';
import { ThemeContext } from '../Pages/src/context/ThemeContext';
import { toastError } from '../Pages/src/components/ToastMsg';

export default function AssessmentSettings({
  visible,
  onClose,
  settings,
  setSettings,
  isExternal = false,
}) {
  const { theme } = useContext(ThemeContext);
  const [options, setOptions] = useState({ yearLevels: [], sections: [] });
  const [studentsList, setStudentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // ─── Date/Time Picker State ─────────────────────────────────────────
  const [pickerState, setPickerState] = useState({
    show: false,
    mode: 'date', // 'date' | 'time'
    field: null,  // 'availableAt' | 'deadlineAt'
    tempDate: new Date(),
  });

  useEffect(() => {
    if (visible) {
      loadInstructorScopedOptions();
    }
  }, [visible]);

  // 1. Load instructor assigned scope and student lists from backend options
  const loadInstructorScopedOptions = async () => {
    try {
      setLoading(true);
      setLoadingStudents(true);
      const rawUser = await AsyncStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      const instructorParam =
        user?.role?.toLowerCase() === 'instructor'
          ? `?instructorId=${user._id}`
          : '';

      const res = await api.get(
        `/assessments-assignment-options${instructorParam}`
      );
      const data = res.data?.data || {};

      setOptions({
        yearLevels: data.yearLevels || [
          '1st Year',
          '2nd Year',
          '3rd Year',
          '4th Year',
        ],
        sections: data.sections || [],
      });

      // If the backend returns student rosters within assignment options or a students array, capture it safely
      if (Array.isArray(data.students)) {
        setStudentsList(data.students);
      } else {
        // Fallback: Try fetching general students list if available, or keep empty
        try {
          const userRes = await api.get(`/users?role=student`);
          const users = userRes.data?.data || userRes.data || [];
          setStudentsList(Array.isArray(users) ? users : []);
        } catch (e) {
          setStudentsList([]);
        }
      }
    } catch (err) {
      toastError('Failed to load assigned section options.');
    } finally {
      setLoading(false);
      setLoadingStudents(false);
    }
  };

  // ─── Helper: Update Settings Object ─────────────────────────────────
  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Timer Helpers ──────────────────────────────────────────────────
  const toggleTimer = (enabled) => {
    setSettings((prev) => ({
      ...prev,
      timer: {
        enabled,
        minutes: enabled ? prev.timer?.minutes || 30 : null,
      },
    }));
  };

  const handleTimerMinutesChange = (text) => {
    const numericVal = parseInt(text.replace(/[^0-9]/g, ''), 10);
    setSettings((prev) => ({
      ...prev,
      timer: {
        enabled: prev.timer?.enabled || false,
        minutes: isNaN(numericVal) ? '' : numericVal,
      },
    }));
  };

  // ─── Date & Time Picker Flow ────────────────────────────────────────
  const openPicker = (field, mode = 'date') => {
    const existingVal = settings[field] ? new Date(settings[field]) : new Date();
    setPickerState({
      show: true,
      mode,
      field,
      tempDate: isNaN(existingVal.getTime()) ? new Date() : existingVal,
    });
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setPickerState((prev) => ({ ...prev, show: false }));
        return;
      }
      const activeDate = selectedDate || pickerState.tempDate;
      if (pickerState.mode === 'date') {
        setPickerState({
          show: true,
          mode: 'time',
          field: pickerState.field,
          tempDate: activeDate,
        });
      } else {
        updateSetting(pickerState.field, activeDate.toISOString());
        setPickerState((prev) => ({ ...prev, show: false }));
      }
    } else {
      const activeDate = selectedDate || pickerState.tempDate;
      setPickerState((prev) => ({ ...prev, tempDate: activeDate }));
    }
  };

  const confirmIosDate = () => {
    updateSetting(pickerState.field, pickerState.tempDate.toISOString());
    setPickerState((prev) => ({ ...prev, show: false }));
  };

  const clearDate = (field) => {
    updateSetting(field, null);
  };

  const formatDateLabel = (isoString) => {
    if (!isoString) return 'Not set';
    const dt = new Date(isoString);
    if (isNaN(dt.getTime())) return 'Not set';
    return dt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ─── Scope & Exclusion Toggles ──────────────────────────────────────
  const toggleSection = (secName) => {
    const current = Array.isArray(settings.targetSections)
      ? settings.targetSections
      : [];
    const updated = current.includes(secName)
      ? current.filter((s) => s !== secName)
      : [...current, secName];
    updateSetting('targetSections', updated);
  };

  const toggleYear = (yearName) => {
    const current = Array.isArray(settings.targetYears)
      ? settings.targetYears
      : [];
    const updated = current.includes(yearName)
      ? current.filter((y) => y !== yearName)
      : [...current, yearName];
    updateSetting('targetYears', updated);
  };

  const toggleExcludeStudent = (studentId) => {
    const current = Array.isArray(settings.excludedStudentIds)
      ? settings.excludedStudentIds
      : [];
    const updated = current.includes(studentId)
      ? current.filter((id) => id !== studentId)
      : [...current, studentId];
    updateSetting('excludedStudentIds', updated);
  };

  const currentTimer = settings.timer || { enabled: false, minutes: null };
  const excludedList = Array.isArray(settings.excludedStudentIds)
    ? settings.excludedStudentIds
    : [];

  const activeSections = Array.isArray(settings.targetSections)
    ? settings.targetSections
    : [];

  const filteredStudents =
    activeSections.length > 0
      ? studentsList.filter((s) => !s.section || activeSections.includes(s.section))
      : studentsList;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme?.card || '#FFF' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Assessment Settings</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="checkmark" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              Configure rules, schedule dates, target sections, and exceptions
            </Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#153c2a" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* ─── 1. SCHEDULE & ACCESS DATES ───────────────────────── */}
              <Text style={styles.sectionHeading}>Schedule & Access</Text>
              
              {/* Available At */}
              <View style={styles.settingCard}>
                <View style={styles.dateHeaderRow}>
                  <View>
                    <Text style={styles.settingTitle}>Available From</Text>
                    <Text style={styles.settingSub}>
                      When students can start taking the quiz
                    </Text>
                  </View>
                  {settings.availableAt && (
                    <TouchableOpacity
                      onPress={() => clearDate('availableAt')}
                      style={styles.clearBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.dateSelectorBtn}
                  onPress={() => openPicker('availableAt', 'date')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={20} color="#153c2a" />
                  <Text style={styles.dateText}>
                    {formatDateLabel(settings.availableAt)}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Deadline At */}
              <View style={styles.settingCard}>
                <View style={styles.dateHeaderRow}>
                  <View>
                    <Text style={styles.settingTitle}>Submission Deadline</Text>
                    <Text style={styles.settingSub}>
                      Due date and time for submissions
                    </Text>
                  </View>
                  {settings.deadlineAt && (
                    <TouchableOpacity
                      onPress={() => clearDate('deadlineAt')}
                      style={styles.clearBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.dateSelectorBtn}
                  onPress={() => openPicker('deadlineAt', 'date')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={20} color="#153c2a" />
                  <Text style={styles.dateText}>
                    {formatDateLabel(settings.deadlineAt)}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>

                {/* Close on deadline toggle */}
                <View style={styles.subToggleRow}>
                  <Text style={styles.subToggleText}>
                    Close quiz automatically on deadline
                  </Text>
                  <Switch
                    value={!!settings.closeOnDeadline}
                    onValueChange={(val) => updateSetting('closeOnDeadline', val)}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFF"
                  />
                </View>
              </View>

              {/* ─── 2. TIMER & DELIVERY POLICIES ─────────────────────── */}
              <Text style={[styles.sectionHeading, { marginTop: 10 }]}>
                Timer & Retake Policies
              </Text>

              {/* Timer Config */}
              <View style={styles.settingCard}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Enable Time Limit</Text>
                    <Text style={styles.settingSub}>
                      Set a countdown timer for each attempt
                    </Text>
                  </View>
                  <Switch
                    value={!!currentTimer.enabled}
                    onValueChange={toggleTimer}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFF"
                  />
                </View>

                {currentTimer.enabled && (
                  <View style={styles.numericInputRow}>
                    <Text style={styles.numericLabel}>Time Limit (Minutes):</Text>
                    <TextInput
                      style={styles.numericInput}
                      keyboardType="number-pad"
                      placeholder="e.g. 30"
                      placeholderTextColor="#94A3B8"
                      value={
                        currentTimer.minutes !== null && currentTimer.minutes !== undefined
                          ? String(currentTimer.minutes)
                          : ''
                      }
                      onChangeText={handleTimerMinutesChange}
                    />
                  </View>
                )}
              </View>

              {!isExternal && (
                <View style={styles.settingCard}>
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Allow Retakes</Text>
                      <Text style={styles.settingSub}>
                        Let students retake the assessment
                      </Text>
                    </View>
                    <Switch
                      value={!!settings.allowRetakes}
                      onValueChange={(val) => updateSetting('allowRetakes', val)}
                      trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                      thumbColor="#FFF"
                    />
                  </View>

                  {settings.allowRetakes && (
                    <View style={styles.numericInputRow}>
                      <Text style={styles.numericLabel}>Max Retakes (1 - 20):</Text>
                      <TextInput
                        style={styles.numericInput}
                        keyboardType="number-pad"
                        placeholder="3"
                        placeholderTextColor="#94A3B8"
                        value={
                          settings.maxRetakes !== null && settings.maxRetakes !== undefined
                            ? String(settings.maxRetakes)
                            : '3'
                        }
                        onChangeText={(text) => {
                          const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                          updateSetting(
                            'maxRetakes',
                            isNaN(num) ? 1 : Math.max(1, Math.min(20, num))
                          );
                        }}
                      />
                    </View>
                  )}

                  <View style={styles.subToggleRow}>
                    <Text style={styles.subToggleText}>
                      Shuffle Question Order
                    </Text>
                    <Switch
                      value={!!settings.shuffleQuestions}
                      onValueChange={(val) => updateSetting('shuffleQuestions', val)}
                      trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                      thumbColor="#FFF"
                    />
                  </View>
                </View>
              )}

              {/* ─── 3. TARGET ASSIGNMENT SCOPE ───────────────────────── */}
              <Text style={[styles.sectionHeading, { marginTop: 10 }]}>
                Target Year Levels
              </Text>
              <View style={styles.chipGrid}>
                {options.yearLevels.map((year) => {
                  const active = (settings.targetYears || []).includes(year);
                  return (
                    <TouchableOpacity
                      key={year}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleYear(year)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 20 }]}>
                Target Assigned Sections
              </Text>
              {options.sections.length === 0 ? (
                <Text style={styles.emptyText}>
                  No sections assigned to your instructor account.
                </Text>
              ) : (
                <View style={styles.chipGrid}>
                  {options.sections.map((sec) => {
                    const active = (settings.targetSections || []).includes(sec);
                    return (
                      <TouchableOpacity
                        key={sec}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleSection(sec)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {sec}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ─── 4. EXCLUDE SPECIFIC STUDENTS ─────────────────────── */}
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionHeading}>
                  Exclude Specific Student(s)
                </Text>
                <Text style={styles.settingSub}>
                  Selected students will be restricted from taking this assessment
                </Text>

                {loadingStudents ? (
                  <ActivityIndicator
                    size="small"
                    color="#153c2a"
                    style={{ alignSelf: 'flex-start', marginTop: 10 }}
                  />
                ) : filteredStudents.length === 0 ? (
                  <Text style={[styles.emptyText, { marginTop: 10 }]}>
                    No student roster loaded for exclusion.
                  </Text>
                ) : (
                  <View style={[styles.chipGrid, { marginTop: 12 }]}>
                    {filteredStudents.map((student) => {
                      const studentId = student._id || student.id;
                      const isExcluded = excludedList.includes(studentId);
                      const displayName =
                        `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
                        student.name ||
                        student.email ||
                        `Student`;

                      return (
                        <TouchableOpacity
                          key={studentId}
                          style={[
                            styles.chip,
                            isExcluded && styles.chipExcluded,
                          ]}
                          onPress={() => toggleExcludeStudent(studentId)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isExcluded ? 'close-circle' : 'person-outline'}
                            size={14}
                            color={isExcluded ? '#FFF' : '#64748B'}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.chipText,
                              isExcluded && styles.chipTextExcluded,
                            ]}
                          >
                            {displayName} {student.section ? `(${student.section})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* ─── NATIVE DATE / TIME PICKER MODAL (iOS & Android) ────────── */}
          {pickerState.show && (
            <>
              <DateTimePicker
                value={pickerState.tempDate}
                mode={pickerState.mode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
              {Platform.OS === 'ios' && (
                <View style={styles.iosPickerToolbar}>
                  <TouchableOpacity
                    style={styles.iosPickerBtn}
                    onPress={() =>
                      setPickerState((prev) => ({ ...prev, show: false }))
                    }
                  >
                    <Text style={styles.iosCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iosPickerBtn, styles.iosConfirmBtn]}
                    onPress={confirmIosDate}
                  >
                    <Text style={styles.iosConfirmText}>Confirm Date</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '88%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#153c2a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 4 },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 6,
    borderRadius: 10,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: '#153c2a',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  settingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  settingTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  settingSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 6,
    borderRadius: 8,
  },
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  dateText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  subToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  subToggleText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numericInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  numericLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
  numericInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    width: 80,
    height: 40,
    textAlign: 'center',
    fontWeight: '800',
    color: '#0F172A',
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#153c2a', borderColor: '#153c2a' },
  chipExcluded: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  chipTextExcluded: { color: '#FFF' },
  emptyText: { fontStyle: 'italic', color: '#94A3B8', fontSize: 13 },
  iosPickerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  iosPickerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  iosConfirmBtn: { backgroundColor: '#153c2a' },
  iosCancelText: { color: '#64748B', fontWeight: '700' },
  iosConfirmText: { color: '#FFF', fontWeight: '800' },
});