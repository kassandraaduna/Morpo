import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform, StatusBar, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ConfirmSheet from './src/components/ConfirmSheet';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';
import { toAbsUrl } from './src/services/api'; 
import api from './src/services/api';

export default function EditProfile({ navigation }) {
    const { theme } = useContext(ThemeContext);

    const [user, setUser] = useState(null);
    const [form, setForm] = useState({});
    const [original, setOriginal] = useState({});
    const [errors, setErrors] = useState({});

    const [avatar, setAvatar] = useState(null);
    const [originalAvatar, setOriginalAvatar] = useState(null);

    const [editMode, setEditMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

    useEffect(() => {
        (async () => {
            const raw = await AsyncStorage.getItem('user');
            if (!raw) return;

            const u = JSON.parse(raw);
            setUser(u);
            setForm(u);
            setOriginal(u);
            setAvatar(u.avatar || null);
            setOriginalAvatar(u.avatar || null);
        })();
    }, []);

    if (!user) return null;

    const hasChanges = JSON.stringify(form) !== JSON.stringify(original) || avatar !== originalAvatar;

    const onChange = (key, value) => {
        setForm((p) => ({ ...p, [key]: value }));
        setErrors((p) => ({ ...p, [key]: null }));
    };

    const validate = () => {
        const e = {};
        if (!form.fname?.trim()) e.fname = 'First name is required';
        if (!form.lname?.trim()) e.lname = 'Last name is required';
        if (!form.username?.trim()) e.username = 'Username is required';
        if (!form.email?.trim()) e.email = 'Email is required';
        if (!form.number?.trim()) e.number = 'Mobile number is required';
        return e;
    };

    const pickImage = async () => {
        if (!editMode) return;
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            toastError('Permission to access gallery denied');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const onSave = async () => {
        if (!hasChanges) {
            toastSuccess('Saved without changes');
            setEditMode(false);
            return;
        }

        const v = validate();
        if (Object.keys(v).length) {
            setErrors(v);
            toastError('Please fix the errors');
            return;
        }

        Alert.alert(
            "Save Changes",
            "Are you sure you want to update your profile information?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Save",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const res = await api.put(`/meds/${user._id}`, {
                                fname: form.fname,
                                lname: form.lname,
                                dob: form.dob,
                                gender: form.gender,
                                username: form.username,
                                email: form.email,
                                number: form.number,
                            });

                            const updatedUser = { ...res.data, avatar: avatar };
                            await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

                            setOriginal(updatedUser);
                            setForm(updatedUser);
                            setUser(updatedUser);
                            setOriginalAvatar(avatar);
                            setEditMode(false);

                            toastSuccess('Profile updated successfully');
                        } catch (err) {
                            const data = err.response?.data;
                            if (data?.errors) {
                                setErrors(data.errors);
                                toastError('Some fields need attention');
                            } else {
                                toastError(data?.error || 'Failed to update profile');
                            }
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const displayAvatar = avatar?.startsWith('file') ? avatar : toAbsUrl(avatar);

    const Field = ({ field, value, editable, placeholder, icon }) => (
        <View style={localStyles.fieldContainer}>
            <Text style={[localStyles.fieldLabel, { color: theme.text }]}>{placeholder}</Text>
            <View style={[localStyles.inputWrapper, { backgroundColor: theme.card, borderColor: editable ? '#10b981' : '#E2E8F0', borderWidth: editable ? 1 : 0 }]}>
                <Ionicons name={icon} size={18} color="#94A3B8" style={localStyles.inputIcon} />
                <TextInput
                    style={[localStyles.input, { color: editable ? theme.text : theme.subText }]}
                    value={String(value || '')}
                    editable={editable}
                    placeholder={placeholder}
                    placeholderTextColor="#94A3B8"
                    onChangeText={(v) => onChange(field, v)}
                />
            </View>
            {errors[field] && <Text style={localStyles.errorText}>{errors[field]}</Text>}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />

            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={localStyles.title}>Account Information</Text>
                        <Text style={localStyles.subtitle}>View and update your personal information</Text>
                    </View>
                    <TouchableOpacity onPress={() => editMode ? setConfirmCancel(true) : setEditMode(true)}>
                        <Ionicons name={editMode ? 'close-circle' : 'create-outline'} size={28} color={editMode ? '#EF4444' : '#ffffff'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 50, paddingHorizontal: 20 }}>
                <View style={localStyles.avatarSection}>
                    <TouchableOpacity activeOpacity={0.8} onPress={pickImage} disabled={!editMode}>
                        <View style={localStyles.avatarCircle}>
                            {avatar ? (
                                <Image source={{ uri: displayAvatar }} style={localStyles.avatarImage} />
                            ) : (
                                <Ionicons name="person" size={45} color="#94A3B8" />
                            )}
                            {editMode && (
                                <View style={localStyles.editBadge}>
                                    <Ionicons name="camera" size={16} color="#fff" />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                    <Text style={[localStyles.accountName, { color: theme.text }]}>{user.fname} {user.lname}</Text>
                    <View style={localStyles.roleBadge}>
                        <Text style={localStyles.roleText}>{user.role || 'Student'}</Text>
                    </View>
                </View>

                <View style={localStyles.formContainer}>
                    <Field field="fname" value={form.fname} editable={editMode} placeholder="First Name" icon="person-outline" />
                    <Field field="lname" value={form.lname} editable={editMode} placeholder="Last Name" icon="person-outline" />
                    <Field field="username" value={form.username} editable={editMode} placeholder="Username" icon="at-outline" />
                    <Field field="email" value={form.email} editable={editMode} placeholder="Email Address" icon="mail-outline" />
                    <Field field="number" value={form.number} editable={editMode} placeholder="Mobile Number" icon="call-outline" />
                    <Field field="gender" value={form.gender} editable={editMode} placeholder="Gender" icon="male-female-outline" />
                    <Field field="dob" value={form.dob?.slice?.(0, 10)} editable={editMode} placeholder="Date of Birth (YYYY-MM-DD)" icon="calendar-outline" />
                </View>

                {editMode && (
                    <TouchableOpacity style={localStyles.saveBtn} onPress={onSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.saveBtnText}>Save Changes</Text>}
                    </TouchableOpacity>
                )}
            </ScrollView>

            <ConfirmSheet
                visible={confirmCancel}
                title="Discard changes?"
                message="Your unsaved changes will be lost."
                confirmText="Discard"
                danger
                onCancel={() => setConfirmCancel(false)}
                onConfirm={() => {
                    setForm(original);
                    setAvatar(originalAvatar);
                    setErrors({});
                    setEditMode(false);
                    setConfirmCancel(false);
                }}
            />
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { 
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, 
        paddingBottom: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 20 },
    subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },

    avatarSection: { alignItems: 'center', marginTop: 25, marginBottom: 20 },
    avatarCircle: { 
        width: 110, height: 110, borderRadius: 55, backgroundColor: '#f1f5f9', 
        justifyContent: 'center', alignItems: 'center', elevation: 4, 
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, overflow: 'visible' 
    },
    avatarImage: { width: 110, height: 110, borderRadius: 55, resizeMode: 'cover' },
    editBadge: { 
        position: 'absolute', bottom: 0, right: 0, backgroundColor: '#10b981', 
        width: 34, height: 34, borderRadius: 17, justifyContent: 'center', 
        alignItems: 'center', borderWidth: 3, borderColor: '#fff' 
    },
    accountName: { fontSize: 20, fontWeight: '900', marginTop: 15 },
    roleBadge: { alignSelf: 'center', backgroundColor: '#e7f8f2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
    roleText: { color: '#153c2a', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

    formContainer: { marginTop: 10 },
    fieldContainer: { marginBottom: 15 },
    fieldLabel: { fontSize: 13, fontWeight: '800', marginBottom: 6, marginLeft: 4, color: '#153c2a' },
    inputWrapper: { 
        flexDirection: 'row', alignItems: 'center', height: 55, 
        borderRadius: 14, paddingHorizontal: 15, elevation: 1, 
        shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, fontWeight: '600' },
    errorText: { color: '#EF4444', fontSize: 11, marginTop: 4, marginLeft: 4, fontWeight: 'bold' },

    saveBtn: { 
        backgroundColor: '#153c2a', height: 55, borderRadius: 16, 
        justifyContent: 'center', alignItems: 'center', marginTop: 15, 
        elevation: 3, shadowColor: '#153c2a', shadowOpacity: 0.3, shadowRadius: 8 
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});