import React from 'react';
import { View, Text, Switch, TextInput, StyleSheet } from 'react-native';

export default function AssessmentSettings({ settings, setSettings }) {
    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Assessment Settings</Text>

            {/* SAVE AS DRAFT */}
            <View style={styles.row}>
                <Text style={styles.label}>Save as Draft</Text>
                <Switch
                    value={settings.isDraft}
                    onValueChange={(val) => setSettings({ ...settings, isDraft: val })}
                    trackColor={{ false: '#E2E8F0', true: '#153c2a' }}
                />
            </View>

            {/* SHUFFLE QUESTIONS */}
            <View style={styles.row}>
                <Text style={styles.label}>Shuffle Questions</Text>
                <Switch
                    value={settings.shuffleQuestions}
                    onValueChange={(val) => setSettings({ ...settings, shuffleQuestions: val })}
                    trackColor={{ false: '#E2E8F0', true: '#153c2a' }}
                />
            </View>

            {/* RETAKES */}
            <View style={styles.inputRow}>
                <Text style={styles.label}>Number of Retakes</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g., 2"
                    value={String(settings.retakes)}
                    onChangeText={(val) => setSettings({ ...settings, retakes: parseInt(val) || 0 })}
                />
            </View>

            {/* TIMER */}
            <View style={styles.inputRow}>
                <Text style={styles.label}>Timer (minutes)</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g., 30"
                    value={String(settings.timer || '')}
                    onChangeText={(val) => setSettings({ ...settings, timer: parseInt(val) || 0 })}
                />
            </View>

            {/* SECTIONS & EXCLUSIONS (Standard text inputs for now, can be swapped to multi-select later) */}
            <View style={styles.inputBlock}>
                <Text style={styles.label}>Assign to Sections (Comma separated)</Text>
                <TextInput
                    style={styles.largeInput}
                    placeholder="e.g., Section A, Section B or 'All'"
                    value={settings.assignedSections}
                    onChangeText={(val) => setSettings({ ...settings, assignedSections: val })}
                />
            </View>

            <View style={styles.inputBlock}>
                <Text style={styles.label}>Excluded Students (Emails, comma separated)</Text>
                <TextInput
                    style={styles.largeInput}
                    placeholder="e.g., student@email.com"
                    value={settings.excludedStudents}
                    onChangeText={(val) => setSettings({ ...settings, excludedStudents: val })}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#153c2a', marginBottom: 15 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    inputBlock: { marginBottom: 15 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155' },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8, width: 80, textAlign: 'center', backgroundColor: '#F8FAFC' },
    largeInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, marginTop: 5, backgroundColor: '#F8FAFC' }
});