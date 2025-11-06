import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Download, Share2, ArrowLeft, CheckCircle, ExternalLink } from "lucide-react-native";
import type {
  RootStackNavigationProp,
  RootStackParamList,
} from "../../navigation/RootStackParamList";
import { downloadInvoice } from "../../api/orders";
import api from "../../api/axios";

interface InvoiceData {
  generated: boolean;
  filePath?: string;
  fileName?: string;
  message?: string;
  error?: string;
}

const InvoiceViewScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, "InvoiceView">>();
  const navigation = useNavigation<RootStackNavigationProp>();
  
  const { invoiceData, paymentAmount } = route.params;

  const handleDownload = async () => {
    try {
      if (!invoiceData.fileName) {
        Alert.alert("Error", "No se puede descargar la factura");
        return;
      }

      Alert.alert(
        "Descargar Factura",
        "¿Deseas abrir la factura en el navegador?",
        [
          { text: "Cancelar", style: "cancel" },
          { 
            text: "Abrir", 
            style: "default", 
            onPress: async () => {
              try {
                // Construir la URL completa de la factura
                const baseURL = api.defaults.baseURL || 'http://localhost:3000';
                const invoiceUrl = `${baseURL}/api/invoices/download/${invoiceData.fileName}`;
                
                console.log("📄 Opening invoice URL:", invoiceUrl);
                
                // Abrir en el navegador del dispositivo
                const supported = await Linking.canOpenURL(invoiceUrl);
                if (supported) {
                  await Linking.openURL(invoiceUrl);
                } else {
                  Alert.alert("Error", "No se puede abrir el enlace");
                }
              } catch (error) {
                console.error("Error opening invoice:", error);
                Alert.alert("Error", "No se pudo abrir la factura");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error descargando factura:", error);
      Alert.alert("Error", "No se pudo descargar la factura");
    }
  };

  const handleShare = async () => {
    try {
      if (!invoiceData.fileName) {
        Alert.alert("Error", "No se puede compartir la factura");
        return;
      }

      await Share.share({
        message: `Factura de The Last Dance Restaurant\nTotal pagado: $${paymentAmount?.toLocaleString()}\nArchivo: ${invoiceData.fileName}`,
        title: "Factura - The Last Dance",
      });
    } catch (error) {
      console.error("Error compartiendo factura:", error);
    }
  };

  const goToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Home" }],
    });
  };

  if (!invoiceData.generated) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center p-4">
        <View className="bg-red-900 border border-red-600 rounded-lg p-6 w-full max-w-sm">
          <Text className="text-red-400 text-lg font-semibold text-center mb-2">
            Error en la Factura
          </Text>
          <Text className="text-red-300 text-center mb-4">
            {invoiceData.error || "No se pudo generar la factura"}
          </Text>
          <TouchableOpacity
            onPress={goToHome}
            className="bg-red-600 py-3 rounded-lg"
          >
            <Text className="text-white text-center font-semibold">
              Volver al Inicio
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex-row items-center">
        <TouchableOpacity onPress={goToHome} className="mr-3">
          <ArrowLeft size={24} color="#10b981" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold">Factura Generada</Text>
          <Text className="text-gray-400 text-sm">
            {invoiceData.fileName || "Factura oficial"}
          </Text>
        </View>
        <View className="bg-green-600 px-3 py-1 rounded-full">
          <CheckCircle size={16} color="white" />
        </View>
      </View>

      {/* Success Message */}
      <View className="bg-green-900 border border-green-600 rounded-lg m-4 p-4">
        <View className="flex-row items-center mb-2">
          <CheckCircle size={20} color="#10b981" />
          <Text className="text-green-400 text-lg font-semibold ml-2">
            ¡Pago Procesado Exitosamente!
          </Text>
        </View>
        <Text className="text-green-300">
          {invoiceData.message || "La factura ha sido generada correctamente"}
        </Text>
        {paymentAmount && (
          <Text className="text-white font-semibold mt-2">
            Total pagado: ${paymentAmount.toLocaleString()}
          </Text>
        )}
      </View>

      {/* Preview Section */}
      <View className="flex-1 m-4 bg-gray-800 rounded-lg overflow-hidden">
        <View className="bg-gray-700 px-4 py-3 border-b border-gray-600">
          <Text className="text-white font-semibold">Vista Previa de la Factura</Text>
          <Text className="text-gray-400 text-sm">Formato oficial AFIP</Text>
        </View>
        
        {/* Placeholder for invoice preview */}
        <ScrollView className="flex-1 p-4">
          <View className="bg-white rounded-lg p-4">
            <Text className="text-gray-800 text-center text-lg font-bold mb-4">
              THE LAST DANCE
            </Text>
            <Text className="text-gray-600 text-center mb-4">
              FACTURA OFICIAL - FORMATO AFIP
            </Text>
            
            <View className="border-t border-gray-300 pt-4">
              <Text className="text-gray-800 font-semibold mb-2">
                Detalles de la Factura:
              </Text>
              <Text className="text-gray-600 mb-1">
                • Formato oficial de AFIP
              </Text>
              <Text className="text-gray-600 mb-1">
                • Datos fiscales completos
              </Text>
              <Text className="text-gray-600 mb-1">
                • Cálculos de IVA incluidos
              </Text>
              <Text className="text-gray-600 mb-1">
                • Código de autorización (CAE)
              </Text>
              <Text className="text-gray-600 mb-4">
                • Lista detallada de productos y servicios
              </Text>
              
              {paymentAmount && (
                <View className="bg-gray-100 p-3 rounded">
                  <Text className="text-gray-800 font-bold text-center">
                    Total Pagado: ${paymentAmount.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View className="p-4 bg-gray-800 border-t border-gray-700">
        <View className="flex-row space-x-3 mb-3">
          <TouchableOpacity
            onPress={handleDownload}
            className="flex-1 bg-blue-600 py-3 rounded-lg flex-row justify-center items-center"
          >
            <Download size={16} color="white" />
            <Text className="text-white font-semibold ml-2">Ver Factura</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleShare}
            className="flex-1 bg-purple-600 py-3 rounded-lg flex-row justify-center items-center"
          >
            <Share2 size={16} color="white" />
            <Text className="text-white font-semibold ml-2">Compartir</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          onPress={goToHome}
          className="bg-green-600 py-3 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">
            Finalizar y Volver al Inicio
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default InvoiceViewScreen;