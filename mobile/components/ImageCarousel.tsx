import React, { useEffect, useRef, useState } from "react";
import { Animated, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import { Image } from "expo-image";

export const MOBILE_CAROUSEL_HEIGHT = 220;

export default function ImageCarousel({ images, height = MOBILE_CAROUSEL_HEIGHT }: { images: ImageSourcePropType[]; height?: number }) {
  const [index, setIndex] = useState(0);
  const { width } = useWindowDimensions();
  const currentX = useRef(new Animated.Value(0)).current;
  const nextX = useRef(new Animated.Value(width)).current;
  const transitioning = useRef(false);

  useEffect(() => {
    if (images.length < 2) return;
    let rotationTimer: ReturnType<typeof setInterval> | undefined;
    const startTimer = setTimeout(() => {
      rotationTimer = setInterval(() => {
        if (transitioning.current) return;
        transitioning.current = true;
        nextX.setValue(width);
        Animated.parallel([
          Animated.timing(currentX, { toValue: -width, duration: 700, useNativeDriver: true }),
          Animated.timing(nextX, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (!finished) return;
          setIndex((current) => (current + 1) % images.length);
          currentX.setValue(0);
          nextX.setValue(width);
          transitioning.current = false;
        });
      }, 5000);
    }, 1500);
    return () => {
      clearTimeout(startTimer);
      if (rotationTimer) clearInterval(rotationTimer);
    };
  }, [currentX, images.length, nextX, width]);
  if (!images.length) return null;
  const nextIndex = (index + 1) % images.length;
  return (
    <View style={{ height, width: "100%", overflow: "hidden", backgroundColor: "#0f172a" }}>
      <Animated.View style={{ position: "absolute", width, height, transform: [{ translateX: currentX }] }}>
        <Image source={images[index]} style={{ width, height }} contentFit="cover" cachePolicy="memory-disk" />
      </Animated.View>
      <Animated.View style={{ position: "absolute", width, height, transform: [{ translateX: nextX }] }}>
        <Image source={images[nextIndex]} style={{ width, height }} contentFit="cover" cachePolicy="memory-disk" />
      </Animated.View>
    </View>
  );
}
