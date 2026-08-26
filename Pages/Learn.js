import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, SectionList, Linking, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Platform, Dimensions, Modal, StatusBar,  } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');

const extractArray = (resData) => {
    if (!resData) return [];
    if (Array.isArray(resData)) return resData;
    if (typeof resData === 'object') {
        if (Array.isArray(resData.data) && resData.data.length > 0) return resData.data;
        if (resData.data?.data && Array.isArray(resData.data.data) && resData.data.data.length > 0) return resData.data.data;
        
        let largest = [];
        for (const key in resData) {
            if (Array.isArray(resData[key]) && resData[key].length > largest.length) {
                largest = resData[key];
            }
        }
        return largest;
    }
    return [];
};

const getUserId = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field.trim();
    if (typeof field === 'object') {
        if (field._id) return String(field._id).trim();
        if (field.id) return String(field.id).trim();
    }
    return null;
};

export default function Learn({ navigation, route }) {

    const { theme } = useContext(ThemeContext);
    const [user, setUser] = useState(null);
    const initialTabParam = route.params?.initialTab;
    const [activeTab, setActiveTab] = useState(initialTabParam || 'Lessons');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showInstructorMenu, setShowInstructorMenu] = useState(false);
    const [isArchiveModalVisible, setArchiveModalVisible] = useState(false);
    const [lessonToArchive, setLessonToArchive] = useState(null);

    const [lessons, setLessons] = useState([]);
    const [remedialLessons, setRemedialLessons] = useState([]);
    const [models, setModels] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [bookmarks, setBookmarks] = useState({ lessons: [], models: [], scans: [] });
    const [usersMap, setUsersMap] = useState({});

    const [showAssessmentMenu, setShowAssessmentMenu] = useState(false);
    const [itemToArchive, setItemToArchive] = useState({ id: null, type: null });

    const handleEditAssessment = (assessmentItem) => {
        navigation.navigate('EditAssessment', { assessment: assessmentItem });
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const rawUser = await AsyncStorage.getItem('user');
            if (!rawUser) {
                setLoading(false);
                return;
            }
            const currentUser = JSON.parse(rawUser);
            setUser(currentUser);
            const currentUserId = getUserId(currentUser);
            const userRole = String(currentUser.role || '').toLowerCase();
            const isInstructor = userRole === 'instructor';
            
            if (isInstructor && activeTab === 'Remedial Lessons') {
                setActiveTab('Lessons');
            }

            const savedBookmarksRaw = await AsyncStorage.getItem(`bookmarks_${currentUserId}`);
            const savedBookmarks = savedBookmarksRaw ? JSON.parse(savedBookmarksRaw) : { lessons: [], models: [], scans: [] };
            setBookmarks(savedBookmarks);

            const [usersRes1, usersRes2, lessonsRes, remedialRes, modelsRes, models3dRes, quizRes, assessRes] = await Promise.all([
                api.get('/meds').catch(() => ({ data: [] })),
                api.get('/admin/users').catch(() => ({ data: [] })),
                api.get('/lessons').catch(() => ({ data: [] })),
                api.get(`/ai/personalized-lessons/${currentUserId}`).catch(() => ({ data: [] })),
                api.get('/models').catch(() => ({ data: [] })), 
                api.get('/models3d').catch(() => ({ data: [] })), 
                api.get('/quizzes').catch(() => ({ data: [] })),
                api.get('/assessments').catch(() => ({ data: [] })) 
            ]);

            const usersData = Array.from(new Map(
                [...extractArray(usersRes1?.data), ...extractArray(usersRes2?.data)]
                .filter(u => u && (u._id || u.id))
                .map(u => [u._id || u.id, u])
            ).values());

            const uMap = {};
            usersData.forEach(u => { 
                if (u._id || u.id) uMap[String(u._id || u.id)] = u; 
            });
            setUsersMap(uMap);

            const rawLessons = extractArray(lessonsRes.data);
            const rawRemedial = extractArray(remedialRes.data);
            
            const combinedModels = [...extractArray(modelsRes.data), ...extractArray(models3dRes.data)];
            const uniqueModels = Array.from(new Map(combinedModels.map(item => [item._id || item.id, item])).values());

            const combinedQuizzes = [...extractArray(quizRes.data), ...extractArray(assessRes.data)];
            const uniqueQuizzes = Array.from(new Map(combinedQuizzes.map(item => [item._id || item.id, item])).values());

            let validLessons = [];
            let validRemedial = [];
            let validQuizzes = [];

            if (isInstructor) {
                validLessons = rawLessons.filter(l => {
                    if (l.isArchived) return false;
                    const cId = getUserId(l.createdBy) || getUserId(l.instructor) || getUserId(l.author);
                    if (!cId) return true; 
                    return String(cId) === String(currentUserId);
                });
                validQuizzes = uniqueQuizzes.filter(q => {
                    if (q.isArchived || q.type === 'remedial' || q.isRemedial) return false;
                    const cId = getUserId(q.createdBy) || getUserId(q.instructor) || getUserId(q.author);
                    if (!cId) return true;
                    return String(cId) === String(currentUserId);
                });
            } else {
                const studentSection = String(currentUser.section || '').trim().toLowerCase();

                const assignedInstructorIds = usersData.filter(u => {
                    if (String(u.role).toLowerCase() !== 'instructor') return false;
                    const assignments = Array.isArray(u.instructorAssignments) ? u.instructorAssignments : [];
                    return assignments.some(a =>
                        String(a.section).trim().toLowerCase() === studentSection
                    );
                }).map(u => String(u._id || u.id));
                
                validLessons = rawLessons.filter(l => {
                    if (l.isArchived) return false;
                    const cId = getUserId(l.createdBy) || getUserId(l.instructor) || getUserId(l.author);
                    if (!cId) return true;
                    return assignedInstructorIds.includes(cId);
                });
                validRemedial = rawRemedial.map(l => ({ ...l, type: 'remedial', title: `Remedial: ${l.topic}`, pdfName: 'Personalized AI Content' }));
            }

            validQuizzes.sort((a, b) => {
                if (!a.deadlineAt && b.deadlineAt) return 1;
                if (a.deadlineAt && !b.deadlineAt) return -1;

                if (!a.deadlineAt && !b.deadlineAt) {
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                }

                return new Date(b.deadlineAt) - new Date(a.deadlineAt);
            });

            const grouped = validQuizzes.reduce((acc, current) => {
                const dateStr = current.deadlineAt 
                    ? new Date(current.deadlineAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'No Due Date';
                
                if (!acc[dateStr]) {
                    acc[dateStr] = [];
                }
                acc[dateStr].push(current);
                return acc;
            }, {});

            // 3. Convert to SectionList format: [{ title: '...', data: [...] }]
            const sectionedQuizzes = Object.keys(grouped).map(key => ({
                title: key,
                data: grouped[key]
            }));

            setLessons(validLessons);
            setRemedialLessons(validRemedial);
            setModels(uniqueModels); 
            setAssessments(sectionedQuizzes);
            
        } catch (error) {
            console.error("Learn Fetch Error:", error);
            toastError("Failed to load content.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    useEffect(() => {
        if (route.params?.initialTab) {
        setActiveTab(route.params.initialTab);
        }
    }, [route.params?.initialTab]);

    useEffect(() => {
        let list = [];
        if (activeTab === 'Lessons') list = lessons;
        else if (activeTab === 'Remedial Lessons') list = remedialLessons;
        else if (activeTab === '3D Models' || activeTab === 'Models') list = models; 
        else if (activeTab === 'Assessments') list = assessments;

        let filtered = [...list]; 

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => {
                const title = (item.title || item.name || '').toLowerCase();
                return title.includes(query);
            });
        }

        filtered.sort((a, b) => {
            const dateA = new Date(a?.createdAt || a?.updatedAt || 0).getTime() || 0;
            const dateB = new Date(b?.createdAt || b?.updatedAt || 0).getTime() || 0;
            return dateB - dateA;
        });

        setFilteredData(filtered);
    }, [searchQuery, activeTab, lessons, remedialLessons, models, assessments]);

    const handleToggleBookmark = async (itemId, type) => {
        try {
            let newBookmarks = { ...bookmarks };
            if (!newBookmarks[type]) newBookmarks[type] = [];

            if (newBookmarks[type].includes(itemId)) {
                newBookmarks[type] = newBookmarks[type].filter(id => id !== itemId);
                toastSuccess('Removed from Bookmarks');
            } else {
                newBookmarks[type].push(itemId);
                toastSuccess('Saved to Bookmarks');
            }

            setBookmarks(newBookmarks);
            await AsyncStorage.setItem(`bookmarks_${user._id}`, JSON.stringify(newBookmarks));
        } catch (error) {
            console.error(`Failed to toggle ${type} bookmark:`, error);
        }
    };

    const triggerArchiveLesson = (id) => {
        setItemToArchive({ id, type: 'lesson' });
        setArchiveModalVisible(true);
    };

    const triggerArchiveAssessment = (id) => {
        setItemToArchive({ id, type: 'assessment' });
        setArchiveModalVisible(true);
    };

    const confirmArchive = async () => {
        setArchiveModalVisible(false);
        try {
            if (itemToArchive.type === 'lesson') {
                await api.put(`/lessons/${itemToArchive.id}`, { 
                    isArchived: true, 
                    modifiedBy: user?._id 
                });
                toastSuccess("Lesson moved to archive");
            } else if (itemToArchive.type === 'assessment') {
                await api.put(`/assessments/${itemToArchive.id}/archive`);
                toastSuccess("Assessment moved to archive");
            }
            fetchData();
        } catch (e) {
            toastError("Archive failed");
        }
    };

    const renderLessonItem = ({ item }) => {
        const isRemedial = activeTab === 'Remedial Lessons';
        const isBookmarked = bookmarks?.lessons?.includes(item._id || item.id);
        const isInstructor = String(user?.role).toLowerCase() === 'instructor';
        const dateStr = new Date(item.updatedAt || item.createdAt).toLocaleDateString();

        let modifierName = 'Instructor';
        if (!isRemedial) {
            const modId = getUserId(item.modifiedBy) || getUserId(item.createdBy);
            const modUser = modId ? usersMap[String(modId)] : null;

            if (modUser && modUser.fname) {
                modifierName = `${modUser.fname} ${modUser.lname}`.trim();
            } else if (typeof item.modifiedBy === 'object' && item.modifiedBy?.fname) {
                modifierName = `${item.modifiedBy.fname} ${item.modifiedBy.lname}`.trim();
            } else if (typeof item.createdBy === 'object' && item.createdBy?.fname) {
                modifierName = `${item.createdBy.fname} ${item.createdBy.lname}`.trim();
            }
        }
        
        return (
            <TouchableOpacity
                style={[localStyles.listItemCard, { backgroundColor: theme?.card || '#FFF' }]}
                onPress={() => navigation.navigate('LessonStudent', { 
                    lessonId: isRemedial ? null : (item._id || item.id), 
                    personalizedLesson: isRemedial ? item : null 
                })}
            >
                <View style={[localStyles.iconBox, { backgroundColor: isRemedial ? '#FEF2F2' : '#F0F9F4' }]}>
                    <Ionicons name={isRemedial ? "medical" : "book"} size={26} color={isRemedial ? "#EF4444" : "#153c2a"} />
                </View>
                <View style={localStyles.itemInfo}>
                    <Text style={[localStyles.itemTitle, { color: theme?.text || '#000' }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={localStyles.itemSubtitle} numberOfLines={1}>
                        {isRemedial ? 'Personalized AI Content' : `Modified by ${modifierName}`}
                    </Text>
                    <Text style={localStyles.itemMeta}>Last updated: {dateStr}</Text>
                </View>

                {isInstructor ? (
                    <View style={localStyles.instructorActionRow}>
                        <TouchableOpacity style={localStyles.actionIconBtn} onPress={() => navigation.navigate('UploadLesson', { lesson: item })}>
                            <Ionicons name="pencil" size={20} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity style={localStyles.actionIconBtn} onPress={() => triggerArchiveLesson(item._id || item.id)}>
                            <Ionicons name="archive" size={20} color="#ff8800" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={localStyles.bookmarkBtn} onPress={() => handleToggleBookmark(item._id || item.id, 'lessons')}>
                        <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={24} color={isBookmarked ? "#153c2a" : "#94A3B8"} />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    const renderAssessmentItem = ({ item }) => {
        const dateStr = new Date(item.createdAt || Date.now()).toLocaleDateString();
        const isInstructor = String(user?.role).toLowerCase() === 'instructor';
        
        return (
            <TouchableOpacity
                style={[localStyles.listItemCard, { backgroundColor: theme?.card || '#FFF' }]}
                onPress={() => {
                    if (isInstructor) {
                        navigation.navigate('AssessmentQuestionsView', { 
                            assessment: item, 
                            quiz: item, 
                            quizId: item._id || item.id 
                        });
                    }
                }}
            >
                <View style={[localStyles.iconBox, { backgroundColor: '#F8FAFC' }]}>
                    <Ionicons 
                        name={item.deliveryMode === 'external' ? "link" : "document-text"} 
                        size={26} 
                        color="#3B82F6" 
                    />
                </View>
                
                <View style={localStyles.itemInfo}>
                    <Text style={[localStyles.itemTitle, { color: theme?.text || '#000' }]} numberOfLines={1}>
                        {item.title || 'Assessment'}
                    </Text>
                    <Text style={localStyles.itemSubtitle} numberOfLines={1}>
                        {item.deliveryMode === 'external' 
                            ? 'External Link' 
                            : `${item.questions?.length || 0} Items Available`
                        }
                    </Text>
                    <Text style={localStyles.itemMeta}>Posted: {dateStr}</Text>
                </View>

                {/* Show Edit/Archive for Instructors, Chevron for Students */}
                {isInstructor ? (
                    <View style={localStyles.actionRow}>
                        <TouchableOpacity
                            style={localStyles.actionBtn}
                            onPress={() => handleEditAssessment(item)}
                        >
                            <Ionicons name="pencil" size={20} color="#3B82F6" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[localStyles.actionBtn, {marginLeft: 8 }]}
                            onPress={() => triggerArchiveAssessment(item._id || item.id)}
                        >
                            <Ionicons name="archive" size={20} color="#ff8800" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                )}
            </TouchableOpacity>
        );
    };

    const renderModelItem = ({ item }) => {
        const isBookmarked = bookmarks?.models?.includes(item._id || item.id);
        const rawPath = item.fileUrl || item.modelUrl || item.file || item.url;
        const finalUrl = toAbsUrl(rawPath);
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
            <style>
                body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; background-color: #f1f5f9; overflow: hidden; }
                model-viewer { width: 100%; height: 100%; outline: none; }
                
                .loader-container {
                    width: 100%; height: 100%; display: flex; flex-direction: column; 
                    justify-content: center; align-items: center; 
                    background-color: #e2e8f0; position: absolute; top: 0; left: 0;
                    transition: opacity 0.3s ease;
                }
                .progress-bar-bg {
                    width: 60%; height: 6px; background-color: rgba(0,0,0,0.1); 
                    border-radius: 4px; margin-top: 8px; overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%; width: 0%; background-color: #153c2a; 
                    transition: width 0.1s linear;
                }
                .progress-text {
                    font-family: sans-serif; font-size: 11px; font-weight: 700; color: #153c2a;
                }
                .hidden { opacity: 0; pointer-events: none; }
            </style>
            </head>
            <body>
            <model-viewer id="model" src="${finalUrl}" auto-rotate camera-controls interaction-prompt="none" shadow-intensity="1">
                <div slot="progress-bar" id="loader" class="loader-container">
                    <div class="progress-text" id="perc">0%</div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" id="fill"></div>
                    </div>
                </div>
            </model-viewer>
            <script>
                const model = document.querySelector('#model');
                const perc = document.querySelector('#perc');
                const fill = document.querySelector('#fill');
                const loader = document.querySelector('#loader');

                model.addEventListener('progress', (event) => {
                    const val = Math.round(event.detail.totalProgress * 100);
                    perc.innerText = val + '%';
                    fill.style.width = val + '%';
                    if (val >= 100) {
                        setTimeout(() => loader.classList.add('hidden'), 200);
                    }
                });
            </script>
            </body>
            </html>
        `;

        return (
            <View style={[localStyles.modelCard, { backgroundColor: theme?.card || '#FFF' }]}>
                {/* 3D Model Thumbnail View with Progress Bar */}
                <View style={localStyles.modelThumb}>
                    {rawPath ? (
                        <WebView
                            originWhitelist={['*']}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            source={{ html: htmlContent }}
                            style={{ flex: 1, backgroundColor: 'transparent' }}
                            scrollEnabled={false}
                        />
                    ) : (
                        <View style={localStyles.thumbPlaceholder}>
                            <Ionicons name="cube-outline" size={40} color="#94a3b8" />
                        </View>
                    )}
                    <View style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                </View>
               
                {/* Card Information displaying the exact backend description */}
                <View style={localStyles.modelCardInfo}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[localStyles.modelTitle, { color: theme?.text || '#1E293B' }]} numberOfLines={1}>
                            {item.name || item.title || '3D Model'}
                        </Text>
                        <Text style={localStyles.modelSub} numberOfLines={2}>
                            {item.description || 'No description provided.'}
                        </Text>
                    </View>
                    
                    {/* Explicit View 3D Model Button */}
                    <TouchableOpacity 
                        style={localStyles.viewButton} 
                        onPress={() => navigation.navigate('ModelViewerMobile', { modelId: item._id || item.id })}
                    >
                        <Text style={localStyles.viewButtonText}>View 3D Model</Text>
                        
                    </TouchableOpacity>
                </View>

                {/* Bookmark Button */}
                <TouchableOpacity style={localStyles.bookmarkFloat} onPress={() => handleToggleBookmark(item._id || item.id, 'models')}>
                    <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={18} color={isBookmarked ? "#153c2a" : "#94A3B8"} />
                </TouchableOpacity>
            </View>
        );
    };

    const isInstructorUser = String(user?.role).toLowerCase() === 'instructor';
    const tabs = isInstructorUser 
        ? ['Lessons', '3D Models', 'Assessments'] 
        : ['Lessons', 'Remedial Lessons', '3D Models'];

    return (
        <View style={[localStyles.container, { backgroundColor: theme?.background || '#F8FAFC' }]}>
            <StatusBar barStyle="light-content" />
            <View style={[localStyles.headerArea, { backgroundColor: '#153c2a' }]}>
                <View style={[localStyles.headerTopRow, {alignItems: 'center', justifyContent: 'center'}]}>
                    <Text style={[localStyles.headerTitle, { color: '#FFF' || theme?.text }]}>Learning Materials</Text>
                </View>
                
                <View style={localStyles.searchContainer}>
                    <Ionicons name="search" size={20} color="#94A3B8" style={localStyles.searchIcon} />
                    <TextInput
                        style={[localStyles.searchInput, { color: theme?.text || '#000' }]}
                        placeholder={`Search ${activeTab.toLowerCase()}...`}
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <View style={[localStyles.tabContainer, { backgroundColor: '#F1F5F9', marginTop: 15, marginHorizontal: 20 }]}>
                {tabs.map(tab => (
                    <TouchableOpacity 
                        key={tab} 
                        style={[localStyles.tabButton, activeTab === tab && localStyles.activeTabButton]}
                        onPress={() => { setActiveTab(tab); setSearchQuery(''); }}
                    >
                        <Text style={[localStyles.tabText, activeTab === tab && localStyles.activeTabText]} numberOfLines={1}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={localStyles.centerContent}>
                    <ActivityIndicator size="large" color="#153c2a" />
                </View>
            ) : activeTab === 'Assessments' ? (
                /* --- NEW SECTION LIST JUST FOR ASSESSMENTS --- */
                assessments.length === 0 ? (
                    <View style={localStyles.centerContent}>
                        <Ionicons name="folder-open-outline" size={60} color="#CBD5E1" />
                        <Text style={[localStyles.emptyText, { color: theme?.subText || '#64748B' }]}>No assessments found.</Text>
                    </View>
                ) : (
                    <SectionList
                        sections={assessments}
                        keyExtractor={(item, index) => item._id ? item._id.toString() : index.toString()}
                        renderItem={renderAssessmentItem}
                        renderSectionHeader={({ section: { title } }) => (
                            <View style={localStyles.dateHeaderContainer}>
                                <Text style={localStyles.dateHeaderText}>{title}</Text>
                            </View>
                        )}
                        contentContainerStyle={localStyles.listContainer}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
                    />
                )
            ) : filteredData.length === 0 ? (
                /* --- EXISTING EMPTY STATE FOR LESSONS/MODELS --- */
                <View style={localStyles.centerContent}>
                    <Ionicons name="folder-open-outline" size={60} color="#CBD5E1" />
                    <Text style={[localStyles.emptyText, { color: theme?.subText || '#64748B' }]}>No {activeTab.toLowerCase()} found.</Text>
                </View>
            ) : (
                /* --- EXISTING FLATLIST FOR LESSONS/MODELS --- */
                <FlatList
                    data={filteredData}
                    keyExtractor={item => String(item._id || item.id || Math.random())}
                    contentContainerStyle={localStyles.listContainer}
                    showsVerticalScrollIndicator={false}
                    renderItem={
                        activeTab === 'Lessons' || activeTab === 'Remedial Lessons' ? renderLessonItem :
                        renderModelItem
                    }
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
                />
            )}

{/* Instructor Menu Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showInstructorMenu}
                onRequestClose={() => setShowInstructorMenu(false)}
            >
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContent}>
                        <Text style={localStyles.modalTitle}>Instructor Menu</Text>

                        {/* ARCHIVES */}
                        <TouchableOpacity style={localStyles.modalOptionBtn} onPress={() => {
                            setShowInstructorMenu(false);
                            navigation.navigate('ArchiveLessons');
                        }}>
                            <Ionicons name="archive" size={24} color="#153c2a" />
                            <Text style={[localStyles.modalOptionText, { marginLeft: 15 }]}>Archives</Text>
                        </TouchableOpacity>

                        {/* Assessment Drafts Menu Button */}
                        <TouchableOpacity
                        style={localStyles.modalOptionBtn}
                        onPress={() => {
                            setShowInstructorMenu(false);
                            navigation.navigate('DraftAssessments');
                        }}>
                            <Ionicons name="document-text" size={24} color="#153c2a" />
                            <Text style={[localStyles.modalOptionText, { marginLeft: 15 }]}>Assessment Drafts</Text>
                        </TouchableOpacity>

                        {/* --- 1. LESSON OPTION --- */}
                        <TouchableOpacity
                            style={localStyles.modalOptionBtn}
                            onPress={() => {
                                setShowInstructorMenu(false);
                                navigation.navigate('UploadLesson');
                            }}
                        >
                            <Ionicons name="book" size={24} color="#153c2a" />
                            <Text style={[localStyles.modalOptionText, { marginLeft: 15 }]}>Upload New Lesson File</Text>
                        </TouchableOpacity>

                        {/* --- 2. ASSESSMENT OPTIONS --- */}
                        <TouchableOpacity
                            style={localStyles.modalOptionBtn}
                            onPress={() => {
                                setShowInstructorMenu(false);
                                navigation.navigate('CreateAssessmentManual');
                            }}
                        >
                            <Ionicons name="create" size={24} color="#153c2a" />
                            <Text style={[localStyles.modalOptionText, { marginLeft: 15 }]}>Create Assessment Manually</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={localStyles.modalOptionBtn}
                            onPress={() => {
                                setShowInstructorMenu(false);
                                navigation.navigate('CreateAssessmentLink'); 
                            }}
                        >
                            <Ionicons name="link" size={24} color="#153c2a" />
                            <Text style={[localStyles.modalOptionText, { marginLeft: 15 }]}>Add Link to Assessment</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={localStyles.modalOptionBtn}
                            onPress={() => {
                                setShowInstructorMenu(false);
                                navigation.navigate('CreateAssessmentAI'); 
                            }}
                        >
                            <Ionicons name="sparkles" size={24} color="#153c2a" />
                            <Text style={[localStyles.modalOptionText, { marginLeft: 15 }]}>Auto Generate Assessment with MyphoAI</Text>
                        </TouchableOpacity>

                        {/* --- CANCEL BUTTON --- */}
                        <TouchableOpacity
                            style={localStyles.modalCloseBtn}
                            onPress={() => setShowInstructorMenu(false)}
                        >
                            <Text style={localStyles.modalCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

{/* Archive Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isArchiveModalVisible}
                onRequestClose={() => setArchiveModalVisible(false)}
            >
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContainer}>
                        <Text style={localStyles.modalTitle}>Archive {itemToArchive?.type === 'lesson' ? 'Lesson' : 'Assessment'}</Text>
                        <Text style={localStyles.modalMessage}>
                            Are you sure you want to move this to your archive list?
                        </Text>
                        
                        <View style={localStyles.modalButtonGroup}>
                            <TouchableOpacity 
                                style={[localStyles.modalBtn, localStyles.cancelBtn]} 
                                onPress={() => setArchiveModalVisible(false)}
                            >
                                <Text style={localStyles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[localStyles.modalBtn, localStyles.confirmArchiveBtn]} 
                                onPress={confirmArchive}
                            >
                                <Text style={localStyles.confirmArchiveBtnText}>Archive</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {isInstructorUser && (
                <TouchableOpacity 
                    style={localStyles.floatingBtn} 
                    onPress={() => setShowInstructorMenu(true)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={30} color="#FFF" />
                </TouchableOpacity>
            )}
        </View>
    );
}

const localStyles = StyleSheet.create({
    container: { flex: 1 },
    headerArea: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 28, fontWeight: '800' },
    headerPlusBtn: { width: 50, height: 50, borderRadius: 30, backgroundColor: '#153c2a', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    floatingBtn: {
    position: 'absolute',
    bottom: 25,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#153c2a',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    },
    tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 16 },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, paddingHorizontal: 4 },
    activeTabButton: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    tabText: { fontSize: 15, fontWeight: '600', color: '#64748B', textAlign: 'center' },
    activeTabText: { color: '#153c2a', fontWeight: '700' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16, height: 48, },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },
    listContainer: { padding: 20, paddingBottom: 100 },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { marginTop: 12, fontSize: 16, fontWeight: '500' },
    
    listItemCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    iconBox: { width: 56, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    itemInfo: { flex: 1 },
    itemTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    itemSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500', marginBottom: 4 },
    itemMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    bookmarkBtn: { padding: 8 },
    instructorActionRow: { flexDirection: 'row', alignItems: 'center' },
    actionIconBtn: { padding: 8, marginLeft: 4 },

    modelCard: { 
        width: '100%', 
        borderRadius: 16, 
        overflow: 'hidden', 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.08, 
        shadowRadius: 8, 
        marginBottom: 16, 
        position: 'relative' 
    },
    modelThumb: { 
        width: '100%', 
        height: 160, 
        backgroundColor: '#F1F5F9', 
        overflow: 'hidden' 
    },
    thumbPlaceholder: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#e2e8f0' 
    },
    modelCardInfo: { 
        padding: 14, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
    },
    modelTitle: { 
        fontSize: 16, 
        fontWeight: '700', 
        marginBottom: 4 
    },
    modelSub: { 
        fontSize: 12, 
        color: '#64748B', 
        fontWeight: '500', 
        lineHeight: 16 
    },
    viewButton: {
        backgroundColor: '#153c2a',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        elevation: 1,
    },
    viewButtonText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    bookmarkFloat: { 
        position: 'absolute', 
        top: 12, 
        right: 12, 
        width: 32, 
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        zIndex: 10
    },
    
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFF',
        width: '90%',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center', 
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#153c2a',
        marginBottom: 20,
    },
    modalOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: '100%',
    },
    modalOptionText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
    },
    modalCloseBtn: {
        marginTop: 15,
        paddingVertical: 10,
        width: '100%',
        alignItems: 'center',
    },
    modalCloseText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748B',
    },
        modalMessage: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 22,
    },
    modalContainer: {
        backgroundColor: '#FFF',
        width: '90%',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    modalButtonGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    modalOptionBtn: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 15, 
        backgroundColor: '#F8FAFC', 
        borderRadius: 12, 
        marginBottom: 10, 
        borderWidth: 1, 
        borderColor: '#E2E8F0' 
    },
    cancelBtn: {
        backgroundColor: '#F1F5F9',
    },
    cancelBtnText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 15,
    },
    confirmArchiveBtn: {
        backgroundColor: '#153c2a',
    },
    confirmArchiveBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 10,
    },
    actionBtn: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateHeaderContainer: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    dateHeaderText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#153c2a',
    },
    assessmentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF', 
        padding: 16,
        borderRadius: 10,
        marginBottom: 12,
        marginHorizontal: 2,
        elevation: 3, 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardTextContent: {
        flex: 1,
        paddingRight: 10,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 4,
    },
    cardMeta: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
});