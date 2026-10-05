import { gruposService } from "@/services/gruposService";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

export default function CrearConductorScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const valido = Boolean(
    nombre.trim() && codigo.trim() && codigo.length <= 10 && password.length >= 6,
  );

  const crear = async () => {
    if (!grupoId || !valido) return;
    setGuardando(true);
    try {
      const conductor = await gruposService.crearConductor(grupoId, {
        nombre: nombre.trim(),
        code: codigo.trim(),
        telefono: telefono.trim() || undefined,
        password,
      });
      router.replace({
        pathname: "/admin/grupos/[grupoId]/conductores/[conductorId]",
        params: { grupoId, conductorId: conductor.id },
      });
    } catch (error) {
      Alert.alert(
        "No se pudo crear el conductor",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Volver al grupo</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nuevo conductor</Text>
        <Text style={styles.subtitle}>Grupo {grupoId}</Text>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />
        <Text style={styles.label}>Código de acceso</Text>
        <TextInput
          style={styles.input}
          value={codigo}
          onChangeText={setCodigo}
          maxLength={10}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>Contraseña inicial</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, (!valido || guardando) && styles.disabled]}
          onPress={crear}
          disabled={!valido || guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Crear conductor</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 18, gap: 6 },
  back: { color: "#2563eb", fontWeight: "600", marginBottom: 8 },
  title: { color: "#111827", fontSize: 23, fontWeight: "700" },
  subtitle: { color: "#6b7280", marginBottom: 12 },
  label: { color: "#374151", fontSize: 13, fontWeight: "600", marginTop: 8 },
  input: {
    borderColor: "#d1d5db",
    borderRadius: 7,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#1d4ed8",
    borderRadius: 7,
    marginTop: 20,
    padding: 14,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
