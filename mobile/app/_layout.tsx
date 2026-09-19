import 'react-native-get-random-values';

import React, { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StatusBar, useColorScheme, AppState } from 'react-native';
import Avatar from '../components/Avatar';
import { auth } from './firebase';
import { signOutUser } from '../src/services/auth';
import { getUserById } from "@/src/services/users";

import '../global.css';

function AppHeader() {
  const pathname = usePathname();
  const colorScheme = useColorScheme();

  // Hide header ONLY on auth screens
  if (!pathname || pathname.startsWith('/(auth)')) {
    return null;
  }

  const isDark = colorScheme === 'dark';

  return (
    <>
      {/* ✅ StatusBar handled ONCE, globally */}
      <StatusBar
        translucent={false}
        barStyle="light-content"
        backgroundColor="#1E3A8A"
      />

      {/* ✅ Safe area handled correctly */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#1E3A8A' }}>
        <LinearGradient
          colors={['#1E3A8A', '#0EA5E9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View className="px-6 pb-2">
            <View className="relative h-12 justify-center">
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                className="absolute left-12 right-12 mt-2 text-white font-bold text-2xl text-center"
              >
                ASTEM Attendance Register
              </Text>

              <View className="absolute right-0">
                <Avatar email={auth.currentUser?.email} size={42} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const publicPath = pathname?.startsWith('/(auth)') || ['/login', '/signup', '/forgot-password', '/pending-approval', '/post-login', '/verify-email'].includes(pathname ?? '');
    if (publicPath || !auth.currentUser) return;
    let timer = setTimeout(() => { void signOutUser().then(() => router.replace('/(auth)/login' as any)); }, 5 * 60 * 1000);
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { void signOutUser().then(() => router.replace('/(auth)/login' as any)); }, 5 * 60 * 1000); };
    const subscription = AppState.addEventListener('change', (state) => state === 'active' ? reset() : undefined);
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [pathname]);

  // ✅ STEP 4 — PROTECT BACK NAVIGATION (ROOT SAFETY NET)
  useEffect(() => {
    const checkApproval = async () => {
      if (!auth.currentUser) return;

      const authPaths = [
        "/login",
        "/signup",
        "/forgot-password",
        "/pending-approval",
        "/post-login",
        "/verify-email",
      ];

      // Skip auth screens. Expo Router pathnames do not always include route groups.
      if (pathname?.startsWith("/(auth)") || authPaths.includes(pathname ?? "")) {
        return;
      }

      try {
        const user = await getUserById(auth.currentUser.uid);

        if (user && user.role !== "admin" && user.approved !== true) {
          router.replace("/(auth)/pending-approval");
        }
      } catch (err) {
        console.error("Approval check failed:", err);
      }
    };

    checkApproval();
  }, [pathname]);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          header: () => <AppHeader />,
        }}
      />
    </SafeAreaProvider>
  );
}




