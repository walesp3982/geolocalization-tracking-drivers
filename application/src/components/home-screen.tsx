import DriverMapView from "@/components/DriverMapView";
import LoginScreen from "@/components/login-screen";
import { useAuth } from "@/context/auth-context";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function HomeScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated && user?.role === "admin") {
    return <Redirect href="/admin/grupos" />;
  }

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  return <DriverMapView />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});