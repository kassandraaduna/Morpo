import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, StyleSheet, Platform, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');

const getInitials = (name) => {
  if (!name) return 'S';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const getAvatarUri = (url, u) => {
  if (!url) return null;
  if (url.startsWith('data:image') || url.startsWith('file:')) return url;
  return `${toAbsUrl(url)}?v=${u?.updatedAt || '1'}`;
};

const extractArray = (resData) => {
    if (!resData) return [];
    if (Array.isArray(resData)) return resData;
    if (typeof resData === 'object') {
        if (Array.isArray(resData.data) && resData.data.length > 0) return resData.data;
        if (resData.data?.data && Array.isArray(resData.data.data)) return resData.data.data;
        for (const key in resData) {
            if (Array.isArray(resData[key]) && resData[key].length > 0) return resData[key];
        }
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

export default function StudentHomepage({ navigation }) {
  const [user, setUser] = useState(null);
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [latestQuiz, setLatestQuiz] = useState(null);
  const [suggestedLessons, setSuggestedLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState({ lessons: [], models: [], scans: [] });
  const [usersMap, setUsersMap] = useState({});
  const { theme } = useContext(ThemeContext);
  const printRef = useRef();

  const loadDashboardData = async () => { 
        try { 
            setLoading(true);
            const rawUser = await AsyncStorage.getItem('user'); 
            if (!rawUser) {
                setLoading(false);
                return;
            }
            
            let currentUser = JSON.parse(rawUser); 
            setUser(currentUser);

            try {
                const userRes = await api.get(`/meds/${currentUser._id}`).catch(() => api.get(`/admin/users/${currentUser._id}`));
                const updatedUser = userRes.data?.data || userRes.data;
                if (updatedUser) {
                    currentUser = updatedUser;
                    setUser(currentUser);
                    await AsyncStorage.setItem('user', JSON.stringify(currentUser));
                }
            } catch (err) {
                console.log("Failed to sync latest user data:", err);
            }
            
            // THE FIX: Fetch explicit attempt logs using the CORRECT backend endpoint: `/student/:studentId/assessment-history`[cite: 11]
            const [usersRes, syRes, lessonsRes, remedialRes, scansRes, assessmentsRes, historyRes, bookmarksRaw, recentLessonsRaw] = await Promise.all([
                api.get('/admin/users').catch(() => api.get('/getMed').catch(() => ({ data: [] }))),
                api.get('/admin/academic-settings/school-years').catch(() => ({ data: {} })),
                api.get('/lessons').catch(() => ({ data: [] })),
                api.get(`/ai/personalized-lessons/${currentUser._id}`).catch(() => ({ data: [] })),
                api.get(`/scan/history/${currentUser._id}`).catch(() => ({ data: [] })),
                api.get(`/assessments?studentId=${currentUser._id}&_t=${Date.now()}`).catch(() => ({ data: [] })),
                api.get(`/student/${currentUser._id}/assessment-history?_t=${Date.now()}`).catch(() => ({ data: [] })),
                AsyncStorage.getItem('studentBookmarks_v1').catch(() => null),
                AsyncStorage.getItem(`recent_lessons_${currentUser._id}`).catch(() => null)
            ]);

            if (bookmarksRaw) setBookmarks(JSON.parse(bookmarksRaw));

            const allUsers = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.data || []);
            const uMap = {};
            allUsers.forEach(u => {
                if (u._id || u.id) uMap[String(u._id || u.id)] = u;
            });
            setUsersMap(uMap);

            const recentLessonsMap = recentLessonsRaw ? JSON.parse(recentLessonsRaw) : {};

            // THE FIX: Process direct history logs first
            const rawHistory = extractArray(historyRes.data?.history || historyRes.data?.data || historyRes.data);
            
            if (rawHistory.length > 0) {
                rawHistory.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
                const latest = rawHistory[0];
                setLatestQuiz({
                    title: latest.assessment?.title || latest.title || 'Assessment',
                    submittedAt: latest.createdAt || latest.updatedAt || new Date().toISOString(),
                    score: latest.score || 0,
                    total: latest.total || 10,
                    percent: latest.percent || 0,
                    feedback: latest.feedback || (latest.percent >= 70 ? 'Passed' : 'Needs Review')
                });
            } else {
                // Fallback Logic
                const allAssessments = extractArray(assessmentsRes.data);
                const completedAssessments = allAssessments.filter(a => a.latestAttempt && a.latestAttempt.score !== undefined);
                
                completedAssessments.sort((a, b) => {
                    const timeA = new Date(a.latestAttempt.createdAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.latestAttempt.createdAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                });

                if (completedAssessments.length > 0) {
                    const latest = completedAssessments[0];
                    setLatestQuiz({
                        title: latest.title || 'Assessment',
                        submittedAt: latest.latestAttempt.createdAt || latest.updatedAt || new Date().toISOString(),
                        score: latest.latestAttempt.score || 0,
                        total: latest.latestAttempt.total || latest.questions?.length || 10,
                        percent: latest.latestAttempt.percent || 0,
                        feedback: latest.latestAttempt.feedback || (latest.latestAttempt.percent >= 70 ? 'Passed' : 'Needs Review')
                    });
                } else {
                    setLatestQuiz(null);
                }
            }

            const syContext = syRes.data?.context || {};
            const activeSyId = syContext.activeSchoolYearId;
            const activeTermKey = syContext.activeTermKey;

            const assignedInstructorIds = allUsers.filter(u => {
                if (String(u.role).toLowerCase() !== 'instructor') return false;
                const assignments = Array.isArray(u.instructorAssignments) ? u.instructorAssignments : [];
                return assignments.some(a => 
                    String(a.schoolYearId) === String(activeSyId) &&
                    (a.termKey === 'all' || a.termKey === activeTermKey) &&
                    a.yearLevel === currentUser.yearLevel &&
                    a.section === currentUser.section
                );
            }).map(u => String(u._id));

            const rawLessons = extractArray(lessonsRes.data);
            const validLessons = rawLessons.filter(l => {
                if (l.isArchived) return false;
                const creatorId = typeof l.createdBy === 'object' ? l.createdBy?._id : l.createdBy;
                return !creatorId || assignedInstructorIds.length === 0 || assignedInstructorIds.includes(String(creatorId));
            });

            const rawRemedial = extractArray(remedialRes.data);
            const combinedLessons = [
                ...validLessons.map(l => ({ ...l, type: 'normal' })),
                ...rawRemedial.map(l => ({ ...l, type: 'remedial', title: l.title || `Remedial: ${l.topic || 'Lesson'}`, updatedAt: l.createdAt || l.updatedAt }))
            ];

            combinedLessons.forEach(l => {
                l.lastAccessedAt = recentLessonsMap[l._id] || 0;
            });

            combinedLessons.sort((a, b) => {
                if (a.lastAccessedAt > 0 || b.lastAccessedAt > 0) {
                    return b.lastAccessedAt - a.lastAccessedAt;
                }
                const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return dateB - dateA;
            });

            setSuggestedLessons(combinedLessons); 
            setScans(extractArray(scansRes.data));
        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const handleToggleBookmark = async (itemId, type) => {
        try {
            if (type === 'scan') {
                const res = await api.put(`/scan-bookmark/${itemId}`);
                const updated = res.data.data;
                
                setScans(prev => prev.map(s => s._id === itemId ? { ...s, bookmarked: updated.bookmarked } : s));
                
                if (updated.bookmarked) {
                    toastSuccess('Scan saved to Bookmarks');
                } else {
                    toastSuccess('Scan removed from Bookmarks');
                }
                
            } else if (type === 'lesson') {
                let newBookmarks = { ...bookmarks };
                if (!newBookmarks.lessons) newBookmarks.lessons = [];

                if (newBookmarks.lessons.includes(itemId)) {
                    newBookmarks.lessons = newBookmarks.lessons.filter(id => id !== itemId);
                    toastSuccess('Lesson removed from Bookmarks');
                } else {
                    newBookmarks.lessons.push(itemId);
                    toastSuccess('Lesson saved to Bookmarks');
                }
                
                setBookmarks(newBookmarks);
                await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(newBookmarks));
            }
        } catch (error) {
            console.error(`Failed to toggle ${type} bookmark:`, error);
            toastError(`Failed to update ${type} bookmark.`);
        }
    };

  const handleDownload = async () => {
        try {
            setIsDownloading(true);

            const localUri = await captureRef(printRef, {
                format: "jpg",
                quality: 1,
            });
            
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
                await MediaLibrary.saveToLibraryAsync(localUri);
                toastSuccess('Image with metadata saved to gallery!');
            } else {
                toastError('Storage permission is required to save the image.');
            }
        } catch (err) {
            console.error("Download Error:", err);
            toastError('Failed to process and save the image.');
        } finally {
            setIsDownloading(false);
        }
  };

  if (!user || loading) {
    return (
      <View style={[localStyles.centered, { backgroundColor: theme?.bg || '#F8F9FA' }]}>
        <ActivityIndicator size="large" color="#153c2a" />
      </View>
    );
  }

  const fullName = `${user.fname || ''} ${user.lname || ''}`.trim() || 'Student User';
  const recentScansList = scans.slice(0, 5);
  const recentLessonsList = suggestedLessons.slice(0, 5);

  const hasValidAssessment = latestQuiz && latestQuiz.score !== undefined && latestQuiz.score !== null;

  return (
    <View style={[localStyles.container, { backgroundColor: theme?.bg || '#F8F9FA' }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      <View style={localStyles.topHeaderBar}>
        <Text style={[localStyles.headerTitle, { color: '#153c2a' || theme?.text }]}>Home</Text>
        <TouchableOpacity 
          style={localStyles.notificationBell} 
          onPress={() => navigation.navigate('Bookmarks', { initialTab: 'Notifications' })}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications" size={22} color="#153c2a" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={localStyles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={localStyles.welcomeBanner}>
          <View style={localStyles.welcomeTextContainer}>
            <Text style={localStyles.welcomeSubText}>Welcome back,</Text>
            <Text style={localStyles.welcomeUserName} numberOfLines={1}>{fullName}</Text>
          </View>
          <View style={localStyles.welcomeAvatarCircle}>
            {user?.avatar ? (
              <Image source={{ uri: getAvatarUri(user.avatar, user) }} style={localStyles.avatarImage} />
            ) : (
              <Text style={localStyles.avatarInitials}>{getInitials(fullName)}</Text>
            )}
          </View>
        </View>

        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="link" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Quick Links</Text>
        </View>

        <View style={localStyles.quickLinksGrid}>
          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Learn', { initialTab: 'Lessons' })}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="book" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Lessons</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Learn', { initialTab: '3D Models' })}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="cube" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>3D Models</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Assessments')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="clipboard" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Assessments</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Scan')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="scan" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>AI Scanner</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Bookmarks')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="bookmark" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Bookmarks</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('ScanHistory')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="time" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Scan History</Text>
          </TouchableOpacity>
        </View>

        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="scan" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Recent Scans</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.horizontalScrollBox}>
          {recentScansList.length > 0 ? (
              recentScansList.map((scan, index) => {
                  const scanDate = new Date(scan.createdAt);
                  const dateStr = scanDate.toLocaleDateString();
                  const timeStr = scanDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                      <TouchableOpacity 
                          key={scan._id || index} 
                          style={[localStyles.recentScanCard, { backgroundColor: theme?.card || '#FFF' }]}
                          onPress={() => setSelectedScan(scan)}
                      >
                          <Image source={{ uri: toAbsUrl(scan.imageUrl) }} style={localStyles.recentScanThumb} />
                          <View style={localStyles.recentScanInfo}>
                              <Text style={[localStyles.recentScanTitle, { color: theme?.text || '#000' }]} numberOfLines={1}>
                                  {scan.classification || 'Unknown'}
                              </Text>
                              <Text style={localStyles.recentScanSubtitle}>
                                  {Number(scan.confidence || 0).toFixed(1)}% Accuracy Score
                              </Text>
                              <Text style={localStyles.recentScanMeta}>
                                  {dateStr} • {timeStr}
                              </Text>
                          </View>
                          
                          <TouchableOpacity 
                              style={{ padding: 8, justifyContent: 'center' }} 
                              onPress={() => handleToggleBookmark(scan._id, 'scan')}
                          >
                            <Ionicons 
                                name={scan.bookmarked ? "bookmark" : "bookmark-outline"} 
                                size={22} 
                                color={scan.bookmarked ? "#153c2a" : "#64748B"} 
                            />
                          </TouchableOpacity>
                      </TouchableOpacity>
                  );
              })
          ) : (
              <View style={localStyles.emptyCardBox}>
                  <Text style={localStyles.emptyCardTitle}>No Recent Scans</Text>
                  <Text style={localStyles.emptyCardSub}>Your scanning history will appear here.</Text>
              </View>
          )}
        </ScrollView>

        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="bar-chart" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Latest Assessment Score</Text>
        </View>

        {hasValidAssessment ? (
          <View style={[localStyles.assessmentScoreCard, { backgroundColor: theme?.card || '#FFFFFF' }]}>
            <View style={localStyles.assessmentContentLeft}>
              <View style={localStyles.quizBadgeTag}>
                <Text style={localStyles.quizBadgeTagText}>{latestQuiz?.title || 'Quiz'}</Text>
              </View>
              <Text style={localStyles.assessmentSubmittedText}>
                Submitted: {latestQuiz?.submittedAt ? new Date(latestQuiz.submittedAt).toLocaleDateString() : 'N/A'}
              </Text>
              <Text style={[localStyles.assessmentFeedbackText, { color: theme?.text || '#1A1A1A' }]}>
                {latestQuiz?.feedback || 'No feedback'}
              </Text>
            </View>
            <View style={localStyles.assessmentContentRight}>
              <Text style={[localStyles.scoreFractionText, { color: latestQuiz.percent >= 70 ? '#10B981' : '#EF4444' }]}>
                {`${latestQuiz.score} / ${latestQuiz.total || 10}`}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Assessments')}>
                <Text style={localStyles.viewAllLinkText}>View all</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[localStyles.emptyAssessmentCard, { backgroundColor: theme?.card || '#FFFFFF' }]}>
            <Ionicons name="clipboard-outline" size={28} color="#153c2a" style={{ marginBottom: 6 }} />
            <Text style={[localStyles.emptyAssessmentTitle, { color: theme?.text || '#1A1A1A' }]}>No assessment taken yet</Text>
            <TouchableOpacity 
              style={localStyles.takeAssessmentBtn}
              onPress={() => navigation.navigate('Assessments')}
              activeOpacity={0.85}
            >
              <Text style={localStyles.takeAssessmentBtnText}>Take an assessment</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="book" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Recently Opened Lessons</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.horizontalScrollBox}>
          {recentLessonsList.length > 0 ? (
                recentLessonsList.map((lesson, index) => {
                    const isRemedial = lesson.type === 'remedial';
                    const dateStr = new Date(lesson.lastAccessedAt || lesson.updatedAt || lesson.createdAt).toLocaleDateString();
                    const isBookmarked = bookmarks?.lessons?.includes(lesson._id);

                    let modifierName = 'Instructor';
                    if (!isRemedial) {
                        const modId = getUserId(lesson.modifiedBy) || getUserId(lesson.createdBy);
                        const modUser = modId ? usersMap[String(modId)] : null;

                        if (modUser && modUser.fname) {
                            modifierName = `${modUser.fname} ${modUser.lname}`.trim();
                        } else if (typeof lesson.modifiedBy === 'object' && lesson.modifiedBy?.fname) {
                            modifierName = `${lesson.modifiedBy.fname} ${lesson.modifiedBy.lname}`.trim();
                        } else if (typeof lesson.createdBy === 'object' && lesson.createdBy?.fname) {
                            modifierName = `${lesson.createdBy.fname} ${lesson.createdBy.lname}`.trim();
                        }
                    } else {
                        modifierName = 'System';
                    }

                    return (
                        <TouchableOpacity 
                            key={lesson._id || index} 
                            style={[localStyles.lessonItemCard, { backgroundColor: theme?.card || '#FFF' }]}
                            onPress={() => navigation.navigate('LessonStudent', { 
                                lessonId: isRemedial ? null : lesson._id, 
                                personalizedLesson: isRemedial ? lesson : null 
                            })}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={[localStyles.lessonIconSmallBox, { backgroundColor: isRemedial ? '#FEF2F2' : '#F0F9F4', padding: 10 }]}>
                                    <Ionicons name={isRemedial ? "medical" : "book"} size={24} color={isRemedial ? "#EF4444" : "#153c2a"} />
                                </View>
                                
                                <TouchableOpacity 
                                    style={{ padding: 4 }} 
                                    onPress={() => handleToggleBookmark(lesson._id, 'lesson')}
                                >
                                  <Ionicons 
                                      name={isBookmarked ? "bookmark" : "bookmark-outline"} 
                                      size={22} 
                                      color={isBookmarked ? "#153c2a" : "#64748B"} 
                                  />
                                </TouchableOpacity>
                            </View>

                            <Text style={[localStyles.lessonCardTitle, { color: theme?.text || '#000', marginTop: 10 }]} numberOfLines={2}>
                                {lesson.title || 'Untitled Lesson'}
                            </Text>
                            
                            <Text style={localStyles.lessonCardSub}>
                                {isRemedial ? 'Personalized Remedial' : `Modified by ${modifierName}`}
                            </Text>
                            <Text style={[localStyles.lessonCardSub, { fontSize: 11, marginTop: 4 }]}>
                                Last opened: {dateStr}
                            </Text>
                        </TouchableOpacity>
                    );
                })
            ) : (
                <View style={localStyles.emptyCardBox}>
                    <Text style={localStyles.emptyCardTitle}>No Recent Lessons</Text>
                    <Text style={localStyles.emptyCardSub}>Your lesson history will appear here.</Text>
                </View>
          )}
        </ScrollView>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* THE FIX: Replaced generic modal with the official White Report Card UI */}
      <Modal visible={!!selectedScan} transparent={true} animationType="fade" onRequestClose={() => setSelectedScan(null)}>
          <View style={localStyles.fsModalBackground}>
              <View style={localStyles.fsModalHeader}>
                  <TouchableOpacity onPress={() => setSelectedScan(null)} style={localStyles.fsIconButton}>
                      <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                      onPress={handleDownload} 
                      style={localStyles.fsIconButton}
                      disabled={isDownloading}
                  >
                      {isDownloading ? (
                          <ActivityIndicator color="#fff" size="small" />
                      ) : (
                          <Ionicons name="download-outline" size={26} color="#fff" />
                      )}
                  </TouchableOpacity>
              </View>

              {selectedScan && (
                  <View ref={printRef} collapsable={false} style={localStyles.exportCard}>
                      <View style={localStyles.exportBrandRow}>
                          <Text style={localStyles.exportBrandText}>MyphoAI Analysis</Text>
                      </View>
                      <Image 
                          source={{ uri: toAbsUrl(selectedScan.imageUrl) }} 
                          style={localStyles.exportImage} 
                      />
                      <View style={localStyles.exportData}>
                          <Text style={localStyles.exportTitle} numberOfLines={2}>{selectedScan.classification || 'Unknown'}</Text>
                          <Text style={localStyles.exportScore}>{Number(selectedScan.confidence || 0).toFixed(1)}% Confidence Match</Text>
                          <Text style={localStyles.exportDate}>Scanned on {new Date(selectedScan.createdAt).toLocaleString()}</Text>
                      </View>
                  </View>
              )}
          </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 10, backgroundColor: 'transparent' },
  headerTitle: { fontSize: 25, fontWeight: '600', color: '#153c2a' },
  notificationBell: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#EAEFEB', justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 10 },
  welcomeBanner: { backgroundColor: '#153c2a', borderRadius: 10, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  welcomeTextContainer: { flex: 1, paddingRight: 12 },
  welcomeSubText: { fontSize: 23, color: '#ffffff', fontWeight: '400', marginBottom: 4 },
  welcomeUserName: { fontSize: 25, fontWeight: '900', color: '#FFFFFF' },
  welcomeAvatarCircle: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarInitials: { fontSize: 30, fontWeight: '900', color: '#153c2a' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 5 },
  sectionHeaderTitle: { fontSize: 20, fontWeight: '700' },
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  quickLinkCard: { width: (width - 40 - 20) / 3, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
  quickLinkIconBox: { width: 70, height: 70, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLinkText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  horizontalScrollBox: { paddingVertical: 4, marginBottom: 16 },
  recentScanCard: { width: 300, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1, marginBottom: 20 },
  recentScanThumb: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#E2E8F0', marginRight: 12 },
  recentScanInfo: { flex: 1 },
  recentScanTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  recentScanSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  recentScanMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 4 },
  emptyCardBox: { width: width - 40, borderRadius: 10, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', marginBottom: 20 },
  emptyCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  emptyCardSub: { fontSize: 13, color: '#64748B' },
  assessmentScoreCard: { borderRadius: 10, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  emptyAssessmentCard: { borderRadius: 10, padding: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', elevation: 1 },
  emptyAssessmentTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  takeAssessmentBtn: { backgroundColor: '#153c2a', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', elevation: 2 },
  takeAssessmentBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  assessmentContentLeft: { flex: 1, paddingRight: 10 },
  quizBadgeTag: { backgroundColor: '#153c2a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6 },
  quizBadgeTagText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  assessmentSubmittedText: { fontSize: 15, color: '#64748B', marginBottom: 4, fontWeight: '500' },
  assessmentFeedbackText: { fontSize: 13, fontWeight: '600' },
  assessmentContentRight: { alignItems: 'flex-end' },
  scoreFractionText: { fontSize: 25, fontWeight: '900', marginBottom: 2 },
  viewAllLinkText: { fontSize: 13, fontWeight: '800', color: '#153c2a' },
  lessonItemCard: { width: 250, borderRadius: 10, padding: 14, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  lessonIconSmallBox: { borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  lessonCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  lessonCardSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  fsModalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  fsModalHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
  fsIconButton: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 30 },
  
  exportCard: {
      backgroundColor: '#FFFFFF',
      width: '85%',
      borderRadius: 10,
      overflow: 'hidden',
      padding: 20,
      alignItems: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 15,
  },
  exportBrandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 6 },
  exportBrandText: { fontSize: 14, fontWeight: '800', color: '#153c2a', textTransform: 'uppercase', letterSpacing: 0.5 },
  exportImage: {
      width: '100%',
      height: 320,
      borderRadius: 10,
      resizeMode: 'cover',
      backgroundColor: '#F1F5F9',
      marginBottom: 20,
  },
  exportData: {
      width: '100%',
      backgroundColor: '#F8FAFC',
      padding: 15,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      alignItems: 'center',
  },
  exportTitle: { fontSize: 23, fontWeight: '900', color: '#153c2a', marginBottom: 6, textAlign: 'center' },
  exportScore: { fontSize: 15, fontWeight: '800', color: '#10B981', marginBottom: 6 },
  exportDate: { fontSize: 13, fontWeight: '600', color: '#64748B' }
});