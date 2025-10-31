import React from 'react';
import { View, Text } from 'react-native';
import LottieView from 'lottie-react-native';

interface ChefLoadingProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  color?: string;
}

export default function ChefLoading({ 
  size = 'medium', 
  text,
  color = '#d4af37' 
}: ChefLoadingProps) {
  const getDimensions = () => {
    switch (size) {
      case 'small':
        return { width: 50, height: 50 };
      case 'medium':
        return { width: 80, height: 80 };
      case 'large':
        return { width: 120, height: 120 };
      default:
        return { width: 80, height: 80 };
    }
  };

  const dimensions = getDimensions();

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <LottieView
        source={require('../../../assets/chef-making-pizza.json')}
        autoPlay
        loop
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
      />
      {text && (
        <Text
          style={{
            color: color,
            fontSize: size === 'small' ? 12 : size === 'large' ? 18 : 14,
            fontWeight: '500',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          {text}
        </Text>
      )}
    </View>
  );
}