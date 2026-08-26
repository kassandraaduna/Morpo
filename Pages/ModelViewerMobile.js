import React, { useContext, useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Platform, Text, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';
import api, { toAbsUrl } from './src/services/api';

export default function ModelViewerMobile({ route, navigation }) {
    const { modelId, model, url, title } = route.params || {};
    const [modelData, setModelData] = useState(model || null);
    const [modelUrl, setModelUrl] = useState(url || null);
    const [currentUser, setCurrentUser] = useState(null);
    
    // Safely pull labels from modelData or route.params
    const labels = route.params?.labels || modelData?.labels || [];
    
    const { theme } = useContext(ThemeContext);
    const webviewRef = useRef(null);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [labelsVisible, setLabelsVisible] = useState(true);
    const [selectedLabel, setSelectedLabel] = useState(null);

    useEffect(() => {
        StatusBar.setHidden(true, 'fade');
        return () => StatusBar.setHidden(false, 'fade');
    }, []);

    useEffect(() => {
        const checkBookmark = async () => {
            if (!modelId) return;

            const uRaw = await AsyncStorage.getItem('user');
            const u = uRaw ? JSON.parse(uRaw) : null;
            if (u) setCurrentUser(u);
            if (!u) return;

            const stored = await AsyncStorage.getItem(`bookmarks_${u._id}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.models?.includes(modelId)) setIsBookmarked(true);
            }
        };
        checkBookmark();
    }, [modelId]);

    useEffect(() => {
        const fetchModelDetails = async () => {
            if (!modelData && modelId) {
                try {
                    const res = await api.get(`/models3d`);
                    const list = res.data?.data || res.data || [];
                    const fetchedModel = list.find(m => String(m._id) === String(modelId) || String(m.id) === String(modelId));
                    if (fetchedModel) {
                        setModelData(fetchedModel);
                    }
                } catch (error) {
                    console.error("Failed to fetch model details:", error);
                }
            }
        };
        fetchModelDetails();
    }, [modelId, modelData]);

    useEffect(() => {
        if (modelData) {
            const rawPath = url || modelData.fileUrl || modelData.modelUrl || modelData.file || modelData.url;
            if (rawPath) {
                const absoluteUrl = toAbsUrl(rawPath);
                setModelUrl(absoluteUrl);
            }
        }
    }, [modelData, url]);

    const toggleBookmark = async () => {
        if (!modelId || !currentUser) return;
        
        const bookmarkKey = `bookmarks_${currentUser._id}`;
        const stored = await AsyncStorage.getItem(bookmarkKey);
        let parsed = stored ? JSON.parse(stored) : { lessons: [], models: [], scans: [] };
        
        if (!parsed.models) parsed.models = [];
        
        if (parsed.models.includes(modelId)) {
            parsed.models = parsed.models.filter(id => id !== modelId);
            setIsBookmarked(false);
        } else {
            parsed.models.push(modelId);
            setIsBookmarked(true);
        }
        await AsyncStorage.setItem(bookmarkKey, JSON.stringify(parsed));
    };

    const toggleLabels = () => {
        const nextState = !labelsVisible;
        setLabelsVisible(nextState);
        webviewRef.current?.postMessage(JSON.stringify({ type: 'toggle_labels', show: nextState }));

        if (!nextState) setSelectedLabel(null);
    };

    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'hotspot_click' && labels) {
                const clickedLabel = labels[parseInt(data.index)];
                setSelectedLabel(clickedLabel);
            }
        } catch (error) {
            console.log("Error parsing webview message", error);
        }
    };

    const finalUrl = toAbsUrl(modelUrl);
    const bgColor = isDarkMode ? '#000000' : '#f0f4f2';
    const textColor = isDarkMode ? '#ffffff' : '#153c2a';
    const barBgColor = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
    const barFillColor = isDarkMode ? '#ffffff' : '#153c2a';

    const hotspotHtml = labels?.map((lbl, index) => `
        <button class="hotspot ${!labelsVisible ? 'hidden' : ''}" slot="hotspot-${index}" data-position="${lbl.position}" data-normal="${lbl.normal}" data-index="${index}">
            <div class="annotation">${lbl.name}</div>
        </button>
    `).join('') || '';

    // Advanced Loading Progress Bar Injection
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
                cursor: pointer;
            }
            .annotation {
                background: #153c2a;
                color: white;
                padding: 4px 8px;
                border-radius: 5px;
            }

            /* Custom Progress Bar Styling */
            .loader-container {
                width: 100%; height: 100%; display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                background-color: ${bgColor}; position: absolute; top: 0; left: 0;
                transition: opacity 0.3s ease;
                z-index: 10;
            }
            .progress-bar-bg {
                width: 70%; height: 8px; background-color: ${barBgColor}; 
                border-radius: 4px; margin-top: 12px; overflow: hidden;
            }
            .progress-bar-fill {
                height: 100%; width: 0%; background-color: ${barFillColor}; 
                transition: width 0.1s linear;
            }
            .progress-text {
                font-family: sans-serif; font-size: 16px; font-weight: 700; color: ${textColor};
            }
            .hidden { opacity: 0; pointer-events: none; }
        </style>
        </head>
        <body>
        <model-viewer 
            id="model"
            src="${finalUrl}" 
            camera-controls 
            auto-rotate 
            shadow-intensity="1" 
            touch-action="pan-y"
        >
            <div slot="progress-bar" id="loader" class="loader-container">
                <div class="progress-text" id="perc">Loading 0%</div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="fill"></div>
                </div>
            </div>
            ${hotspotHtml}
        </model-viewer>

        <script>
            const model = document.querySelector('#model');
            const perc = document.querySelector('#perc');
            const fill = document.querySelector('#fill');
            const loader = document.querySelector('#loader');

            model.addEventListener('progress', (event) => {
                const val = Math.round(event.detail.totalProgress * 100);
                perc.innerText = 'Loading ' + val + '%';
                fill.style.width = val + '%';
                if (val >= 100) {
                    setTimeout(() => loader.classList.add('hidden'), 250);
                }
            });

            document.querySelectorAll('.hotspot').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = btn.getAttribute('data-index');
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hotspot_click', index }));
                });
            });
            window.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'toggle_labels') {
                        const hotspots = document.querySelectorAll('.hotspot');
                        hotspots.forEach(h => {
                            if(data.show) h.classList.remove('hidden');
                            else h.classList.add('hidden');
                        });
                    }
                } catch(e) {}
            });
        </script>
        </body>
        </html>
    `;

    return (
        <View style={localStyles.container}>
            <WebView
                ref={webviewRef}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                source={{ html: htmlContent }}
                style={[localStyles.webview, { backgroundColor: bgColor }]}
                scrollEnabled={false}
            />

            <View style={localStyles.topActionRow}>
                {labels && labels.length > 0 && (
                    <TouchableOpacity style={localStyles.actionButton} onPress={toggleLabels}>
                        <Ionicons name={labelsVisible ? "eye" : "eye-off"} size={22} color="#fff" />
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={localStyles.actionButton} onPress={() => setIsDarkMode(!isDarkMode)}>
                    <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="#fff" />
                </TouchableOpacity>
                {modelId && (
                    <TouchableOpacity style={localStyles.actionButton} onPress={toggleBookmark}>
                        <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color="#fff" />
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={localStyles.actionButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            {selectedLabel && (
                <View style={localStyles.popupContainer}>
                    <View style={localStyles.popupHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="information-circle" size={20} color="#153c2a" style={{ marginRight: 8 }} />
                            <Text style={localStyles.popupTitle}>{selectedLabel.name}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedLabel(null)}>
                            <Ionicons name="close-circle" size={24} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={localStyles.popupScroll} contentContainerStyle={{ paddingBottom: 10 }}>
                        <Text style={localStyles.popupDesc}>
                            {selectedLabel.description || 'No description available for this part.'}
                        </Text>
                    </ScrollView>
                </View>
            )}

            {!selectedLabel && (title || modelData?.title || modelData?.name) && (
                <View style={localStyles.titleOverlay}>
                    <Text style={localStyles.titleText}>{title || modelData?.title || modelData?.name}</Text>
                    {modelData?.description && (
                         <Text style={localStyles.descText}>{modelData.description}</Text>
                    )}
                </View>
            )}
        </View>
    );
}

const localStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    webview: { flex: 1 },
    
    topActionRow: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 20,
        flexDirection: 'row',
        gap: 10,
        zIndex: 100,
    },
    actionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },

    popupContainer: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        maxHeight: 250,
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 15,
        zIndex: 200,
    },
    popupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
    },
    popupTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#153c2a',
    },
    popupScroll: {
        marginTop: 5,
    },
    popupDesc: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 22,
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
    },
    descText: {
        color: '#e2e8f0',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 4,
    }
});