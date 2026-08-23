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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from 'react-native-date-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../Pages/src/services/api';
import { ThemeContext } from '../Pages/src/context/ThemeContext';
import { toastError } from '../Pages/src/components/ToastMsg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [showExcludeDropdown, setShowExcludeDropdown] = useState(false);

  // ─── Unified Date/Time Picker State ─────────────────────────────────
  const [pickerState, setPickerState] = useState({
    show: false,
    field: null,
    tempDate: new Date(),
  });

  useEffect(() => {
    if (visible) {
      loadInstructorScopedOptions();
    }
  }, [visible]);

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

      if (Array.isArray(data.students)) {
        setStudentsList(data.students);
      } else {
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

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

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

  // ─── Custom Picker Flow ─────────────────────────────────────────────
  const openPicker = (field) => {
    const existingVal = settings[field] ? new Date(settings[field]) : new Date();
    setPickerState({
      show: true,
      field,
      tempDate: isNaN(existingVal.getTime()) ? new Date() : existingVal,
    });
  };

  const confirmDate = () => {
    updateSetting(pickerState.field, pickerState.tempDate.toISOString());
    setPickerState((prev) => ({ ...prev, show: false }));
  };

  const clearDate = (field) => {
    updateSetting(field, null);
  };

  const formatDateLabel = (isoString) => {
    if (!isoString) return 'Select date and time';
    const dt = new Date(isoString);
    if (isNaN(dt.getTime())) return 'Select date and time';
    return dt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  const sortedFilteredStudents = [...filteredStudents].sort((a, b) => {
    const nameA = (`${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || a.email || `Student`).toLowerCase();
    const nameB = (`${b.firstName || ''} ${b.lastName || ''}`.trim() || b.name || b.email || `Student`).toLowerCase();
    return nameA.localeCompare(nameB);
  });

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
              {/* 1. SCHEDULE & ACCESS DATES */}
              <Text style={styles.sectionHeading}>Schedule & Access</Text>
              
              <View style={styles.settingCard}>
                <View style={styles.dateHeaderRow}>
                  <View style={{ flex: 1 }}>
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
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.dateSelectorBtn}
                  onPress={() => openPicker('availableAt')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color="#153c2a" />
                  <Text style={[styles.dateText, !settings.availableAt && { color: '#94A3B8' }]}>
                    {formatDateLabel(settings.availableAt)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={styles.settingCard}>
                <View style={styles.dateHeaderRow}>
                  <View style={{ flex: 1 }}>
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
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.dateSelectorBtn}
                  onPress={() => openPicker('deadlineAt')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={18} color="#153c2a" />
                  <Text style={[styles.dateText, !settings.deadlineAt && { color: '#94A3B8' }]}>
                    {formatDateLabel(settings.deadlineAt)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

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

              {/* SCORE VISIBILITY SETTING */}
              <Text style={[styles.sectionHeading, { marginTop: 10 }]}>Score Visibility</Text>
              <View style={styles.settingCard}>
                <Text style={[styles.settingSub, { marginBottom: 10 }]}>
                  Choose when students can see their assessment score.
                </Text>
                <View style={styles.toggleRow}>
                  <Text style={[styles.subToggleText, { flex: 1, marginRight: 10 }]}>
                    Show score immediately
                  </Text>
                  <Switch
                    value={settings.scoreVisibility !== 'after_instructor_grade'}
                    onValueChange={(val) => updateSetting('scoreVisibility', val ? 'immediate' : 'after_instructor_grade')}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFF"
                  />
                </View>
              </View>

              {/* 2. TIMER & DELIVERY POLICIES */}
              <Text style={[styles.sectionHeading, { marginTop: 10 }]}>
                Timer & Retake Policies
              </Text>

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

              {/* 3. TARGET ASSIGNMENT SCOPE */}
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

              {/* 4. EXCLUDE SPECIFIC STUDENTS */}
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
                ) : sortedFilteredStudents.length === 0 ? (
                  <Text style={[styles.emptyText, { marginTop: 10 }]}>
                    No student roster loaded for exclusion.
                  </Text>
                ) : (
                  <View style={styles.dropdownContainer}>
                    <TouchableOpacity
                      style={styles.dropdownHeader}
                      onPress={() => setShowExcludeDropdown(!showExcludeDropdown)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dropdownHeaderText, excludedList.length > 0 && { color: '#EF4444', fontWeight: '800' }]}>
                        {excludedList.length > 0
                          ? `${excludedList.length} Student(s) Excluded`
                          : 'Select students to exclude'}
                      </Text>
                      <Ionicons
                        name={showExcludeDropdown ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>

                    {showExcludeDropdown && (
                      <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                        {sortedFilteredStudents.map((student) => {
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
                              style={styles.dropdownItem}
                              onPress={() => toggleExcludeStudent(studentId)}
                            >
                              <Ionicons
                                name={isExcluded ? "checkbox" : "square-outline"}
                                size={22}
                                color={isExcluded ? "#EF4444" : "#CBD5E1"}
                              />
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  isExcluded && { color: '#EF4444', fontWeight: '700' },
                                ]}
                                numberOfLines={1}
                              >
                                {displayName} {student.section ? `(${student.section})` : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* Unified App Theme Modal for Date & Time (Both iOS and Android) */}
          {pickerState.show && (
            <Modal transparent animationType="slide">
              <View style={styles.overlay}>
                <View style={[styles.modalContent, { height: '55%', backgroundColor: theme?.card || '#FFF' }]}>
                  <View style={styles.iosPickerToolbar}>
                    <TouchableOpacity onPress={() => setPickerState((prev) => ({ ...prev, show: false }))}>
                      <Text style={styles.iosCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.iosPickerTitle}>Date & Time</Text>
                    <TouchableOpacity onPress={confirmDate}>
                      <Text style={styles.iosConfirmText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.iosPickerWrapper}>
                    <DatePicker
                      date={pickerState.tempDate}
                      mode="datetime"
                      onDateChange={(date) => setPickerState(prev => ({ ...prev, tempDate: date }))}
                      textColor="#153c2a"
                      theme="light"
                      style={styles.iosSpinner}
                    />
                  </View>
                </View>
              </View>
            </Modal>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    borderRadius: 12,
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
  dropdownContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8FAFC',
  },
  dropdownHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dropdownList: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFF',
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 12,
    flex: 1,
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
  chipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  emptyText: { fontStyle: 'italic', color: '#94A3B8', fontSize: 13 },
  
  iosPickerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#153c2a',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#153c2a',
  },
  iosPickerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iosCancelText: { color: '#E2E8F0', fontSize: 16, fontWeight: '800' },
  iosConfirmText: { color: '#E2E8F0', fontSize: 16, fontWeight: '900' },
  iosPickerWrapper: {
    backgroundColor: '#FFF',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosSpinner: {
    width: SCREEN_WIDTH, 
    height: 250,
  },
});