import React, { useState, useEffect, useContext, useRef } from 'react';
import {  View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator,  StyleSheet, Platform, StatusBar, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import Toast from 'react-native-toast-message';
import { captureRef } from 'react-native-view-shot';

import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = (width - 40 - (COLUMN_COUNT - 1) * 10) / COLUMN_COUNT;

export default function DatasetLibrary({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [scans, setScans] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // ViewShot & Modal State
    const [selectedImage, setSelectedImage] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const captureViewRef = useRef();

    useEffect(() => {
        fetchDataset();
    }, []);

    const fetchDataset = async () => {
        try {
            const res = await api.get('/datasets'); 
            setScans(res.data?.data || []);
        } catch (err) {
            toastError("Failed to load dataset.");
        } finally {
            setLoading(false);
        }
    };

    const downloadScanWithMetadata = async () => {
        try {
            setIsDownloading(true);

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                toastError('Gallery permission is required to save images.');
                return;
            }

            // Captures the exact Report Card layout
            const uri = await captureRef(captureViewRef, {
                format: 'jpg',
                quality: 1,
            });
            
            await MediaLibrary.saveToLibraryAsync(uri);
            toastSuccess("Dataset image saved to gallery!");
        } catch (err) {
            console.error(err);
            toastError('Failed to download image.');
        } finally {
            setIsDownloading(false);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={localStyles.gridItem} 
            onPress={() => setSelectedImage(item)}
            activeOpacity={0.8}
        >
            <Image source={{ uri: toAbsUrl(item.imageUrl) }} style={localStyles.gridImage} />
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar barStyle="light-content" />

        <View style={localStyles.header}>
            <View style={localStyles.headerTopRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                    <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={localStyles.headerTextContainer}>
                    <Text style={localStyles.headerTitle}>Dataset Library</Text>
                    <Text style={localStyles.headerSubtitle}>View and download classified AI scan data</Text>
                </View>
            </View>
        </View>

        {loading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#153c2a" /></View>
        ) : (
            <FlatList
                data={scans}
                keyExtractor={(item) => item._id || item.id}
                renderItem={renderItem}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Ionicons name="images-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
                        <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>No dataset images found</Text>
                    </View>
                }
            />
        )}

        {/* White Report Card Modal for Exporting */}
        <Modal visible={!!selectedImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedImage(null)}>
            <View style={localStyles.fsModalBackground}>
                <View style={localStyles.fsModalHeader}>
                    <TouchableOpacity onPress={() => setSelectedImage(null)} style={localStyles.fsIconButton}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={downloadScanWithMetadata} 
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

                {selectedImage && (
                    <View ref={captureViewRef} collapsable={false} style={localStyles.exportCard}>
                        <View style={localStyles.exportBrandRow}>
                            <Text style={localStyles.exportBrandText}>MyphoAI Dataset Log</Text>
                        </View>
                        <Image 
                            source={{ uri: toAbsUrl(selectedImage.imageUrl) }} 
                            style={localStyles.exportImage} 
                        />
                        <View style={localStyles.exportData}>
                            <Text style={localStyles.exportTitle}>{selectedImage.classification || 'Unknown'}</Text>
                            <Text style={localStyles.exportScore}>{Number(selectedImage.confidence).toFixed(1)}% Confidence Match</Text>
                            <Text style={localStyles.exportDate}>Logged on {new Date(selectedImage.createdAt).toLocaleString()}</Text>
                        </View>
                    </View>
                )}
                <Toast />
            </View>
        </Modal>

        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { 
        backgroundColor: '#153c2a',
        paddingHorizontal: 20, 
        paddingTop: Platform.OS === 'ios' ? 60 : 40, 
        paddingBottom: 25, 
        borderBottomLeftRadius: 10, 
        borderBottomRightRadius: 10
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    backBtn: { position: 'absolute', left: 0, zIndex: 10 },
    headerTextContainer: { alignItems: 'center', paddingHorizontal: 40 },
    headerTitle: { fontSize: 25, fontWeight: '900', color: '#fff', textAlign: 'center' },
    headerSubtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2, textAlign: 'center' },
    
    gridItem: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0' },
    gridImage: { width: '100%', height: '100%', resizeMode: 'cover' },

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
    exportTitle: { fontSize: 25, fontWeight: '900', color: '#153c2a', marginBottom: 6 },
    exportScore: { fontSize: 15, fontWeight: '800', color: '#10B981', marginBottom: 6 },
    exportDate: { fontSize: 13, fontWeight: '600', color: '#64748B' }
});