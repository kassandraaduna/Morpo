import React, { useContext, useEffect } from 'react';
import { 
    View, 
    TouchableOpacity, 
    StyleSheet, 
    ActivityIndicator, 
    StatusBar, 
    Platform 
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeContext } from './src/context/ThemeContext';

const SERVER_URL = 'http://192.168.1.24:8000';

export default function ModelViewerMobile({ route, navigation }) {
    const { modelTitle, modelUrl, labels } = route.params;
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        StatusBar.setHidden(true, 'fade');
        return () => StatusBar.setHidden(false, 'fade');
    }, []);

    const getCleanUrl = (path) => {
        if (!path) return '';
        let clean = path.trim();
        if (clean.startsWith('http')) return clean;
        const base = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
        return `${base}${clean.startsWith('/') ? clean : '/' + clean}`;
    };

    const finalUrl = getCleanUrl(modelUrl);

    const hotspotHtml = labels?.map((lbl, index) => `
        <button class="hotspot" slot="hotspot-${index}" data-position="${lbl.position}" data-normal="${lbl.normal}">
        <div class="annotation">${lbl.name}</div>
        </button>
    `).join('') || '';

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
        <style>
            body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; background-color: #000; overflow: hidden; }
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
            style={localStyles.webview}
            scrollEnabled={false}
            startInLoadingState={true}
            renderLoading={() => (
            <View style={localStyles.loader}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
            )}
        />

        <TouchableOpacity 
            style={localStyles.closeButton} 
            onPress={() => navigation.goBack()}
        >
            <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        </View>
    );
    }

    const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 100,
    }
});