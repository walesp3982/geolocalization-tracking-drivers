import { useAuth } from "@/context/auth-context";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleIngresar = async () => {
    if (!usuario.trim() || !password.trim()) {
      Alert.alert("Error", "Completa usuario y contraseña.");
      return;
    }

    setLoading(true);
    const result = await login(usuario.trim(), password);
    setLoading(false);

    if (!result.success) {
      Alert.alert("Error", result.message ?? "Credenciales inválidas.");
      return;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.gearButton} onPress={() => {}}>
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <Text style={styles.title}>Iniciar sesión</Text>

          <TextInput
            style={styles.input}
            placeholder="Usuario o identificador"
            placeholderTextColor="#9ca3af"
            value={usuario}
            onChangeText={setUsuario}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleIngresar}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "INGRESANDO..." : "INGRESAR"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.demoText}>
            Usa las credenciales del backend. El token se guarda en SecureStore
            y se valida al iniciar la app.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  gearButton: {
    position: "absolute",
    top: 60,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  gearIcon: { fontSize: 18 },
  form: {
    marginTop: 180,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  demoText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
});
