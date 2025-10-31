import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ToastAndroid,
} from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, QrCode } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootStackParamList';
import ChefLoading from '../components/common/ChefLoading';

type Props = NativeStackScreenProps<RootStackParamList, 'QRScanner'>;

export default function QRScannerScreen({ navigation, route }: Props) {
  const { mode, onScanSuccess } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned || processing) return;
    
    setScanned(true);
    setProcessing(true);

    try {
      // Extraer tableId del QR (similar a ScanTableQRScreen)
      let tableId: string;

      if (data.includes("thelastdance://table/")) {
        // Si es un deeplink estructurado
        const url = new URL(data);
        tableId = url.pathname.split("/").pop() || "";
      } else {
        // Por ahora, asumimos que el QR contiene directamente el ID de la mesa
        tableId = data.trim();
      }

      if (!tableId) {
        ToastAndroid.show(
          "❌ QR Inválido - No contiene información válida de mesa",
          ToastAndroid.SHORT
        );
        setScanned(false);
        setProcessing(false);
        return;
      }

      await onScanSuccess(tableId);
      navigation.goBack();
    } catch (error) {
      console.error('Error processing QR:', error);
      ToastAndroid.show(
        '❌ Error al procesar el código QR',
        ToastAndroid.SHORT
      );
      setScanned(false);
      setProcessing(false);
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'order_status':
        return 'Escanea el QR de tu mesa';
      case 'confirm_arrival':
        return 'Confirmar llegada a mesa';
      case 'confirm_delivery':
        return 'Confirmar entrega de pedido';
      case 'payment':
        return 'Escanear para pagar';
      default:
        return 'Escanear código QR';
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'order_status':
        return 'Escanea el código QR de TU mesa (debe ser la misma donde estás sentado) para consultar el estado de tus productos';
      case 'confirm_arrival':
        return 'Escanea el código QR de la mesa asignada para confirmar tu llegada';
      case 'confirm_delivery':
        return 'Escanea el código QR para confirmar que recibiste tu pedido';
      case 'payment':
        return 'Escanea el código QR para proceder con el pago';
      default:
        return 'Apunta la cámara al código QR';
    }
  };

  if (!permission) {
    return (
      <LinearGradient colors={["#1a1a1a", "#2d1810", "#1a1a1a"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ChefLoading size="large" text="Cargando cámara..." />
        </View>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={["#1a1a1a", "#2d1810", "#1a1a1a"]} style={styles.container}>
        <View style={styles.permissionContainer}>
          <QrCode size={64} color="#d4af37" />
          <Text style={styles.permissionTitle}>Acceso a la cámara</Text>
          <Text style={styles.permissionText}>
            Necesitamos acceso a tu cámara para escanear códigos QR
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Permitir acceso</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        {/* Header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{getModeTitle()}</Text>
            <Text style={styles.headerSubtitle}>{getModeDescription()}</Text>
          </View>
        </LinearGradient>

        {/* Scanner frame */}
        <View style={styles.scannerContainer}>
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Processing overlay */}
        {processing && (
          <View style={styles.processingOverlay}>
            <ChefLoading size="large" text="Procesando..." />
          </View>
        )}

        {/* Bottom instructions */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bottomInstructions}
        >
          <Text style={styles.instructionText}>
            Mantén el código QR dentro del marco
          </Text>
          {scanned && !processing && (
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.scanAgainText}>Escanear de nuevo</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 8,
    marginRight: 15,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#cccccc',
    fontSize: 14,
    marginTop: 4,
  },
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#d4af37',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
  },
  bottomInstructions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  scanAgainButton: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderWidth: 1,
    borderColor: '#d4af37',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  scanAgainText: {
    color: '#d4af37',
    fontSize: 14,
    fontWeight: 'bold',
  },
});