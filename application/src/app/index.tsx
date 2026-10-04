import DriverMapView from "@/components/DriverMapView";
import LoginScreen from "@/components/login-screen";
import { useAuth } from "@/context/auth-context";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import PanelAdminScreen from "./admin/grupos/index";

export default function HomeScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  if (user.role === "admin") {
    return <PanelAdminScreen />;
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
