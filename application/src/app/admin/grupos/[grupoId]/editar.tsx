import { gruposService } from "@/services/gruposService";
import type { Grupo } from "@/types/grupo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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

export default function EditarGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const router = useRouter();

  const [nombreGrupo, setNombreGrupo] = useState("");
  const [lineas, setLineas] = useState(""); // texto separado por comas, ej: "231, 232"
  const [nombreRepresentante, setNombreRepresentante] = useState("");
  const [telefonoRepresentante, setTelefonoRepresentante] = useState("");
  const [codigoRepresentante, setCodigoRepresentante] = useState("");
  const [passwordRepresentante, setPasswordRepresentante] = useState("");
  const [representanteExistente, setRepresentanteExistente] = useState(false);
  const [desasignarRepresentante, setDesasignarRepresentante] = useState(false);
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [seleccionandoJefe, setSeleccionandoJefe] = useState(false);
  const [asignandoJefeId, setAsignandoJefeId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const precargar = useCallback(async () => {
    if (!grupoId) return;
    try {
      const grupo = await gruposService.obtener(grupoId);
      setGrupo(grupo);
      setNombreGrupo(grupo.nombre);
      setLineas(grupo.lineas.join(", "));
      setRepresentanteExistente(Boolean(grupo.representante));
      setDesasignarRepresentante(false);
      if (grupo.representante) {
        setNombreRepresentante(grupo.representante.nombre);
        setTelefonoRepresentante(grupo.representante.telefono);
      } else {
        setNombreRepresentante("");
        setTelefonoRepresentante("");
      }
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "No se pudo cargar el grupo",
      );
    } finally {
      setCargando(false);
    }
  }, [grupoId]);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      precargar();
    }, [precargar]),
  );

  const representanteIniciado = Boolean(
    !representanteExistente &&
    (nombreRepresentante.trim() ||
      telefonoRepresentante.trim() ||
      codigoRepresentante.trim() ||
      passwordRepresentante),
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

  const handleGuardar = async () => {
    if (!grupoId || !esValido) {
      Alert.alert(
        "Faltan datos",
        !nombreGrupo.trim()
          ? "Completa el nombre del grupo."
          : "Completa nombre y teléfono; para un representante nuevo también se requiere código y contraseña de al menos 6 caracteres.",
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
        representante: representanteExistente
          ? desasignarRepresentante
            ? null
            : undefined
          : representanteIniciado
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
        e instanceof Error ? e.message : "No se pudo guardar",
      );
    } finally {
      setGuardando(false);
    }
  };

  const seleccionarJefe = async (conductorId: string, nombre: string) => {
    if (!grupoId) return;
    setAsignandoJefeId(conductorId);
    try {
      const resultado = await gruposService.asignarJefeExistente(
        grupoId,
        conductorId,
      );
      setNombreRepresentante(resultado.representante.nombre || nombre);
      setTelefonoRepresentante(resultado.representante.telefono ?? "");
      setRepresentanteExistente(true);
      setDesasignarRepresentante(false);
      setSeleccionandoJefe(false);
    } catch (error) {
      Alert.alert(
        "No se pudo asignar el jefe",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setAsignandoJefeId(null);
    }
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (seleccionandoJefe) {
    const conductoresActivos =
      grupo?.choferes.filter((conductor) => conductor.activo) ?? [];
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16 }}
      >
        <TouchableOpacity
          onPress={() => setSeleccionandoJefe(false)}
          accessibilityRole="button"
        >
          <Text style={styles.backLink}>Volver al formulario</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Asignar jefe</Text>
        <Text style={styles.pickerSubtitle}>
          Conductores activos disponibles
        </Text>
        {conductoresActivos.length ? (
          conductoresActivos.map((conductor) => (
            <TouchableOpacity
              key={conductor.id}
              style={styles.driverOption}
              onPress={() =>
                void seleccionarJefe(conductor.id, conductor.nombre)
              }
              disabled={asignandoJefeId !== null}
              accessibilityRole="button"
            >
              <View style={styles.driverMark} />
              <View style={styles.driverCopy}>
                <Text style={styles.driverName}>{conductor.nombre}</Text>
                <Text style={styles.driverMeta}>
                  {conductor.rutas.length} ruta(s) asignada(s)
                </Text>
              </View>
              {asignandoJefeId === conductor.id ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={styles.driverSelect}>Asignar</Text>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>
            No hay conductores activos en este grupo.
          </Text>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
      >
        <Text style={styles.backLink}>Volver al grupo</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Editar grupo</Text>

      <Text style={styles.label}>Nombre del grupo</Text>
      <TextInput
        style={styles.input}
        value={nombreGrupo}
        onChangeText={setNombreGrupo}
        maxLength={20}
      />

      <Text style={styles.label}>Líneas (separadas por coma)</Text>
      <TextInput style={styles.input} value={lineas} editable={false} />

      <Text style={styles.sectionTitle}>Representante</Text>
      <TouchableOpacity
        style={styles.assignButton}
        onPress={() => setSeleccionandoJefe(true)}
        accessibilityRole="button"
      >
        <Text style={styles.assignButtonText}>Asignar jefe existente</Text>
      </TouchableOpacity>

      {representanteExistente ? (
        <View style={styles.representanteActual}>
          <Text style={styles.representanteNombre}>{nombreRepresentante}</Text>
          <Text style={styles.representanteTelefono}>
            {telefonoRepresentante || "Sin teléfono"}
          </Text>
          <Text style={styles.credentialNote}>
            El código y la contraseña del representante no se pueden modificar
            aquí.
          </Text>
          <TouchableOpacity
            style={[
              styles.unassignButton,
              desasignarRepresentante && styles.keepButton,
            ]}
            onPress={() => setDesasignarRepresentante((current) => !current)}
          >
            <Text
              style={[
                styles.unassignButtonText,
                desasignarRepresentante && styles.keepButtonText,
              ]}
            >
              {desasignarRepresentante
                ? "Cancelar desasignación"
                : "Desasignar representante"}
            </Text>
          </TouchableOpacity>
          {desasignarRepresentante && (
            <Text style={styles.warningText}>
              Guarda los cambios para desasignarlo. Después podrás asignar otro
              representante.
            </Text>
          )}
        </View>
      ) : (
        <>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombreRepresentante}
            onChangeText={setNombreRepresentante}
            maxLength={120}
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={telefonoRepresentante}
            onChangeText={setTelefonoRepresentante}
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
        </>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          (!esValido || guardando) && styles.buttonDisabled,
        ]}
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
  backLink: { color: "#2563eb", fontWeight: "600", marginBottom: 12 },
  representanteActual: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
  },
  representanteNombre: { color: "#111827", fontSize: 15, fontWeight: "700" },
  representanteTelefono: { color: "#4b5563", fontSize: 13, marginTop: 3 },
  credentialNote: { color: "#6b7280", fontSize: 12, marginTop: 10 },
  unassignButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#b91c1c",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  unassignButtonText: { color: "#b91c1c", fontWeight: "600", fontSize: 13 },
  keepButton: { borderColor: "#9ca3af" },
  keepButtonText: { color: "#374151" },
  warningText: { color: "#92400e", fontSize: 12, marginTop: 8 },
  pickerSubtitle: { color: "#6b7280", fontSize: 13, marginBottom: 12 },
  driverOption: {
    alignItems: "center",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 4,
  },
  driverMark: {
    backgroundColor: "#0f766e",
    borderRadius: 3,
    height: 30,
    width: 4,
  },
  driverCopy: { flex: 1 },
  driverName: { color: "#1f2937", fontSize: 14, fontWeight: "600" },
  driverMeta: { color: "#6b7280", fontSize: 12, marginTop: 3 },
  driverSelect: { color: "#0f766e", fontSize: 13, fontWeight: "700" },
  emptyText: { color: "#6b7280", paddingVertical: 14 },
  assignButton: {
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  assignButtonText: { color: "#047857", fontSize: 13, fontWeight: "700" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
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
