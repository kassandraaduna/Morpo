import React, { useState, useEffect, useContext } from 'react';
import {  View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator,  StyleSheet, Platform, StatusBar, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import Toast from 'react-native-toast-message';
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
    const [selectedImage, setSelectedImage] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);

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

    const downloadImage = async (url) => {
        if (!url) return;
        try {
            setIsDownloading(true);

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                toastError('Gallery permission is required to save images.');
                return;
            }

            const cleanUrl = toAbsUrl(url);
            const fileName = `dataset_scan_${Date.now()}.jpg`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;
            
            const { uri } = await FileSystem.downloadAsync(cleanUrl, fileUri);
            
            await MediaLibrary.saveToLibraryAsync(uri);
            
            toastSuccess("Image saved to your gallery!");
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
        >
            <Image source={{ uri: toAbsUrl(item.imageUrl) }} style={localStyles.gridImage} />
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar barStyle="light-content" />

        <View style={localStyles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15, marginTop: 15 }}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <View>
                <Text style={localStyles.headerTitle}>Dataset Library</Text>
                <Text style={localStyles.headerSubtitle}>View and download classified AI scan data</Text>
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

        <Modal visible={!!selectedImage} transparent={true} animationType="fade">
            <View style={localStyles.modalBackground}>
                <View style={localStyles.modalHeader}>
                    <TouchableOpacity onPress={() => setSelectedImage(null)} style={localStyles.iconButton}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={() => downloadImage(selectedImage?.imageUrl)} 
                        style={localStyles.iconButton}
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
                    <Image 
                        source={{ uri: toAbsUrl(selectedImage.imageUrl) }} 
                        style={localStyles.fullscreenImage} 
                        resizeMode="contain"
                    />
                )}

                {selectedImage && (
                    <View style={localStyles.metadataOverlay}>
                        <Text style={localStyles.metaTitle}>{selectedImage.classification || 'Unknown'}</Text>
                        <Text style={localStyles.metaSub}>{Number(selectedImage.confidence).toFixed(1)}% Confidence Score</Text>
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
        paddingBottom: 35, 
        borderBottomLeftRadius: 30, 
        borderBottomRightRadius: 30,
        flexDirection: 'row',
        alignItems: 'center'
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 20, },
    headerSubtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },
    
    gridItem: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0' },
    gridImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    modalBackground: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    modalHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
    iconButton: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 30 },
    fullscreenImage: { width: '100%', height: '80%' },
    
    metadataOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 15, borderRadius: 15 },
    metaTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    metaSub: { color: '#d1fae5', fontSize: 14, marginTop: 4 }
});