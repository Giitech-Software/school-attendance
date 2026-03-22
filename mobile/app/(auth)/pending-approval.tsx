import { View, Text, Pressable } from "react-native";
import { signOutUser } from "../../src/services/auth";
import { useRouter } from "expo-router";

export default function PendingApproval() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.replace("/(auth)/login");
    } catch (err: any) {
      console.error("Sign out failed", err);
    }
  };

  return (
    <View className="flex-1 items-center justify-center px-6 bg-white">
      <Text className="text-2xl font-bold text-center mb-3">
        Account Pending Approval
      </Text>

     <Text className="text-center font-bold text-green-600 mb-6">
  Your account was created successfully, but you must first have to check your inbox or spam folder to verify your email.{"\n\n"}
  Also, you must be approved by the administrator before accessing attendance features.
</Text>


      <Pressable
        onPress={handleSignOut}
        className="bg-red-600 px-6 py-3 rounded"
      >
        <Text className="text-white font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}
