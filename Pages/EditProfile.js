import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Platform, StatusBar, KeyboardAvoidingView, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import { ThemeContext } from './src/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { toAbsUrl } from './src/services/api';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

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

const Field = ({ field, value, editable, placeholder, icon, theme, errors, onChange, onPress }) => {
    const [isFocused, setIsFocused] = useState(false);

    const FieldContent = (
        <View style={[localStyles.inputWrapper, { 
            backgroundColor: theme.card, 
            borderColor: editable ? (isFocused ? '#153c2a' : '#E2E8F0') : 'transparent', 
            borderWidth: editable ? 1.5 : 0 
        }]}>
            <Ionicons name={icon} size={18} color="#94A3B8" style={localStyles.inputIcon} />
            {onPress ? (
                <Text style={[localStyles.input, { color: value ? (editable ? theme.text : theme.subText) : '#94A3B8', textAlignVertical: 'center', alignSelf: 'center' }]}>
                    {value || placeholder}
                </Text>
            ) : (
                <TextInput
                    style={[localStyles.input, { color: editable ? theme.text : theme.subText }]}
                    value={String(value || '')}
                    editable={editable}
                    placeholder={placeholder}
                    placeholderTextColor="#94A3B8"
                    onChangeText={(v) => onChange(field, v)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
            )}
        </View>
    );

    return (
        <View style={localStyles.fieldContainer}>
            <Text style={[localStyles.fieldLabel, { color: theme.text }]}>{placeholder}</Text>
            {onPress && editable ? (
                <TouchableOpacity 
                    activeOpacity={0.8} 
                    onPress={onPress}
                    onPressIn={() => setIsFocused(true)}
                    onPressOut={() => setIsFocused(false)}
                >
                    {FieldContent}
                </TouchableOpacity>
            ) : (
                FieldContent
            )}
            {errors[field] && <Text style={localStyles.errorText}>{errors[field]}</Text>}
        </View>
    );
};

export default function EditProfile({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const insets = useSafeAreaInsets();

    const [user, setUser] = useState(null);
    const [form, setForm] = useState({});
    const [original, setOriginal] = useState({});
    const [errors, setErrors] = useState({});

    const [avatar, setAvatar] = useState(null);
    const [originalAvatar, setOriginalAvatar] = useState(null);

    const [editMode, setEditMode] = useState(false);
    const [loading, setLoading] = useState(false);

    // Advanced Calendar & Dropdown States
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showGenderPicker, setShowGenderPicker] = useState(false);
    const [calendarMode, setCalendarMode] = useState('days'); 
    const [calendarYear, setCalendarYear] = useState(2004);
    const [calendarMonth, setCalendarMonth] = useState(0); 
    const [selectedDay, setSelectedDay] = useState(1);

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
        else if (!/^[a-zA-ZñÑ\s.-]+$/.test(form.fname.trim())) e.fname = 'First name contains invalid characters';

        if (!form.lname?.trim()) e.lname = 'Last name is required';
        else if (!/^[a-zA-ZñÑ\s.-]+$/.test(form.lname.trim())) e.lname = 'Last name contains invalid characters';

        if (!form.gender?.trim()) e.gender = 'Gender selection is required';
        if (!form.dob?.trim()) e.dob = 'Date of birth cannot be empty';

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
            quality: 0.8,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri); 
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

        if (actionType === 'remove_avatar') {
            setAvatar(null);
            toastSuccess('Profile photo removed. Save changes to apply.');
            return;
        }

        if (actionType === 'save') {
            try {
                setLoading(true);
                const endpoint = `/meds/${user._id}`;

                const formData = new FormData();
                formData.append('fname', form.fname || '');
                formData.append('lname', form.lname || '');
                formData.append('dob', form.dob || '');
                formData.append('gender', form.gender || '');
                formData.append('username', user.username || '');
                formData.append('email', user.email || '');
                formData.append('number', user.number || '');

                if (avatar !== originalAvatar) {
                    if (avatar) {
                        const fileUri = avatar;
                        const filename = avatar.split('/').pop() || `avatar_${Date.now()}.jpg`;
                        const match = /\.(\w+)$/.exec(filename);
                        const type = match ? `image/${match[1]}` : `image/jpeg`;

                        formData.append('avatar', {
                            uri: fileUri,
                            name: filename,
                            type,
                        });
                    } else {
                        formData.append('avatar', ''); 
                    }
                }

                await api.put(endpoint, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                const freshUserRes = await api.get(endpoint);
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
                const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to update profile';
                toastError(errorMsg);
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

    // ─── CALENDAR LOGIC ──────────────────────────────────────────────
    const openDatePicker = () => {
        if (form.dob) {
            const [y, m, d] = form.dob.slice(0, 10).split('-');
            if (y && m && d) {
                setCalendarYear(parseInt(y, 10));
                setCalendarMonth(parseInt(m, 10) - 1);
                setSelectedDay(parseInt(d, 10));
            }
        }
        setShowDatePicker(true);
    };

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        if (calendarMonth === 0) {
            setCalendarMonth(11);
            setCalendarYear((y) => y - 1);
        } else {
            setCalendarMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (calendarMonth === 11) {
            setCalendarMonth(0);
            setCalendarYear((y) => y + 1);
        } else {
            setCalendarMonth((m) => m + 1);
        }
    };

    const confirmSelectedDate = () => {
        const formatted = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        onChange('dob', formatted);
        setShowDatePicker(false);
        setCalendarMode('days');
    };

    const renderCalendarGrid = () => {
        if (calendarMode === 'years') {
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let y = currentYear - 80; y <= currentYear; y++) {
                years.push(y);
            }
            return (
                <View style={localStyles.yearGridContainer}>
                    {years.reverse().map((yr) => (
                        <TouchableOpacity
                            key={yr}
                            style={[localStyles.yearCell, calendarYear === yr && localStyles.cellSelected]}
                            onPress={() => {
                                setCalendarYear(yr);
                                setCalendarMode('days');
                            }}
                        >
                            <Text style={[localStyles.yearText, calendarYear === yr && localStyles.cellTextSelected]}>
                                {yr}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        if (calendarMode === 'months') {
            return (
                <View style={localStyles.monthGridContainer}>
                    {MONTH_NAMES.map((mName, mIdx) => (
                        <TouchableOpacity
                            key={mName}
                            style={[localStyles.monthCell, calendarMonth === mIdx && localStyles.cellSelected]}
                            onPress={() => {
                                setCalendarMonth(mIdx);
                                setCalendarMode('days');
                            }}
                        >
                            <Text style={[localStyles.monthText, calendarMonth === mIdx && localStyles.cellTextSelected]}>
                                {mName.slice(0, 3)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        }

        const totalDays = getDaysInMonth(calendarYear, calendarMonth);
        const firstDayIndex = getFirstDayOfMonth(calendarYear, calendarMonth);
        const gridItems = [];

        for (let i = 0; i < firstDayIndex; i++) {
            gridItems.push(<View key={`empty-${i}`} style={localStyles.dayCell} />);
        }

        for (let d = 1; d <= totalDays; d++) {
            const isSelected = selectedDay === d;
            gridItems.push(
                <TouchableOpacity
                    key={`day-${d}`}
                    style={[localStyles.dayCell, isSelected && localStyles.cellSelected]}
                    onPress={() => setSelectedDay(d)}
                >
                    <Text style={[localStyles.dayText, isSelected && localStyles.cellTextSelected]}>
                        {d}
                    </Text>
                </TouchableOpacity>
            );
        }

        return <View style={localStyles.daysGridContainer}>{gridItems}</View>;
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" backgroundColor="#153c2a" />

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

            <ScrollView contentContainerStyle={{ paddingBottom: 50 + insets.bottom, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
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
                        <TouchableOpacity 
                            onPress={() => setModalConfig({
                                visible: true,
                                title: "Remove Profile Photo",
                                message: "Are you sure you want to remove your profile photo?",
                                actionType: 'remove_avatar'
                            })} 
                            style={localStyles.removePhotoBtn}
                        >
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
                    <Field field="fname" value={form.fname} editable={editMode} placeholder="First Name" icon="person-outline" theme={theme} errors={errors} onChange={onChange} />
                    <Field field="lname" value={form.lname} editable={editMode} placeholder="Last Name" icon="person-outline" theme={theme} errors={errors} onChange={onChange} />
                    
                    
                    {/* Read-Only Admin Controlled Fields */}
                    <Field field="username" value={form.username} editable={false} placeholder="Username" icon="at-outline" theme={theme} errors={errors} onChange={onChange} />
                    <Field field="email" value={form.email} editable={false} placeholder="Email Address" icon="mail-outline" theme={theme} errors={errors} onChange={onChange} />
                    <Field field="number" value={form.number} editable={false} placeholder="Mobile Number" icon="call-outline" theme={theme} errors={errors} onChange={onChange} />
                    
                    <Field 
                        field="gender" 
                        value={form.gender} 
                        editable={editMode} 
                        placeholder="Gender" 
                        icon="male-female-outline" 
                        theme={theme} 
                        errors={errors} 
                        onChange={onChange}
                        onPress={() => setShowGenderPicker(true)} 
                    />
                    <Field 
                        field="dob" 
                        value={form.dob?.slice?.(0, 10)} 
                        editable={editMode} 
                        placeholder="Date of Birth" 
                        icon="calendar-outline" 
                        theme={theme} 
                        errors={errors} 
                        onChange={onChange}
                        onPress={openDatePicker} 
                    />
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
                                    (modalConfig.actionType === 'discard' || modalConfig.actionType === 'remove_avatar') 
                                        ? localStyles.confirmDangerBtn 
                                        : localStyles.confirmSaveBtn
                                ]} 
                                onPress={executeModalAction}
                            >
                                <Text style={localStyles.confirmBtnText}>
                                    {modalConfig.actionType === 'discard' ? 'Discard' : modalConfig.actionType === 'remove_avatar' ? 'Remove' : 'Save'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Gender Selection Modal */}
            <Modal visible={showGenderPicker} transparent animationType="fade" onRequestClose={() => setShowGenderPicker(false)}>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.dropdownContainer}>
                        <Text style={localStyles.dropdownTitle}>Select Gender</Text>
                        {GENDER_OPTIONS.map((g) => (
                            <TouchableOpacity 
                                key={g} 
                                style={localStyles.dropdownItem} 
                                onPress={() => {
                                    onChange('gender', g);
                                    setShowGenderPicker(false);
                                }}
                            >
                                <Text style={[localStyles.dropdownItemText, form.gender === g && { color: '#153c2a', fontWeight: '900' }]}>{g}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={localStyles.dropdownCancelBtn} onPress={() => setShowGenderPicker(false)}>
                            <Text style={localStyles.dropdownCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Date Picker Modal */}
            <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setShowDatePicker(false);
                    setCalendarMode('days');
                }}
            >
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.calendarCard}>
                        <View style={localStyles.calendarHeader}>
                            {calendarMode === 'days' ? (
                                <>
                                    <TouchableOpacity onPress={handlePrevMonth} style={localStyles.navBtn}>
                                        <Ionicons name="chevron-back" size={20} color="#153c2a" />
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <TouchableOpacity onPress={() => setCalendarMode('months')}>
                                            <Text style={localStyles.monthYearText}>{MONTH_NAMES[calendarMonth]}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setCalendarMode('years')}>
                                            <Text style={localStyles.monthYearText}>{calendarYear}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity onPress={handleNextMonth} style={localStyles.navBtn}>
                                        <Ionicons name="chevron-forward" size={20} color="#153c2a" />
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={localStyles.backToDaysBtn}
                                    onPress={() => setCalendarMode('days')}
                                >
                                    <Ionicons name="arrow-back" size={16} color="#153c2a" />
                                    <Text style={localStyles.backToDaysText}>Back to Calendar</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {calendarMode === 'days' && (
                            <View style={localStyles.daysOfWeekRow}>
                                {DAYS_OF_WEEK.map((day) => (
                                    <Text key={day} style={localStyles.dayOfWeekText}>
                                        {day}
                                    </Text>
                                ))}
                            </View>
                        )}

                        <ScrollView
                            style={{ maxHeight: 290 }}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={calendarMode !== 'days' ? { paddingVertical: 10 } : undefined}
                        >
                            {renderCalendarGrid()}
                        </ScrollView>

                        <View style={localStyles.calendarActionRow}>
                            <TouchableOpacity
                                style={[localStyles.calendarBtn, localStyles.calendarBtnCancel]}
                                onPress={() => {
                                    setShowDatePicker(false);
                                    setCalendarMode('days');
                                }}
                            >
                                <Text style={localStyles.calendarBtnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[localStyles.calendarBtn, localStyles.calendarBtnConfirm]}
                                onPress={confirmSelectedDate}
                            >
                                <Text style={localStyles.calendarBtnConfirmText}>Confirm</Text>
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
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 5, position: 'relative' },
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

    // Dropdown Styles
    dropdownContainer: { backgroundColor: '#FFF', width: '80%', borderRadius: 12, padding: 20, elevation: 5 },
    dropdownTitle: { fontSize: 18, fontWeight: '800', color: '#153c2a', marginBottom: 15, textAlign: 'center' },
    dropdownItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
    dropdownItemText: { fontSize: 16, color: '#475569', fontWeight: '600' },
    dropdownCancelBtn: { marginTop: 15, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 8, alignItems: 'center' },
    dropdownCancelText: { fontSize: 15, fontWeight: '700', color: '#64748B' },

    calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    monthYearText: { fontSize: 15, fontWeight: '900', color: '#153c2a', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#E7F5EE', borderRadius: 8 },
    navBtn: { padding: 8, backgroundColor: '#E7F5EE', borderRadius: 10 },
    backToDaysBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#E7F5EE', borderRadius: 8 },
    backToDaysText: { fontSize: 13, fontWeight: '800', color: '#153c2a' },
    daysOfWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    dayOfWeekText: { 
        width: '14.2%', 
        textAlign: 'center', 
        fontSize: 13, 
        fontWeight: '800', 
        color: '#64748B' 
    },
    daysGridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { 
        width: '14.2%', 
        height: 40, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginVertical: 2, 
        borderRadius: 10 
    },
    cellSelected: { backgroundColor: '#153c2a' },
    dayText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    cellTextSelected: { color: '#FFFFFF', fontWeight: '900' },
    yearGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
    yearCell: { width: '30%', height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    yearText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    monthGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
    monthCell: { width: '30%', height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    monthText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    calendarActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
    calendarBtn: { flex: 1, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    calendarBtnCancel: { backgroundColor: '#F1F5F9' },
    calendarBtnConfirm: { backgroundColor: '#153c2a' },
    calendarBtnCancelText: { color: '#475569', fontSize: 14, fontWeight: '800' },
    calendarBtnConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }
});