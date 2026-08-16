import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

export default function ConfirmSheet({ visible, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onConfirm, onCancel }) {
  const { theme } = useContext(ThemeContext);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme?.card || '#FFF' }]}>
          <View style={[styles.modalIconCircle, { backgroundColor: danger ? '#FEF2F2' : '#E7F5EE' }]}>
            <Ionicons name={danger ? 'warning' : 'help'} size={28} color={danger ? '#EF4444' : '#153c2a'} />
          </View>
          <Text style={[styles.modalTitle, { color: theme?.text || '#1E293B' }]}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel}>
              <Text style={styles.modalCancelText}>{cancelText}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalConfirmBtn, { backgroundColor: danger ? '#EF4444' : '#153c2a' }]} 
              onPress={onConfirm}
            >
              <Text style={styles.modalConfirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 340, padding: 25, borderRadius: 10, alignItems: 'center', elevation: 10 },
  modalIconCircle: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 25, fontWeight: '600', lineHeight: 18 },
  modalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontWeight: '800', color: '#64748B', fontSize: 13 },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalConfirmText: { fontWeight: '800', color: '#FFF', fontSize: 13 }
});