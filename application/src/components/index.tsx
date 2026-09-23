import DriverTracker from "@/components/DriverMap";
import LoginScreen from "@/components/login-screen";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

export default function HomeScreen() {
  const [sesionIniciada, setSesionIniciada] = useState(false);

  if (!sesionIniciada) {
    return <LoginScreen onLoginExitoso={() => setSesionIniciada(true)} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: -17.7833,
          longitude: -63.1821,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />
      <DriverTracker />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
