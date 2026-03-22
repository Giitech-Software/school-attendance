// mobile/app/admin/setup-school-location.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import * as Location from "expo-location";
import { useRouter } from "expo-router";

export default function SetupSchoolLocation() {
  const router = useRouter();

  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [radius, setRadius] = useState<string>("150");
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingLocation, setFetchingLocation] = useState<boolean>(true);

  // Helper to safely get current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location permission is required to set school location."
        );
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest, // ✅ valid Expo property
      });

      return loc.coords;
    } catch (err) {
      console.error("getCurrentLocation error:", err);
      return null;
    }
  };

  // Automatically fetch device location on mount
  useEffect(() => {
    (async () => {
      const coords = await getCurrentLocation();

      if (!coords) {
        Alert.alert(
          "Location unavailable",
          "Failed to fetch current location. Make sure GPS/location services are enabled."
        );
      } else {
        setLatitude(coords.latitude.toString());
        setLongitude(coords.longitude.toString());
      }

      setFetchingLocation(false);
    })();
  }, []);

  const handleSave = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseInt(radius, 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(rad)) {
      return Alert.alert(
        "Invalid input",
        "Please enter valid numbers for latitude, longitude, and radius."
      );
    }

    try {
      setLoading(true);
      await setDoc(doc(db, "settings", "location"), {
        latitude: lat,
        longitude: lng,
        radiusMeters: rad,
      });

      Alert.alert("Success", "School location has been saved!");
      router.back();
    } catch (err) {
      console.error("Firestore save error:", err);
      Alert.alert(
        "Error",
        "Failed to save school location. Check your internet connection."
      );
    } finally {
      setLoading(false);
    }
  };

  // Allow manual refresh if location unavailable
  const handleRefreshLocation = async () => {
    setFetchingLocation(true);
    const coords = await getCurrentLocation();
    if (!coords) {
      Alert.alert(
        "Location unavailable",
        "Still could not get current location. Make sure GPS/location services are on."
      );
    } else {
      setLatitude(coords.latitude.toString());
      setLongitude(coords.longitude.toString());
    }
    setFetchingLocation(false);
  };

  if (fetchingLocation) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0A4FB3" />
        <Text className="mt-4">Fetching current location...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-6 bg-white justify-center">
      <Text className="text-2xl font-bold mb-4">Set School/Work Location</Text>

      <Text className="mt-2 font-medium">Latitude</Text>
      <TextInput
        className="border p-2 rounded-lg mt-1"
        value={latitude}
        onChangeText={setLatitude}
        keyboardType="decimal-pad"
      />

      <Text className="mt-2 font-medium">Longitude</Text>
      <TextInput
        className="border p-2 rounded-lg mt-1"
        value={longitude}
        onChangeText={setLongitude}
        keyboardType="decimal-pad"
      />

      <Text className="mt-2 font-medium">Radius (meters)</Text>
      <TextInput
        className="border p-2 rounded-lg mt-1"
        value={radius}
        onChangeText={setRadius}
        keyboardType="numeric"
      />

      <Pressable
        onPress={handleSave}
        className={`bg-blue-600 p-4 rounded-lg mt-6 ${loading ? "opacity-50" : ""}`}
        disabled={loading}
      >
        <Text className="text-white font-bold text-center">
          {loading ? "Saving..." : "Set School/Work Location"}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleRefreshLocation}
        className="bg-gray-300 p-3 rounded-lg mt-4 items-center"
      >
        <Text className="text-black font-semibold">Refresh GPS Location</Text>
      </Pressable>
    </View>
  );
}