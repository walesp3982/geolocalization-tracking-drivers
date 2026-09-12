import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

type Rol = "chofer" | "admin";

interface LoginScreenProps {
  onLoginExitoso: (rol: Rol) => void;
}

// Credenciales de demo (hardcodeadas, como ya tenían para "chofer").
// TODO: cuando el backend tenga /auth real, reemplazar esta validación
// por una llamada al endpoint de login.
const CREDENCIALES: Record<string, { password: string; rol: Rol }> = {
  chofer: { password: "1234", rol: "chofer" },
  admin: { password: "admin123", rol: "admin" },
};

export default function LoginScreen({ onLoginExitoso }: LoginScreenProps) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");

  const handleIngresar = () => {
    const credencial = CREDENCIALES[usuario.trim().toLowerCase()];

    if (credencial && credencial.password === password) {
      onLoginExitoso(credencial.rol);
    } else {
      Alert.alert("Error", "Usuario o contraseña incorrectos");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={styles.avatar} />

        <TouchableOpacity style={styles.gearButton} onPress={() => {}}>
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <Text style={styles.title}>Iniciar sesión</Text>

          <TextInput
            style={styles.input}
            placeholder="Usuario"
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

          <TouchableOpacity style={styles.button} onPress={handleIngresar}>
            <Text style={styles.buttonText}>INGRESAR</Text>
          </TouchableOpacity>

          <Text style={styles.demoText}>
            (Demo: usuario "chofer" / contraseña "1234"{"\n"}
            o usuario "admin" / contraseña "admin123")
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
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignSelf: "center",
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
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
  demoText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
});