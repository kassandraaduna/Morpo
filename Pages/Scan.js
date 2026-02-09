import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';

const AI_URL = 'http://192.168.1.24:8001/predict';

export default function Scan() {
  const cameraRef = useRef(null);

  const [flash, setFlash] = useState('off');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState({
    label: 'Yeast',
    confidence: 0.95,
    description:
      'Yeasts are unicellular fungi that reproduce asexually through budding.',
  });

  /* ================= PERMISSIONS ================= */
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const classifyImage = async (uri) => {
    try {
      setLoading(true);
      setResult(null);

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'scan.jpg',
        type: 'image/jpeg',
      });

      const res = await fetch(AI_URL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data = await res.json();

      setResult({
        label: data.classification,
        confidence: data.confidence / 100,
        description:
          data.classification === 'Yeast'
            ? 'Yeasts are unicellular fungi that reproduce by budding.'
            : 'Molds are multicellular fungi characterized by filamentous hyphae.',
      });

    } catch (err) {
      console.log('[AI ERROR]', err.message);
      setResult({
        label: 'Unknown',
        confidence: 0,
        description: 'Unable to classify the image. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      setLoading(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      setImageUri(photo.uri);
      await classifyImage(photo.uri);

    } catch (e) {
      console.log(e);
    }
  };

  const pickImage = async () => {
    try {
      setLoading(true);

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!res.canceled) {
        const uri = res.assets[0].uri;
        setImageUri(uri);
        await classifyImage(uri);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const retake = () => {
    setImageUri(null);
    setResult(null);
    setLoading(false);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera permission required</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI IMAGE CLASSIFIER</Text>
      </View>

      <Text style={styles.subHeader}>
        CAPTURE OR UPLOAD AN IMAGE OF A FUNGI
      </Text>

      <View style={styles.cameraWrapper}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#22d139" />
            <Text style={styles.loadingText}>Analyzing image…</Text>
          </View>
        )}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            flash={flash}
          />
        )}

        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </View>

      <View style={styles.controls}>
        {imageUri ? (
          <TouchableOpacity onPress={retake}>
            <Ionicons name="refresh" size={26} color="#f43f5e" />
            <Text style={{ fontSize: 11, textAlign: 'center' }}>Retake</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={pickImage}>
              <Ionicons name="image-outline" size={26} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} />

            <TouchableOpacity
              onPress={() => setFlash(prev => (prev === 'off' ? 'on' : 'off'))}
            >
              <Ionicons
                name={flash === 'on' ? 'flash' : 'flash-off'}
                size={24}
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 CAPTURING TIPS</Text>
        <Text style={styles.tip}>✓ Ensure good lighting</Text>
        <Text style={styles.tip}>✓ Hold device steady</Text>
      </View>

      {result?.label && (
        <View style={styles.resultCard}>
          <View style={{ flexDirection: 'row' }}>
            <Image
              source={{ uri: imageUri }}
              style={styles.resultImage}
            />

            <View style={{ flex: 1 }}>
              <Text style={styles.resultLabel}>
                {(result.label || 'UNKNOWN').toUpperCase()}
              </Text>
              <Text style={styles.confidence}>
                Confidence Score:{' '}
                <Text style={{ color: '#e11d48' }}>
                  {Math.round(result.confidence * 100)}%
                </Text>
              </Text>
            </View>
          </View>

          <Text style={styles.description}>
            {result.description}
          </Text>

          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.outlineBtn}>
              <Text style={styles.outlineText}>LEARN MORE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn}>
              <Text style={styles.outlineText}>VIEW MODEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const CORNER = 24;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontWeight: '700', fontSize: 14 },

  subHeader: {
    textAlign: 'center',
    color: '#f43f5e',
    fontSize: 11,
    marginVertical: 8,
  },

  cameraWrapper: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  camera: { flex: 1 },
  preview: { flex: 1 },

  cornerTL: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: CORNER,
    height: CORNER,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: CORNER,
    height: CORNER,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 12,
  },
  captureBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f43f5e',
  },

  tipCard: {
    backgroundColor: '#fdecef',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  tipTitle: { fontWeight: '700', marginBottom: 4 },
  tip: { fontSize: 13 },

  resultCard: {
    backgroundColor: '#fdecef',
    padding: 12,
    borderRadius: 12,
    marginBottom: 40,
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  resultLabel: { fontWeight: '700', fontSize: 14 },
  confidence: { fontSize: 12 },

  description: { fontSize: 13, marginVertical: 8 },

  resultActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#f43f5e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  outlineText: {
    fontSize: 11,
    color: '#f43f5e',
    fontWeight: '600',
  },
  loadingOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(255,255,255,0.8)',
  justifyContent: 'center',
  alignItems: 'center',
},
loadingText: {
  marginTop: 10,
  fontSize: 13,
  color: '#444',
},
});
