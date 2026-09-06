import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

// Credenciales de ejemplo (hardcodeadas por ahora, sin backend todavía)
const CREDENCIALES_VALIDAS = {
  usuario: "chofer",
  contrasena: "1234",
};

interface LoginScreenProps {
  onLoginExitoso: () => void;
}

export default function LoginScreen({ onLoginExitoso }: LoginScreenProps) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");

  function manejarLogin() {
    if (
      usuario === CREDENCIALES_VALIDAS.usuario &&
      contrasena === CREDENCIALES_VALIDAS.contrasena
    ) {
      setError("");
      onLoginExitoso();
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Iniciar sesión</Text>

      <TextInput
        style={styles.input}
        placeholder="Usuario"
        autoCapitalize="none"
        value={usuario}
        onChangeText={setUsuario}
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={contrasena}
        onChangeText={setContrasena}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Ingresar" onPress={manejarLogin} />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fff",
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: {
    color: "red",
    textAlign: "center",
  },
  ayuda: {
    marginTop: 12,
    textAlign: "center",
    color: "#888",
    fontSize: 12,
  },
});