import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ArrowLeft, Coffee, UtensilsCrossed } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

export default function MenuScreen({ navigation }: Props) {
  return (
    <View className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="bg-gray-800 pt-12 pb-4 px-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">
          Menú del Restaurante
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Platos */}
        <View className="mt-6">
          <View className="flex-row items-center mb-4">
            <UtensilsCrossed size={24} color="#d4af37" />
            <Text className="text-white text-lg font-bold ml-2">
              Platos Principales
            </Text>
          </View>

          <View className="bg-gray-800 rounded-lg p-4 mb-4">
            <Text className="text-white font-semibold mb-2">
              Pizza Margherita
            </Text>
            <Text className="text-gray-300 text-sm mb-2">
              Base de tomate, mozzarella fresca, albahaca y aceite de oliva
            </Text>
            <Text className="text-yellow-400 font-bold">$15.99</Text>
          </View>

          <View className="bg-gray-800 rounded-lg p-4 mb-4">
            <Text className="text-white font-semibold mb-2">
              Pasta Carbonara
            </Text>
            <Text className="text-gray-300 text-sm mb-2">
              Espaguetis con panceta, huevo, queso parmesano y pimienta negra
            </Text>
            <Text className="text-yellow-400 font-bold">$12.99</Text>
          </View>

          <View className="bg-gray-800 rounded-lg p-4 mb-6">
            <Text className="text-white font-semibold mb-2">
              Salmón a la Parrilla
            </Text>
            <Text className="text-gray-300 text-sm mb-2">
              Filete de salmón con vegetales asados y salsa de limón
            </Text>
            <Text className="text-yellow-400 font-bold">$18.99</Text>
          </View>
        </View>

        {/* Bebidas */}
        <View className="mb-6">
          <View className="flex-row items-center mb-4">
            <Coffee size={24} color="#d4af37" />
            <Text className="text-white text-lg font-bold ml-2">Bebidas</Text>
          </View>

          <View className="bg-gray-800 rounded-lg p-4 mb-4">
            <Text className="text-white font-semibold mb-2">
              Vino Tinto de la Casa
            </Text>
            <Text className="text-gray-300 text-sm mb-2">
              Copa de vino tinto seleccionado por nuestro sommelier
            </Text>
            <Text className="text-yellow-400 font-bold">$8.99</Text>
          </View>

          <View className="bg-gray-800 rounded-lg p-4 mb-4">
            <Text className="text-white font-semibold mb-2">
              Limonada Natural
            </Text>
            <Text className="text-gray-300 text-sm mb-2">
              Refrescante limonada con menta fresca
            </Text>
            <Text className="text-yellow-400 font-bold">$4.99</Text>
          </View>
        </View>

        {/* Botón temporal */}
        <View className="bg-yellow-600 rounded-lg p-4 mb-8">
          <Text className="text-center text-black font-bold mb-2">
            🚧 Funcionalidad en Desarrollo 🚧
          </Text>
          <Text className="text-center text-black text-sm">
            Pronto podrás hacer pedidos directamente desde la app
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
