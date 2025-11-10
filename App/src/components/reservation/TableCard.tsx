import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";

interface TableCardProps {
  table: {
    id: string;
    number: number;
    capacity: number;
    type: string;
    photo_url?: string;
  };
  isSelected: boolean;
  onSelect: () => void;
}

export default function TableCard({ table, isSelected, onSelect }: TableCardProps) {
  const [imageLoading, setImageLoading] = useState(true);

  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`border-2 rounded-lg p-4 min-w-[200px] ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
      }`}
    >
      {/* Imagen de la mesa */}
      <View className="w-full h-32 bg-gray-200 rounded-lg mb-3 overflow-hidden relative">
        {table.photo_url ? (
          <>
            <Image
              source={{ uri: table.photo_url }}
              className="w-full h-full"
              style={{ resizeMode: "cover" }}
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
            {imageLoading && (
              <View className="absolute inset-0 bg-gray-200 items-center justify-center">
                <ActivityIndicator size="small" color="#3B82F6" />
              </View>
            )}
          </>
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-gray-500 text-sm">Mesa #{table.number}</Text>
            <Text className="text-gray-400 text-xs mt-1">Sin imagen</Text>
          </View>
        )}
      </View>

      {/* Información de la mesa */}
      <Text
        className={`font-semibold text-center ${
          isSelected ? "text-blue-700" : "text-gray-800"
        }`}
      >
        Mesa #{table.number}
      </Text>
      <Text className="text-gray-600 text-sm text-center mt-1">
        Capacidad: {table.capacity}{" "}personas
      </Text>
      <Text className="text-gray-600 text-sm text-center">
        Tipo: {table.type}
      </Text>
    </TouchableOpacity>
  );
}
