import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { gruposService } from "@/services/gruposService";

export default function CrearGrupoScreen() {
  const router = useRouter();
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [nombreRepresentante, setNombreRepresentante] = useState("");
  const [telefonoRepresentante, setTelefonoRepresentante] = useState("");
  const [emailRepresentante, setEmailRepresentante] = useState("");
  const [enviando, setEnviando] = useState(false);

  // El representante es opcional: se puede crear el grupo y asignarlo después.
  // Pero si se llena uno de sus campos, se piden ambos (nombre y teléfono) para
  // no guardar un representante a medias.
  const representanteIniciado = nombreRepresentante.trim() || telefonoRepresentante.trim();
  const representanteCompleto = nombreRepresentante.trim() && telefonoRepresentante.trim();
  const esValido = nombreGrupo.trim() && (!representanteIniciado || representanteCompleto);

  const handleCrear = async () => {
    if (!esValido) {
      Alert.alert(
        "Faltan datos",
        !nombreGrupo.trim()
          ? "Completa el nombre del grupo."
          : "Si vas a asignar representante, completa su nombre y teléfono (o deja ambos vacíos)."
      );
      return;
    }
    setEnviando(true);
    try {
      await gruposService.crear({
        nombre: nombreGrupo.trim(),
        lineas: [],
        representante: representanteCompleto
          ? {
              nombre: nombreRepresentante.trim(),
              telefono: telefonoRepresentante.trim(),
              email: emailRepresentante.trim() || undefined,
            }
          : undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo crear el grupo");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Crear grupo</Text>

      <Text style={styles.label}>Nombre del grupo</Text>
      <TextInput
        style={styles.input}
        value={nombreGrupo}
        onChangeText={setNombreGrupo}
        placeholder="Ej: Flota Centro"
      />

      <Text style={styles.sectionTitle}>Representante (opcional)</Text>

      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={nombreRepresentante}
        onChangeText={setNombreRepresentante}
        placeholder="Nombre completo"
      />

      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        value={telefonoRepresentante}
        onChangeText={setTelefonoRepresentante}
        placeholder="Ej: 8888-8888"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Email (opcional)</Text>
      <TextInput
        style={styles.input}
        value={emailRepresentante}
        onChangeText={setEmailRepresentante}
        placeholder="correo@ejemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, (!esValido || enviando) && styles.buttonDisabled]}
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
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 12, marginBottom: 8 },
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