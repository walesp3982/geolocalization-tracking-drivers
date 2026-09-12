import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { gruposService } from "@/services/gruposService";
import { Grupo } from "@/types/grupo";

export default function DetalleGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const router = useRouter();
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!grupoId) return;
    try {
      setError(null);
      const data = await gruposService.obtener(grupoId);
      setGrupo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el grupo");
    } finally {
      setLoading(false);
    }
  }, [grupoId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error || !grupo) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Grupo no encontrado"}</Text>
      </SafeAreaView>
    );
  }

  const choferesActivos = grupo.choferes.filter((c) => c.activo);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{grupo.nombre}</Text>
      <Text style={styles.subtitle}>
        {grupo.representante
          ? `Representante del grupo: ${grupo.representante.nombre} · ${grupo.representante.telefono}`
          : "Sin representante asignado"}
      </Text>

      <Text style={styles.sectionTitle}>Choferes</Text>

      <FlatList
        data={choferesActivos}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Este grupo todavía no tiene choferes activos.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.nombre}</Text>
            <Text style={styles.cardSubtitle}>
              {item.rutas.length} ruta(s) asignada(s)
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#4b5563", marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: "#4b5563" },
  emptyText: { textAlign: "center", color: "#6b7280", marginTop: 20 },
  errorText: { color: "#dc2626" },
});