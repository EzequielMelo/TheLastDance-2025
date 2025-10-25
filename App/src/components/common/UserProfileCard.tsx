import React from "react";
import { View, Text, Image } from "react-native";
import { User as UserIcon } from "lucide-react-native";
import { User } from "../../types/User";

interface UserProfileCardProps {
  user: User;
  getProfileLabel: (profileCode: string, positionCode?: string) => string;
}

export default function UserProfileCard({ user, getProfileLabel }: UserProfileCardProps) {
  return (
    <View style={{
      backgroundColor: "rgba(212, 175, 55, 0.1)",
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: "rgba(212, 175, 55, 0.3)",
      alignItems: "center"
    }}>
      <View style={{
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "#333",
        marginBottom: 16,
        overflow: "hidden",
        borderWidth: 3,
        borderColor: "#d4af37"
      }}>
        {(user as any)?.photo_url ? (
          <Image 
            source={{ uri: (user as any).photo_url }} 
            style={{ width: "100%", height: "100%", borderRadius: 60 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ 
            flex: 1, 
            justifyContent: "center", 
            alignItems: "center" 
          }}>
            <UserIcon size={60} color="#d4af37" />
          </View>
        )}
      </View>
      <Text style={{ 
        color: "#d4af37", 
        fontSize: 20, 
        fontWeight: "700", 
        marginBottom: 4 
      }}>
        {user?.first_name} {user?.last_name}
      </Text>
      <Text style={{ 
        color: "#fff", 
        fontSize: 16, 
        opacity: 0.8 
      }}>
        {getProfileLabel(user?.profile_code, user?.position_code || undefined)}
      </Text>
    </View>
  );
}