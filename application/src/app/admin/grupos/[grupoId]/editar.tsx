import { useCallback, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { gruposService } from "@/services/gruposService";

export default function EditarGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const router = useRouter();

  const [nombreGrupo, setNombreGrupo] = useState("");
  const [lineas, setLineas] = useState(""); // texto separado por comas, ej: "231, 232"
  const [nombreRepresentante, setNombreRepresentante] = useState("");
  const [telefonoRepresentante, setTelefonoRepresentante] = useState("");
  const [emailRepresentante, setEmailRepresentante] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const precargar = useCallback(async () => {
    if (!grupoId) return;
    try {
      const grupo = await gruposService.obtener(grupoId);
      setNombreGrupo(grupo.nombre);
      setLineas(grupo.lineas.join(", "));
      if (grupo.representante) {
        setNombreRepresentante(grupo.representante.nombre);
        setTelefonoRepresentante(grupo.representante.telefono);
        setEmailRepresentante(grupo.representante.email ?? "");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo cargar el grupo");
    } finally {
      setCargando(false);
    }
  }, [grupoId]);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      precargar();
    }, [precargar])
  );

  const representanteIniciado = nombreRepresentante.trim() || telefonoRepresentante.trim();
  const representanteCompleto = nombreRepresentante.trim() && telefonoRepresentante.trim();
  const esValido = nombreGrupo.trim() && (!representanteIniciado || representanteCompleto);

  const handleGuardar = async () => {
    if (!grupoId || !esValido) {
      Alert.alert(
        "Faltan datos",
        !nombreGrupo.trim()
          ? "Completa el nombre del grupo."
          : "Si vas a asignar representante, completa nombre y teléfono (o deja ambos vacíos)."
      );
      return;
    }
    setGuardando(true);
    try {
      await gruposService.editar(grupoId, {
        nombre: nombreGrupo.trim(),
        lineas: lineas
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
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
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Editar grupo</Text>

      <Text style={styles.label}>Nombre del grupo</Text>
      <TextInput style={styles.input} value={nombreGrupo} onChangeText={setNombreGrupo} />

      <Text style={styles.label}>Líneas (separadas por coma)</Text>
      <TextInput
        style={styles.input}
        value={lineas}
        onChangeText={setLineas}
        placeholder="Ej: 231, 232"
      />

      <Text style={styles.sectionTitle}>Representante (opcional)</Text>

      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={nombreRepresentante}
        onChangeText={setNombreRepresentante}
      />

      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        value={telefonoRepresentante}
        onChangeText={setTelefonoRepresentante}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Email (opcional)</Text>
      <TextInput
        style={styles.input}
        value={emailRepresentante}
        onChangeText={setEmailRepresentante}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, (!esValido || guardando) && styles.buttonDisabled]}
        onPress={handleGuardar}
        disabled={!esValido || guardando}
      >
        {guardando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Guardar cambios</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
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