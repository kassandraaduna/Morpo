import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, TextInput, ScrollView, TouchableOpacity, 
  StyleSheet, Platform, ActivityIndicator, Alert 
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function CreatePractice({ route, navigation }) {
  const { type } = route.params; // 'flashcard' or 'test'
  const { theme } = useContext(ThemeContext);
  
  const [title, setTitle] = useState('');
  const [items, setItems] = useState(type === 'flashcard' ? [{ front: '', back: '' }] : [{ text: '', options: ['', '', '', ''], correctIndex: 0 }]);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then(u => { if(u) setStudentId(JSON.parse(u)._id); });
  }, []);

  const addItem = () => {
    if (type === 'flashcard') {
      setItems([...items, { front: '', back: '' }]);
    } else {
      setItems([...items, { text: '', options: ['', '', '', ''], correctIndex: 0 }]);
    }
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

const handleSave = async () => {
  if (!title.trim()) return toastError("Please enter a title.");
  
  const isValid = items.every(item => 
    type === 'flashcard' ? (item.front.trim() && item.back.trim()) : (item.text.trim() && item.options.every(o => o.trim()))
  );
  
  if (!isValid) return toastError("Please fill in all fields for every item.");

  setLoading(true);

  const payload = {
    title: title.trim(),
    quizType: type,
    deliveryMode: 'internal',
    createdBy: studentId,
    [type === 'flashcard' ? 'flashcards' : 'questions']: items,
    feedbackRanges: [
      { min: 0, max: 50, message: "Keep practicing!" },
      { min: 51, max: 100, message: "Great job!" }
    ]
  };

  try {
    const res = await api.post('/assessments', payload);
    console.log("Save Success:", res.data);
    toastSuccess("Practice saved!");
    navigation.goBack();
  } catch (err) {
    console.log("Save Error Details:", err.response?.data);
    toastError(err.response?.data?.message || "Failed to save.");
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[localStyles.headerTitle, { color: theme.text }]}>New {type === 'flashcard' ? 'Flash Deck' : 'Practice Test'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#153c2a" /> : <Text style={localStyles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={localStyles.label}>Title</Text>
        <TextInput 
          style={[localStyles.input, { backgroundColor: theme.card, color: '#000000' }]} 
          placeholder="e.g. Yeast Structures Review"
          value={title}
          onChangeText={setTitle}
        />

        <View style={{ marginTop: 20 }}>
          {items.map((item, index) => (
            <View key={index} style={[localStyles.itemCard, { backgroundColor: theme.card }]}>
              <View style={localStyles.itemHeader}>
                <Text style={localStyles.itemNum}>ITEM {index + 1}</Text>
                <TouchableOpacity onPress={() => removeItem(index)}><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
              </View>

              {type === 'flashcard' ? (
                <>
                  <TextInput 
                    style={[localStyles.smallInput, { color: theme.text }]} 
                    placeholder="Front (Term)" 
                    value={item.front}
                    onChangeText={(val) => {
                      const newItems = [...items];
                      newItems[index].front = val;
                      setItems(newItems);
                    }}
                  />
                  <TextInput 
                    style={[localStyles.smallInput, { color: theme.text }]} 
                    placeholder="Back (Definition)" 
                    value={item.back}
                    onChangeText={(val) => {
                      const newItems = [...items];
                      newItems[index].back = val;
                      setItems(newItems);
                    }}
                  />
                </>
              ) : (
                <>
                  <TextInput 
                    style={[localStyles.smallInput, { color: theme.text, fontWeight: 'bold' }]} 
                    placeholder="Enter Question" 
                    value={item.text}
                    onChangeText={(val) => {
                      const newItems = [...items];
                      newItems[index].text = val;
                      setItems(newItems);
                    }}
                  />
                  {item.options.map((opt, optIdx) => (
                    <View key={optIdx} style={localStyles.optionRow}>
                      <TouchableOpacity 
                        onPress={() => {
                          const newItems = [...items];
                          newItems[index].correctIndex = optIdx;
                          setItems(newItems);
                        }}
                      >
                        <Ionicons 
                          name={item.correctIndex === optIdx ? "radio-button-on" : "radio-button-off"} 
                          size={20} color="#153c2a" 
                        />
                      </TouchableOpacity>
                      <TextInput 
                        style={{ flex: 1, marginLeft: 10, color: theme.text }} 
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        value={opt}
                        onChangeText={(val) => {
                          const newItems = [...items];
                          newItems[index].options[optIdx] = val;
                          setItems(newItems);
                        }}
                      />
                    </View>
                  ))}
                </>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity style={localStyles.addBtn} onPress={addItem}>
          <Ionicons name="add-circle" size={20} color="#153c2a" />
          <Text style={localStyles.addBtnText}>Add Another Item</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  saveText: { color: '#153c2a', fontWeight: 'bold', fontSize: 16 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase' },
  input: { padding: 15, borderRadius: 12, fontSize: 16 },
  itemCard: { padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  itemNum: { fontSize: 10, fontWeight: '900', color: '#000000' },
  smallInput: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 10, marginBottom: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc', borderRadius: 15, marginTop: 10 },
  addBtnText: { marginLeft: 8, fontWeight: 'bold', color: '#153c2a' }
});