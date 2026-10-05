import { gruposService } from "@/services/gruposService";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
} from "react-native";

export default function CrearGrupoScreen() {
  const router = useRouter();
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const esValido = Boolean(
    nombreGrupo.trim() && nombreGrupo.trim().length <= 20,
  );

  const handleCrear = async () => {
    if (!esValido) {
      Alert.alert("Faltan datos", "Completa el nombre del grupo.");
      return;
    }
    setEnviando(true);
    try {
      const grupo = await gruposService.crear({
        nombre: nombreGrupo.trim(),
        lineas: [],
      });
      router.replace({
        pathname: "/admin/grupos/[grupoId]",
        params: { grupoId: grupo.id },
      });
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "No se pudo crear el grupo",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
      >
        <Text style={styles.backLink}>Volver a grupos</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Crear grupo</Text>

      <Text style={styles.label}>Nombre del grupo</Text>
      <TextInput
        style={styles.input}
        value={nombreGrupo}
        onChangeText={setNombreGrupo}
        placeholder="Ej: Flota Centro"
        maxLength={20}
      />

      <TouchableOpacity
        style={[
          styles.button,
          (!esValido || enviando) && styles.buttonDisabled,
        ]}
        onPress={handleCrear}
        disabled={!esValido || enviando}
      >
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Crear grupo</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  backLink: { color: "#2563eb", fontWeight: "600", marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  label: { fontSize: 13, color: "#4b5563", marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: { backgroundColor: "#93c5fd" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
