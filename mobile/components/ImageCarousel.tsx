import React, { useEffect, useState } from "react";
import { Image, View, type ImageSourcePropType } from "react-native";

export default function ImageCarousel({ images, height = 300 }: { images: ImageSourcePropType[]; height?: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { if (images.length < 2) return; const timer = setInterval(() => setIndex((current) => current >= images.length - 1 ? 0 : current + 1), 5000); return () => clearInterval(timer); }, [images.length]);
  if (!images.length) return null;
  return <View className="relative overflow-hidden" style={{ height }}><Image source={images[index]} style={{ width: "100%", height }} resizeMode="cover" /></View>;
}
