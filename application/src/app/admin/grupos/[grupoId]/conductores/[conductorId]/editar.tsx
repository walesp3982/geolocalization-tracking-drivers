import { gruposService } from "@/services/gruposService";
import { ConductorDetalle } from "@/types/grupo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EditarConductorScreen() {
  const { grupoId, conductorId } = useLocalSearchParams<{
    grupoId: string;
    conductorId: string;
  }>();
  const router = useRouter();
  const [conductor, setConductor] = useState<ConductorDetalle | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!grupoId || !conductorId) return;
    gruposService
      .obtenerConductor(grupoId, conductorId)
      .then((data) => {
        setConductor(data);
        setNombre(data.nombre);
        setTelefono(data.telefono ?? "");
      })
      .catch((error: unknown) => {
        Alert.alert("Error", error instanceof Error ? error.message : "No se pudo cargar");
      })
      .finally(() => setCargando(false));
  }, [grupoId, conductorId]);

  const guardar = async () => {
    if (
      !grupoId ||
      !conductorId ||
      !nombre.trim() ||
      nombre.trim().length > 120 ||
      telefono.trim().length > 20
    ) return;
    setGuardando(true);
    try {
      await gruposService.editarConductor(grupoId, conductorId, {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
      });
      router.back();
    } catch (error) {
      Alert.alert("No se pudo guardar", error instanceof Error ? error.message : "Intenta nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!conductor) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>No se encontró el conductor.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Editar conductor</Text>
        <Text style={styles.label}>Código de acceso</Text>
        <TextInput style={[styles.input, styles.readonly]} value={conductor.code} editable={false} />
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          maxLength={120}
        />
        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
          maxLength={20}
        />
        <Text style={styles.note}>El código y la contraseña no se modifican desde esta pantalla.</Text>
        <TouchableOpacity
          style={[styles.button, (!nombre.trim() || nombre.trim().length > 120 || telefono.trim().length > 20 || guardando) && styles.disabled]}
          onPress={guardar}
          disabled={!nombre.trim() || nombre.trim().length > 120 || telefono.trim().length > 20 || guardando}
        >
          {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Guardar cambios</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#fff", flex: 1 },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { padding: 18 },
  back: { color: "#2563eb", fontWeight: "600", marginBottom: 12 },
  title: { color: "#111827", fontSize: 23, fontWeight: "700", marginBottom: 10 },
  label: { color: "#374151", fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 5 },
  input: { borderColor: "#d1d5db", borderRadius: 7, borderWidth: 1, color: "#111827", fontSize: 15, paddingHorizontal: 12, paddingVertical: 11 },
  readonly: { backgroundColor: "#f3f4f6", color: "#6b7280" },
  note: { color: "#6b7280", fontSize: 12, marginTop: 12 },
  button: { alignItems: "center", backgroundColor: "#1d4ed8", borderRadius: 7, marginTop: 20, padding: 14 },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
