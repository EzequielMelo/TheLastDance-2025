import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Home, BookOpen, QrCode, ShoppingCart, Menu } from "lucide-react-native";

interface BottomNavbarProps {
  onNavigateHome: () => void;
  onNavigateMenu: () => void;
  onScanQR: () => void;
  onOpenCart: () => void;
  onOpenSidebar: () => void;
  activeTab?: 'home' | 'menu' | 'cart';
}

export default function BottomNavbar({
  onNavigateHome,
  onNavigateMenu,
  onScanQR,
  onOpenCart,
  onOpenSidebar,
  activeTab = 'home'
}: BottomNavbarProps) {
  return (
    <View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1a1a1a',
      borderTopWidth: 1,
      borderTopColor: 'rgba(212, 175, 55, 0.2)',
      paddingBottom: 20, // Para manejar la safe area
      paddingTop: 12,
      paddingHorizontal: 20,
    }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        position: 'relative',
      }}>
        
        {/* Inicio */}
        <TouchableOpacity
          onPress={onNavigateHome}
          style={{
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            opacity: activeTab === 'home' ? 1 : 0.6,
          }}
        >
          <Home 
            size={24} 
            color={activeTab === 'home' ? '#d4af37' : '#fff'} 
          />
          <Text style={{
            color: activeTab === 'home' ? '#d4af37' : '#fff',
            fontSize: 14, // Aumentado de 12 a 14
            marginTop: 4,
            fontWeight: activeTab === 'home' ? '600' : '400',
          }}>
            Inicio
          </Text>
        </TouchableOpacity>

        {/* Menú */}
        <TouchableOpacity
          onPress={onNavigateMenu}
          style={{
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            opacity: activeTab === 'menu' ? 1 : 0.6,
          }}
        >
          <BookOpen 
            size={24} 
            color={activeTab === 'menu' ? '#d4af37' : '#fff'} 
          />
          <Text style={{
            color: activeTab === 'menu' ? '#d4af37' : '#fff',
            fontSize: 14, // Aumentado de 12 a 14
            marginTop: 4,
            fontWeight: activeTab === 'menu' ? '600' : '400',
          }}>
            Menú
          </Text>
        </TouchableOpacity>
        
        <View style={{ width: 80 }} />

        {/* QR - Botón especial destacado */}
        <TouchableOpacity
          onPress={onScanQR}
          style={{
            position: 'absolute',
            top: -20, // Elevar el botón
            backgroundColor: '#d4af37',
            width: 64,
            height: 64,
            borderRadius: 32,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#d4af37',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 12, // Para Android
            borderWidth: 4,
            borderColor: '#1a1a1a',
          }}
        >
          <QrCode size={32} color="#1a1a1a" />
        </TouchableOpacity>

        {/* Carrito */}
        <TouchableOpacity
          onPress={onOpenCart}
          style={{
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            opacity: activeTab === 'cart' ? 1 : 0.6,
          }}
        >
          <ShoppingCart 
            size={24} 
            color={activeTab === 'cart' ? '#d4af37' : '#fff'} 
          />
          <Text style={{
            color: activeTab === 'cart' ? '#d4af37' : '#fff',
            fontSize: 14, // Aumentado de 12 a 14
            marginTop: 4,
            fontWeight: activeTab === 'cart' ? '600' : '400',
          }}>
            Carrito
          </Text>
        </TouchableOpacity>

        {/* Menú hamburguesa */}
        <TouchableOpacity
          onPress={onOpenSidebar}
          style={{
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            opacity: 0.8,
          }}
        >
          <Menu size={24} color="#fff" />
          <Text style={{
            color: '#fff',
            fontSize: 14, // Aumentado de 12 a 14
            marginTop: 4,
            fontWeight: '400',
          }}>
            Más
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}