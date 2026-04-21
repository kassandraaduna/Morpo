import React, { useContext, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Platform, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';

const SERVER_URL = 'http://192.168.1.24:8000';

export default function ModelViewerMobile({ route, navigation }) {
    const { modelId, modelTitle, modelUrl, labels } = route.params;
    const { theme } = useContext(ThemeContext);
    
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        StatusBar.setHidden(true, 'fade');
        return () => StatusBar.setHidden(false, 'fade');
    }, []);

    useEffect(() => {
        const checkBookmark = async () => {
            if (!modelId) return;
            const stored = await AsyncStorage.getItem('studentBookmarks_v1');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.models?.includes(modelId)) setIsBookmarked(true);
            }
        };
        checkBookmark();
    }, [modelId]);

    const toggleBookmark = async () => {
        if (!modelId) return;
        const stored = await AsyncStorage.getItem('studentBookmarks_v1');
        let parsed = stored ? JSON.parse(stored) : { lessons: [], models: [] };
        if (!parsed.models) parsed.models = [];
        
        if (parsed.models.includes(modelId)) {
            parsed.models = parsed.models.filter(id => id !== modelId);
            setIsBookmarked(false);
        } else {
            parsed.models.push(modelId);
            setIsBookmarked(true);
        }
        await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(parsed));
    };

    const getCleanUrl = (path) => {
        if (!path) return '';
        let clean = path.trim();
        if (clean.startsWith('http')) return clean;
        const base = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
        return `${base}${clean.startsWith('/') ? clean : '/' + clean}`;
    };

    const finalUrl = getCleanUrl(modelUrl);
    const bgColor = isDarkMode ? '#000000' : '#f0f4f2';

    const hotspotHtml = labels?.map((lbl, index) => `
        <button class="hotspot" slot="hotspot-${index}" data-position="${lbl.position}" data-normal="${lbl.normal}">
        <div class="annotation">${lbl.name}</div>
        </button>
    `).join('') || '';

    // The HTML is re-injected dynamically if isDarkMode changes
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
        <style>
            body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; background-color: ${bgColor}; overflow: hidden; transition: background-color 0.3s; }
            model-viewer { width: 100%; height: 100%; --poster-color: transparent; outline: none; }
            
            .hotspot {
            background: #153c2a;
            border-radius: 4px;
            border: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.25);
            color: #fff;
            display: block;
            font-family: sans-serif;
            font-size: 12px;
            font-weight: 700;
            max-width: 120px;
            overflow-wrap: break-word;
            padding: 0.5em 1em;
            position: absolute;
            width: max-content;
            transform: translate(-50%, -50%);
            }

            .annotation {
            background: #153c2a;
            color: white;
            padding: 4px 8px;
            border-radius: 5px;
            }

            .hidden { display: none; }
        </style>
        </head>
        <body>
        <model-viewer 
            src="${finalUrl}" 
            camera-controls 
            auto-rotate 
            shadow-intensity="1" 
            ar
            touch-action="pan-y"
        >
            ${hotspotHtml}
        </model-viewer>
        </body>
        </html>
    `;

    return (
        <View style={localStyles.container}>
            <WebView
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                style={[localStyles.webview, { backgroundColor: bgColor }]}
                scrollEnabled={false}
                startInLoadingState={true}
                renderLoading={() => (
                <View style={[localStyles.loader, { backgroundColor: bgColor }]}>
                    <ActivityIndicator size="large" color={isDarkMode ? "#fff" : "#153c2a"} />
                </View>
                )}
            />

            {/* Back Button */}
            <TouchableOpacity 
                style={localStyles.closeButton} 
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>

            {/* Background Color Toggle */}
            <TouchableOpacity 
                style={localStyles.bgToggleButton} 
                onPress={() => setIsDarkMode(!isDarkMode)}
            >
                <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="#fff" />
            </TouchableOpacity>

            {/* Bookmark Button */}
            {modelId && (
                <TouchableOpacity 
                    style={localStyles.bookmarkButton} 
                    onPress={toggleBookmark}
                >
                    <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color="#fff" />
                </TouchableOpacity>
            )}
            
            {/* Title Overlay */}
            <View style={localStyles.titleOverlay}>
                <Text style={localStyles.titleText}>{modelTitle}</Text>
            </View>
        </View>
    );
}

const localStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    webview: { flex: 1 },
    loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    
    closeButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 100,
    },
    bgToggleButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 74,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 100,
    },
    bookmarkButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 128,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 100,
    },
    titleOverlay: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    titleText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        textAlign: 'center',
    }
});