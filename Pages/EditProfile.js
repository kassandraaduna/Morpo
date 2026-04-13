import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Image, } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import styles from './src/styles/Styles';
import ConfirmSheet from './src/components/ConfirmSheet';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';

const API_URL = 'http://192.168.1.24:8000/api';

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

    /* ================= LOAD USER ================= */
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

    /* ================= HELPERS ================= */
    const hasChanges =
        JSON.stringify(form) !== JSON.stringify(original) ||
        avatar !== originalAvatar;

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

    /* ================= IMAGE PICKER ================= */
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

    /* ================= SAVE ================= */
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

        try {
        setLoading(true);

        const res = await axios.put(
            `${API_URL}/meds/${user._id}`,
            {
            fname: form.fname,
            lname: form.lname,
            dob: form.dob,
            gender: form.gender,
            username: form.username,
            email: form.email,
            number: form.number,
            }
        );

        const updatedUser = {
            ...res.data,
            avatar: avatar,
        };

        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

        setOriginal(updatedUser);
        setForm(updatedUser);
        setUser(updatedUser);
        setOriginalAvatar(avatar);

        setEditMode(false);

        toastSuccess('Profile updated successfully');
        } 
        catch (err) {
            const data = err.response?.data;
            if (data?.errors) {
                setErrors(data.errors);
                toastError('Some fields need attention');
            } else {
                toastError(data?.error || 'Failed to update profile');
            }
        }
        finally {
        setLoading(false);
        }
    };

    /* ================= FIELD ================= */
    const Field = ({ field, value, editable, placeholder }) => (
        <View style={styles.editFieldWrap}>
        <TextInput
            style={[
            styles.editInput,
            { backgroundColor: theme.search, color: theme.text },
            !editable && styles.editDisabled,
            ]}
            value={String(value || '')}
            editable={editable}
            placeholder={placeholder}
            placeholderTextColor={theme.subText}
            onChangeText={(v) => onChange(field, v)}
        />
        {errors[field] && (
            <Text style={styles.fieldError}>{errors[field]}</Text>
        )}
        </View>
    );

    /* ================= UI ================= */
    return (
        <>
        <ScrollView
            style={{ backgroundColor: theme.bg }}
            contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 15, }}
        >
            {/* HEADER */}
            <View style={[styles.editHeader, { flexDirection: 'row', alignItems: 'center', },]}>
                <View style={{ width: 40 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[styles.editTitle, { color: theme.text }]}>
                    EDIT PROFILE
                    </Text>
                </View>

                <View style={{ width: 40 }} />
                </View>

            {/* PROFILE IMAGE */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity activeOpacity={0.8} onPress={pickImage}>
                <View
                style={{
                    width: 110,
                    height: 110,
                    borderRadius: 110,
                    borderWidth: 1,
                    borderColor: '#E0E0E0',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#FFF',
                    marginTop: 25
                }}
                >
                {avatar ? (
                    <Image
                    source={{ uri: avatar }}
                    style={{
                        width: 110,
                        height: 110,
                        borderRadius: 110,
                    }}
                    />
                ) : (
                    <Ionicons
                    name="camera-outline"
                    size={32}
                    color="#F2A1B3"
                    />
                )}

                {editMode && (
                    <View
                    style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 6,
                        backgroundColor: '#FFF',
                        borderRadius: 14,
                        padding: 4,
                    }}
                    >
                    <Ionicons
                        name="pencil"
                        size={20}
                        color="#E14B4B"
                    />
                    </View>
                )}
                </View>
            </TouchableOpacity>

            <Text style={[styles.accountName, { marginTop: 10, fontWeight: '700', color: theme.text, }]}>
                {user.fname} {user.lname}
            </Text>
            </View>

            {/* ACCOUNT INFO */}
            <View
                style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginHorizontal: 16,
                    marginBottom: 8,
                    marginTop: 25,
                }]}
                >
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    ACCOUNT INFORMATION
                </Text>

                <TouchableOpacity
                    onPress={() =>
                    editMode ? setConfirmCancel(true) : setEditMode(true)
                    }
                >
                    <Ionicons
                        name={editMode ? 'close-circle' : 'pencil'}
                        size={20}
                        color={editMode ? '#E14B4B' : theme.edit}
                    />
                </TouchableOpacity>
            </View>

            <View style={[styles.editCard, {backgroundColor: theme.editCard,}]}>
            <Field field="fname" value={form.fname} editable={editMode} placeholder="First Name" />
            <Field field="lname" value={form.lname} editable={editMode} placeholder="Last Name" />
            <Field field="dob" value={form.dob?.slice?.(0, 10)} editable={editMode} placeholder="Date of Birth" />
            <Field field="gender" value={form.gender} editable={editMode} placeholder="Gender" />
            <Field field="username" value={form.username} editable={editMode} placeholder="Username" />
            <Field field="email" value={form.email} editable={editMode} placeholder="Email" />
            <Field field="number" value={form.number} editable={editMode} placeholder="Mobile Number" />
            </View>

            {/* SAVE */}
            {editMode && (
            <TouchableOpacity
                style={styles.saveBtn}
                onPress={onSave}
                disabled={loading}
            >
                {loading ? (
                <ActivityIndicator color="#000" />
                ) : (
                <Text style={styles.saveBtnText}>Save</Text>
                )}
            </TouchableOpacity>
            )}
        </ScrollView>

        {/* CANCEL CONFIRM */}
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
        </>
    );
}
