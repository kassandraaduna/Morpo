import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StudentViewModal({
  visible,
  onClose,
  title,
  questions = [],
  timer = {},
}) {
  const insets = useSafeAreaInsets();
  const [selectedAnswers, setSelectedAnswers] = useState({});

  const selectOption = (questionIdx, optionIdx) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionIdx]: optionIdx }));
  };

  const totalPoints = questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0);

  // Safe top clearance (respects iOS notch and Android status bar)
  const topPadding = Platform.OS === 'ios' ? insets.top : Math.max(insets.top, StatusBar.currentHeight || 0);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1E293B" translucent={false} />

        {/* Top Bar - Preview Banner with Safe Area Inset */}
        <View style={[styles.previewBanner, { paddingTop: topPadding + 6 }]}>
          <Ionicons name="eye-outline" size={18} color="#FFF" />
          <Text style={styles.previewBannerText}>
            STUDENT VIEW PREVIEW • NOT SUBMITTABLE
          </Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title || 'Untitled Assessment'}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {questions.length} Items • {totalPoints} Points
              </Text>
              {timer?.enabled && (
                <View style={styles.timerBadge}>
                  <Ionicons name="time-outline" size={14} color="#B45309" />
                  <Text style={styles.timerText}>{timer.minutes} Mins</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
        </View>

        {/* Questions List */}
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}>
          {questions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No questions added yet.</Text>
            </View>
          ) : (
            questions.map((q, idx) => {
              const selectedOpt = selectedAnswers[idx];
              return (
                <View key={idx} style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <Text style={styles.questionNumber}>Question {idx + 1}</Text>
                    <Text style={styles.pointsBadge}>{q.points || 1} pt(s)</Text>
                  </View>
                  <Text style={styles.questionText}>
                    {q.text || 'Untitled Question'}
                  </Text>

                  {/* Options */}
                  <View style={styles.optionsList}>
                    {(q.options || []).map((opt, optIdx) => {
                      const isSelected = selectedOpt === optIdx;
                      return (
                        <TouchableOpacity
                          key={optIdx}
                          style={[
                            styles.optionRow,
                            isSelected && styles.optionRowSelected,
                          ]}
                          onPress={() => selectOption(idx, optIdx)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={isSelected ? '#153c2a' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.optionText,
                              isSelected && styles.optionTextSelected,
                            ]}
                          >
                            {opt || `Option ${optIdx + 1}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Bottom Bar - Padded to clear system navigation bar */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <TouchableOpacity style={styles.exitBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.exitBtnText}>Exit Student View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  previewBanner: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
    gap: 6,
  },
  previewBannerText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10 },
  metaText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  timerText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  closeBtn: { padding: 6 },
  scrollContent: { padding: 16 },
  questionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  pointsBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#153c2a',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  optionsList: { gap: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 10,
  },
  optionRowSelected: {
    borderColor: '#153c2a',
    backgroundColor: '#F0FDF4',
  },
  optionText: { fontSize: 14, color: '#334155', flex: 1, fontWeight: '500' },
  optionTextSelected: { color: '#153c2a', fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#64748B', fontStyle: 'italic' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  exitBtn: {
    backgroundColor: '#153c2a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  exitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});