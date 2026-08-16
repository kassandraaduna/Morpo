import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform, StatusBar, KeyboardAvoidingView, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';
import api, { toAbsUrl } from './src/services/api';

const getInitials = (fname, lname) => {
    const f = fname ? fname.charAt(0).toUpperCase() : '';
    const l = lname ? lname.charAt(0).toUpperCase() : '';
    return `${f}${l}` || 'U';
};

const getAvatarUri = (url, u) => {
    if (!url) return null;
    if (url.startsWith('data:image') || url.startsWith('file:')) return url;
    return `${toAbsUrl(url)}?v=${u?.updatedAt || '1'}`;
};

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

    const [modalConfig, setModalConfig] = useState({
        visible: false,
        title: '',
        message: '',
        actionType: null,
    });

    const closeActionModal = () => {
        setModalConfig({ visible: false, title: '', message: '', actionType: null });
    };

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
            aspect: [1, 1],
            quality: 0.3,   // Compress heavily for database limits
            base64: true,   // GUARANTEES SYNC: Encodes the image as a string for JSON payload
        });

        if (!result.canceled) {
            setAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const handleSaveTrigger = () => {
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

        setModalConfig({
            visible: true,
            title: "Save Changes",
            message: "Are you sure you want to update your profile information?",
            actionType: 'save'
        });
    };

    const executeModalAction = async () => {
        const { actionType } = modalConfig;
        closeActionModal();

        if (actionType === 'save') {
            try {
                setLoading(true);
                
                // Send standard JSON payload with the Base64 image
                const payload = {
                    fname: form.fname || '',
                    lname: form.lname || '',
                    dob: form.dob || '',
                    gender: form.gender || '',
                    username: form.username || '',
                    email: form.email || '',
                    number: form.number || '',
                };

                if (avatar !== originalAvatar) {
                    payload.avatar = avatar || ''; // Empty string instructs backend to remove it
                }

                await api.put(`/meds/${user._id}`, payload);

                // Fetch fresh DB data to update local states and ensure caching timestamp changes
                const freshUserRes = await api.get(`/meds/${user._id}`);
                const updatedUser = freshUserRes.data?.data || freshUserRes.data;

                await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

                setOriginal(updatedUser);
                setForm(updatedUser);
                setUser(updatedUser);
                setAvatar(updatedUser.avatar || null);
                setOriginalAvatar(updatedUser.avatar || null);
                setEditMode(false);

                toastSuccess('Profile updated successfully');
            } catch (err) {
                toastError(err.response?.data?.message || err.response?.data?.error || 'Failed to update profile');
            } finally {
                setLoading(false);
            }
        } else if (actionType === 'discard') {
            setForm(original);
            setAvatar(originalAvatar);
            setErrors({});
            setEditMode(false);
        }
    };

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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />

            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={localStyles.headerTextContainer}>
                        <Text style={localStyles.title}>Account Info</Text>
                        <Text style={localStyles.subtitle}>View and update your profile</Text>
                    </View>
                    <TouchableOpacity onPress={() => editMode ? setModalConfig({visible: true, title: "Discard changes?", message: "Your unsaved changes will be lost.", actionType: 'discard'}) : setEditMode(true)} style={localStyles.rightBtn}>
                        <Ionicons name={editMode ? 'close-circle' : 'pencil'} size={25} color={editMode ? '#EF4444' : '#ffffff'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 50, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
                <View style={localStyles.avatarSection}>
                    <TouchableOpacity activeOpacity={0.8} onPress={pickImage} disabled={!editMode}>
                        <View style={localStyles.avatarCircle}>
                            {avatar ? (
                                <Image source={{ uri: getAvatarUri(avatar, user) }} style={localStyles.avatarImage} />
                            ) : (
                                <Text style={localStyles.initialsText}>
                                    {getInitials(user.fname, user.lname)}
                                </Text>
                            )}
                            {editMode && (
                                <View style={localStyles.editBadge}>
                                    <Ionicons name="camera" size={16} color="#fff" />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>

                    {editMode && avatar && (
                        <TouchableOpacity onPress={() => setAvatar(null)} style={localStyles.removePhotoBtn}>
                            <Ionicons name="trash-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={localStyles.removePhotoText}>Remove Photo</Text>
                        </TouchableOpacity>
                    )}

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
                    <TouchableOpacity style={localStyles.saveBtn} onPress={handleSaveTrigger} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.saveBtnText}>Save Changes</Text>}
                    </TouchableOpacity>
                )}
            </ScrollView>

            <Modal animationType="fade" transparent={true} visible={modalConfig.visible} onRequestClose={closeActionModal}>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContainer}>
                        <Text style={localStyles.modalTitle}>{modalConfig.title}</Text>
                        <Text style={localStyles.modalMessage}>{modalConfig.message}</Text>
                        <View style={localStyles.modalButtonGroup}>
                            <TouchableOpacity style={[localStyles.modalBtn, localStyles.cancelBtn]} onPress={closeActionModal}>
                                <Text style={localStyles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[
                                    localStyles.modalBtn, 
                                    modalConfig.actionType === 'discard' ? localStyles.confirmDangerBtn : localStyles.confirmSaveBtn
                                ]} 
                                onPress={executeModalAction}
                            >
                                <Text style={localStyles.confirmBtnText}>
                                    {modalConfig.actionType === 'discard' ? 'Discard' : 'Save'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </KeyboardAvoidingView>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' },
    backBtn: { position: 'absolute', left: 0, zIndex: 10 },
    rightBtn: { position: 'absolute', right: 0, zIndex: 10 },
    headerTextContainer: { alignItems: 'center', paddingHorizontal: 35 },
    title: { fontSize: 25, fontWeight: '900', color: '#fff', textAlign: 'center' },
    subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2, textAlign: 'center' },
    avatarSection: { alignItems: 'center', marginTop: 25, marginBottom: 20 },
    avatarCircle: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', overflow: 'visible', borderWidth:3, borderColor: '#153c2a', },
    avatarImage: { width: 110, height: 110, borderRadius: 55, resizeMode: 'cover' },
    initialsText: { fontSize: 40, fontWeight: '900', color: '#153c2a' },
    editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#10b981', width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
    removePhotoBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF2F2', borderRadius: 10 },
    removePhotoText: { color: '#EF4444', fontWeight: '800', fontSize: 12 },
    accountName: { fontSize: 21, fontWeight: '900', marginTop: 15 },
    roleBadge: { alignSelf: 'center', backgroundColor: '#e7f8f2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
    roleText: { color: '#153c2a', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    formContainer: { marginTop: 10 },
    fieldContainer: { marginBottom: 15 },
    fieldLabel: { fontSize: 15, fontWeight: '800', marginBottom: 6, marginLeft: 4, color: '#153c2a' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 55, borderRadius: 10, paddingHorizontal: 15, elevation: 1, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, fontWeight: '600' },
    errorText: { color: '#EF4444', fontSize: 13, marginTop: 4, marginLeft: 4, fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#153c2a', height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 15, elevation: 3, shadowColor: '#153c2a', shadowOpacity: 0.3, shadowRadius: 8 },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { backgroundColor: '#FFF', width: '90%', borderRadius: 10, padding: 25, alignItems: 'center', elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#153c2a', marginBottom: 10 },
    modalMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
    cancelBtn: { backgroundColor: '#F1F5F9' },
    cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 15 },
    confirmSaveBtn: { backgroundColor: '#153c2a' },
    confirmDangerBtn: { backgroundColor: '#EF4444' },
    confirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});