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
    TouchableOpacity
} from "react-native";

export default function CrearGrupoScreen() {
  const router = useRouter();
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [nombreRepresentante, setNombreRepresentante] = useState("");
  const [telefonoRepresentante, setTelefonoRepresentante] = useState("");
  const [codigoRepresentante, setCodigoRepresentante] = useState("");
  const [passwordRepresentante, setPasswordRepresentante] = useState("");
  const [enviando, setEnviando] = useState(false);

  const representanteIniciado = Boolean(
    nombreRepresentante.trim() ||
    telefonoRepresentante.trim() ||
    codigoRepresentante.trim() ||
    passwordRepresentante,
  );
  const representanteCompleto = Boolean(
    nombreRepresentante.trim() &&
    nombreRepresentante.trim().length <= 120 &&
    telefonoRepresentante.trim() &&
    telefonoRepresentante.trim().length <= 20 &&
    codigoRepresentante.trim() &&
    codigoRepresentante.trim().length <= 10 &&
    passwordRepresentante.length >= 6,
  );
  const esValido = Boolean(
    nombreGrupo.trim() &&
      nombreGrupo.trim().length <= 20 &&
      (!representanteIniciado || representanteCompleto),
  );

  const handleCrear = async () => {
    if (!esValido) {
      Alert.alert(
        "Faltan datos",
        !nombreGrupo.trim()
          ? "Completa el nombre del grupo."
          : "Para crear un representante completa nombre, teléfono, código y una contraseña de al menos 6 caracteres; también puedes dejar todos esos campos vacíos.",
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
              code: codigoRepresentante.trim(),
              password: passwordRepresentante,
            }
          : undefined,
      });
      router.back();
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
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
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

      <Text style={styles.sectionTitle}>Representante (opcional)</Text>

      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={nombreRepresentante}
        onChangeText={setNombreRepresentante}
        placeholder="Nombre completo"
        maxLength={120}
      />

      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        value={telefonoRepresentante}
        onChangeText={setTelefonoRepresentante}
        placeholder="Ej: 8888-8888"
        keyboardType="phone-pad"
        maxLength={20}
      />

      <Text style={styles.label}>Código de acceso</Text>
      <TextInput
        style={styles.input}
        value={codigoRepresentante}
        onChangeText={setCodigoRepresentante}
        placeholder="Máximo 10 caracteres"
        maxLength={10}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Contraseña inicial</Text>
      <TextInput
        style={styles.input}
        value={passwordRepresentante}
        onChangeText={setPasswordRepresentante}
        secureTextEntry
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
