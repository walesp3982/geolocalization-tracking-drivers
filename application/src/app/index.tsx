import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { iniciarRastreoUbicacion } from "@/services/locationService";
import { Button, StyleSheet } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

function AllowButtonLocation() {
  return (
    <Button
      onPress={iniciarRastreoUbicacion}
      title="Habilitar ubicaciónn"
    ></Button>
  );
}

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      {/* <SafeAreaView style={styles.safeArea}> */}
      <AllowButtonLocation />
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{
          flex: 1,
        }}
        initialRegion={{
          latitude: -17.7833,
          longitude: -63.1821,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />
      {/* </SafeAreaView> */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  code: {
    textTransform: "uppercase",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
