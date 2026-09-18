import React, { useEffect, useState } from "react";
import { Animated, Image, View, type ImageSourcePropType } from "react-native";

export default function ImageCarousel({ images, height = 300 }: { images: ImageSourcePropType[]; height?: number }) {
  const [index, setIndex] = useState(0);
  const opacity = React.useRef(new Animated.Value(1)).current;
  useEffect(() => { if (images.length < 2) return; const timer = setInterval(() => { Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => { setIndex((current) => (current + 1) % images.length); Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start(); }); }, 5000); return () => clearInterval(timer); }, [images.length, opacity]);
  if (!images.length) return null;
  return <View className="relative overflow-hidden" style={{ height }}><Animated.Image source={images[index]} style={{ width: "100%", height, opacity }} resizeMode="cover" /></View>;
}
