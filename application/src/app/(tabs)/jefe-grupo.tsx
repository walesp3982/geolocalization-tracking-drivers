import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from "react-native";

import { Colors } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import {
    AsignacionesDeRuta,
    JefeConductor,
    jefeGrupoService,
    JefeRuta,
    RutaAsignacion,
} from "@/services/jefeGrupoService";

type PanelSection = "agenda" | "conductores";

type RutaConAsignaciones = {
  ruta: JefeRuta;
  asignaciones: RutaAsignacion[];
};

const ACCENT = "#18745B";
const WARNING = "#A65B18";

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialTimeValue(): string {
  const date = new Date(currentTimestamp() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function currentTimestamp(): number {
  return Date.now();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horario no disponible";
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Ocurrió un error inesperado.";
  try {
    const detail = JSON.parse(error.message) as { detail?: string };
    if (detail.detail) return detail.detail;
  } catch {
    return error.message;
  }
  return error.message;
}

export default function JefeGrupoScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];
  const { user } = useAuth();
  const [section, setSection] = useState<PanelSection>("agenda");
  const [conductores, setConductores] = useState<JefeConductor[]>([]);
  const [rutas, setRutas] = useState<RutaConAsignaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [expandedRouteId, setExpandedRouteId] = useState<number | null>(null);
  const [selectedDriverByRoute, setSelectedDriverByRoute] = useState<
    Record<number, number>
  >({});
  const [dateByRoute, setDateByRoute] = useState<Record<number, string>>({});
  const [timeByRoute, setTimeByRoute] = useState<Record<number, string>>({});
  const [assigningRouteId, setAssigningRouteId] = useState<number | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const [driversResponse, routesResponse] = await Promise.all([
        jefeGrupoService.listarConductores(),
        jefeGrupoService.listarRutas(),
      ]);
      const routeDetails: AsignacionesDeRuta[] = await Promise.all(
        routesResponse.map((route) =>
          jefeGrupoService.listarAsignacionesRuta(route.id_ruta),
        ),
      );

      setConductores(driversResponse.conductores);
      setRutas(
        routesResponse.map((ruta, index) => ({
          ruta,
          asignaciones: routeDetails[index]?.asignaciones ?? [],
        })),
      );
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void loadDashboard(), 0);
    return () => clearTimeout(timeout);
  }, [loadDashboard]);

  const activeDrivers = conductores.filter((conductor) => conductor.activo);

  const submitNewDriver = async () => {
    if (!newName.trim() || !newPassword.trim()) {
      Alert.alert("Datos incompletos", "Ingresa el nombre y una contraseña.");
      return;
    }

    setCreating(true);
    try {
      const conductor = await jefeGrupoService.crearConductor({
        nombre: newName.trim(),
        telefono: newPhone.trim(),
        password: newPassword,
      });
      setNewName("");
      setNewPhone("");
      setNewPassword("");
      setShowCreateForm(false);
      await loadDashboard(true);
      Alert.alert(
        "Conductor creado",
        `${conductor.name} ya pertenece al grupo. Su código de acceso es ${conductor.code}.`,
      );
    } catch (error) {
      Alert.alert("No se pudo crear", errorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const assignDriver = async (routeId: number) => {
    const driverId = selectedDriverByRoute[routeId];
    const date = dateByRoute[routeId] ?? localDateValue(new Date());
    const time = timeByRoute[routeId] ?? initialTimeValue();
    const localDateTime = new Date(`${date}T${time}:00`);

    if (!driverId) {
      Alert.alert("Selecciona un conductor", "Elige quién cubrirá esta ruta.");
      return;
    }
    if (
      Number.isNaN(localDateTime.getTime()) ||
      localDateTime.getTime() <= currentTimestamp()
    ) {
      Alert.alert("Horario inválido", "La fecha y hora deben ser futuras.");
      return;
    }

    setAssigningRouteId(routeId);
    try {
      await jefeGrupoService.asignarRuta(
        routeId,
        driverId,
        localDateTime.toISOString(),
      );
      setExpandedRouteId(null);
      await loadDashboard(true);
      Alert.alert(
        "Turno asignado",
        "La asignación quedó registrada correctamente.",
      );
    } catch (error) {
      Alert.alert("No se pudo asignar", errorMessage(error));
    } finally {
      setAssigningRouteId(null);
    }
  };

  const getRouteConflicts = (route: JefeRuta, driverId: number) => {
    const date = dateByRoute[route.id_ruta] ?? localDateValue(new Date());
    const time = timeByRoute[route.id_ruta] ?? initialTimeValue();
    const candidateStart = new Date(`${date}T${time}:00`).getTime();
    const duration = (route.tiempo_estimado ?? 60) * 60 * 1000;
    const candidateEnd = candidateStart + duration;

    return rutas.flatMap(({ ruta, asignaciones }) =>
      asignaciones
        .filter((assignment) => assignment.id_conductor === driverId)
        .filter((assignment) => {
          const sameRouteSameDay =
            ruta.id_ruta === route.id_ruta &&
            new Date(assignment.fecha_hora_inicio).toISOString().slice(0, 10) ===
              new Date(candidateStart).toISOString().slice(0, 10);
          if (sameRouteSameDay) return false;

          const assignmentStart = new Date(
            assignment.fecha_hora_inicio,
          ).getTime();
          const assignmentEnd = assignment.fecha_hora_fin
            ? new Date(assignment.fecha_hora_fin).getTime()
            : assignmentStart + (ruta.tiempo_estimado ?? 60) * 60 * 1000;
          return (
            candidateStart < assignmentEnd && assignmentStart < candidateEnd
          );
        })
        .map((assignment) => ({ ruta, assignment })),
    );
  };

  const panelText = { color: colors.text };
  const mutedText = { color: colors.textSecondary };
  const surface = { backgroundColor: colors.backgroundElement };

  if (user?.is_jefe_grupo !== true) {
    return <Redirect href="/(tabs)" />;
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={[styles.loadingText, mutedText]}>
          Cargando operaciones del grupo
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadDashboard(true)}
          tintColor={ACCENT}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: ACCENT }]}>
            GRUPO {user?.id_group ?? ""}
          </Text>
          <Text style={[styles.title, panelText]}>Operaciones</Text>
          <Text style={[styles.greeting, mutedText]}>
            Jefe de grupo · {user?.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Actualizar panel"
          onPress={() => void loadDashboard(true)}
          style={[styles.refreshButton, surface]}
        >
          <Text style={[styles.refreshText, panelText]}>↻</Text>
        </Pressable>
      </View>

      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => void loadDashboard(true)}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.metricsRow}>
        <View style={[styles.metric, surface]}>
          <Text style={[styles.metricValue, panelText]}>
            {activeDrivers.length}
          </Text>
          <Text style={[styles.metricLabel, mutedText]}>
            Conductores activos
          </Text>
        </View>
        <View style={[styles.metric, surface]}>
          <Text style={[styles.metricValue, panelText]}>{rutas.length}</Text>
          <Text style={[styles.metricLabel, mutedText]}>Rutas del grupo</Text>
        </View>
      </View>

      <View style={[styles.segment, surface]}>
        <Pressable
          onPress={() => setSection("agenda")}
          style={[
            styles.segmentButton,
            section === "agenda" && styles.segmentSelected,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              section === "agenda" && styles.segmentTextSelected,
            ]}
          >
            Agenda y rutas
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSection("conductores")}
          style={[
            styles.segmentButton,
            section === "conductores" && styles.segmentSelected,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              section === "conductores" && styles.segmentTextSelected,
            ]}
          >
            Conductores
          </Text>
        </Pressable>
      </View>

      {section === "agenda" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, panelText]}>
                Cobertura de rutas
              </Text>
              <Text style={[styles.sectionCaption, mutedText]}>
                Turnos y disponibilidad del equipo
              </Text>
            </View>
            <Text style={[styles.sectionCount, { color: ACCENT }]}>
              {rutas.length}
            </Text>
          </View>

          {rutas.length === 0 ? (
            <View style={[styles.emptyState, surface]}>
              <Text style={[styles.emptyTitle, panelText]}>
                Sin rutas registradas
              </Text>
              <Text style={[styles.emptyText, mutedText]}>
                Las rutas del grupo aparecerán aquí.
              </Text>
            </View>
          ) : (
            rutas.map(({ ruta, asignaciones }) => {
              const expanded = expandedRouteId === ruta.id_ruta;
              const selectedDriverId = selectedDriverByRoute[ruta.id_ruta];
              const conflicts = selectedDriverId
                ? getRouteConflicts(ruta, selectedDriverId)
                : [];
              const availableDrivers = activeDrivers.filter(
                (driver) =>
                  getRouteConflicts(ruta, driver.id_conductor).length === 0,
              );

              return (
                <View key={ruta.id_ruta} style={[styles.routeCard, surface]}>
                  <View style={styles.routeTopline}>
                    <View style={styles.routeNumberWrap}>
                      <Text style={styles.routeNumber}>{ruta.numero_ruta}</Text>
                    </View>
                    <View style={styles.routeInfo}>
                      <Text
                        style={[styles.routeTitle, panelText]}
                        numberOfLines={1}
                      >
                        {ruta.lugar_initial} → {ruta.lugar_final}
                      </Text>
                      <Text style={[styles.routeMeta, mutedText]}>
                        {ruta.tiempo_estimado
                          ? `${ruta.tiempo_estimado} min estimados`
                          : "Duración estimada: 60 min"}
                        {` · ${asignaciones.length} turnos`}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setExpandedRouteId(expanded ? null : ruta.id_ruta);
                        if (!dateByRoute[ruta.id_ruta]) {
                          setDateByRoute((current) => ({
                            ...current,
                            [ruta.id_ruta]: localDateValue(new Date()),
                          }));
                        }
                        if (!timeByRoute[ruta.id_ruta]) {
                          setTimeByRoute((current) => ({
                            ...current,
                            [ruta.id_ruta]: initialTimeValue(),
                          }));
                        }
                      }}
                      style={styles.routeAction}
                    >
                      <Text style={styles.routeActionText}>
                        {expanded ? "Cerrar" : "+ Turno"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.coverageLine}>
                    <Text style={[styles.coverageLabel, mutedText]}>
                      {expanded
                        ? `${availableDrivers.length} de ${activeDrivers.length} disponibles para el horario elegido`
                        : `${asignaciones.length} turnos programados · abre “+ Turno” para revisar disponibilidad`}
                    </Text>
                  </View>

                  {asignaciones.length > 0 ? (
                    <View style={styles.assignmentList}>
                      {asignaciones.map((assignment) => (
                        <View
                          key={assignment.id_asignacion}
                          style={styles.assignmentRow}
                        >
                          <View style={styles.assignmentMarker} />
                          <View style={styles.assignmentDetails}>
                            <Text style={[styles.assignmentName, panelText]}>
                              {assignment.conductor.name}
                              {!assignment.conductor.activo
                                ? " · Inactivo"
                                : ""}
                            </Text>
                            <Text style={[styles.assignmentTime, mutedText]}>
                              {formatDateTime(assignment.fecha_hora_inicio)}
                              {` – ${new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date(assignment.fecha_hora_fin ?? assignment.fecha_hora_fin_estimada))}`}
                              {!assignment.fecha_hora_fin ? " (estimado)" : ""}
                            </Text>
                          </View>
                          <Text style={styles.assignmentStatus}>
                            {assignment.fecha_hora_fin
                              ? "Finalizado"
                              : assignment.fecha_hora_comienzo
                                ? "En curso"
                                : "Programado"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.noAssignments, mutedText]}>
                      Todavía no hay turnos programados.
                    </Text>
                  )}

                  {expanded ? (
                    <View style={styles.form}>
                      <Text style={[styles.formTitle, panelText]}>
                        Programar conductor
                      </Text>
                      <Text style={[styles.fieldLabel, mutedText]}>
                        Conductor disponible
                      </Text>
                      {activeDrivers.length === 0 ? (
                        <Text style={[styles.noAssignments, mutedText]}>
                          No hay conductores activos para asignar.
                        </Text>
                      ) : (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.driverChoices}
                        >
                          {activeDrivers.map((driver) => {
                            const driverConflicts = getRouteConflicts(
                              ruta,
                              driver.id_conductor,
                            );
                            const isSelected =
                              selectedDriverId === driver.id_conductor;
                            const unavailable = driverConflicts.length > 0;
                            return (
                              <Pressable
                                key={driver.id_conductor}
                                onPress={() =>
                                  setSelectedDriverByRoute((current) => ({
                                    ...current,
                                    [ruta.id_ruta]: driver.id_conductor,
                                  }))
                                }
                                style={[
                                  styles.driverChoice,
                                  {
                                    borderColor: isSelected
                                      ? ACCENT
                                      : colors.backgroundSelected,
                                  },
                                  isSelected && styles.driverChoiceSelected,
                                  unavailable && styles.driverChoiceUnavailable,
                                ]}
                              >
                                <Text
                                  style={[styles.driverChoiceName, panelText]}
                                  numberOfLines={1}
                                >
                                  {driver.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.driverChoiceStatus,
                                    { color: unavailable ? WARNING : ACCENT },
                                  ]}
                                >
                                  {unavailable ? "Ocupado" : "Disponible"}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      )}

                      {selectedDriverId && conflicts.length > 0 ? (
                        <Text style={styles.conflictText}>
                          Choque de horario:{" "}
                          {conflicts[0].assignment.conductor.name} ya está
                          asignado a {conflicts[0].ruta.numero_ruta}.
                        </Text>
                      ) : null}

                      <View style={styles.dateTimeRow}>
                        <View style={styles.dateField}>
                          <Text style={[styles.fieldLabel, mutedText]}>
                            Fecha
                          </Text>
                          <TextInput
                            value={
                              dateByRoute[ruta.id_ruta] ??
                              localDateValue(new Date())
                            }
                            onChangeText={(value) =>
                              setDateByRoute((current) => ({
                                ...current,
                                [ruta.id_ruta]: value,
                              }))
                            }
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor={colors.textSecondary}
                            style={[
                              styles.input,
                              panelText,
                              { borderColor: colors.backgroundSelected },
                            ]}
                            autoCapitalize="none"
                          />
                        </View>
                        <View style={styles.timeField}>
                          <Text style={[styles.fieldLabel, mutedText]}>
                            Hora local
                          </Text>
                          <TextInput
                            value={
                              timeByRoute[ruta.id_ruta] ?? initialTimeValue()
                            }
                            onChangeText={(value) =>
                              setTimeByRoute((current) => ({
                                ...current,
                                [ruta.id_ruta]: value,
                              }))
                            }
                            placeholder="HH:MM"
                            placeholderTextColor={colors.textSecondary}
                            style={[
                              styles.input,
                              panelText,
                              { borderColor: colors.backgroundSelected },
                            ]}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </View>
                      <Pressable
                        disabled={
                          assigningRouteId === ruta.id_ruta ||
                          conflicts.length > 0 ||
                          activeDrivers.length === 0
                        }
                        onPress={() => void assignDriver(ruta.id_ruta)}
                        style={[
                          styles.primaryButton,
                          (conflicts.length > 0 ||
                            activeDrivers.length === 0) &&
                            styles.primaryButtonDisabled,
                        ]}
                      >
                        {assigningRouteId === ruta.id_ruta ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryButtonText}>
                            Confirmar turno
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionTitle, panelText]}>
                Equipo de conductores
              </Text>
              <Text style={[styles.sectionCaption, mutedText]}>
                {activeDrivers.length} activos ·{" "}
                {conductores.length - activeDrivers.length} inactivos
              </Text>
            </View>
            <Pressable
              onPress={() => setShowCreateForm((value) => !value)}
              style={styles.routeAction}
            >
              <Text style={styles.routeActionText}>
                {showCreateForm ? "Cancelar" : "+ Agregar"}
              </Text>
            </Pressable>
          </View>

          {showCreateForm ? (
            <View style={[styles.createCard, surface]}>
              <Text style={[styles.formTitle, panelText]}>Nuevo conductor</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Nombre completo"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  panelText,
                  { borderColor: colors.backgroundSelected },
                ]}
                autoCapitalize="words"
              />
              <TextInput
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="Teléfono (opcional)"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  panelText,
                  { borderColor: colors.backgroundSelected },
                ]}
                keyboardType="phone-pad"
              />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Contraseña inicial"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  panelText,
                  { borderColor: colors.backgroundSelected },
                ]}
                secureTextEntry
              />
              <Pressable
                disabled={creating}
                onPress={() => void submitNewDriver()}
                style={styles.primaryButton}
              >
                {creating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Crear conductor</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {conductores.length === 0 ? (
            <View style={[styles.emptyState, surface]}>
              <Text style={[styles.emptyTitle, panelText]}>
                Aún no hay conductores
              </Text>
              <Text style={[styles.emptyText, mutedText]}>
                Agrega al primer conductor para organizar sus turnos.
              </Text>
            </View>
          ) : (
            conductores.map((conductor) => {
              const assignmentCount = rutas.reduce(
                (total, route) =>
                  total +
                  route.asignaciones.filter(
                    (item) => item.id_conductor === conductor.id_conductor,
                  ).length,
                0,
              );
              return (
                <View
                  key={conductor.id_conductor}
                  style={[styles.driverRow, surface]}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: conductor.activo
                          ? "#DDEFE8"
                          : colors.backgroundSelected,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        {
                          color: conductor.activo
                            ? ACCENT
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {conductor.name.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={[styles.driverName, panelText]}>
                      {conductor.name}
                    </Text>
                    <Text style={[styles.driverMeta, mutedText]}>
                      Código {conductor.code}
                      {conductor.telefono ? ` · ${conductor.telefono}` : ""}
                    </Text>
                  </View>
                  <View style={styles.driverStats}>
                    <Text style={[styles.driverShiftCount, panelText]}>
                      {assignmentCount}
                    </Text>
                    <Text style={[styles.driverMeta, mutedText]}>turnos</Text>
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: conductor.activo ? ACCENT : "#8D9299",
                      },
                    ]}
                  />
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 48,
    gap: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: "800", marginTop: 3 },
  greeting: { fontSize: 14, marginTop: 5 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: { fontSize: 27, lineHeight: 31 },
  errorBanner: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FBE9E6",
    gap: 8,
  },
  errorText: { color: "#8A2E24", fontSize: 13 },
  retryText: { color: "#8A2E24", fontWeight: "700", fontSize: 13 },
  metricsRow: { flexDirection: "row", gap: 9 },
  metric: {
    flex: 1,
    minHeight: 88,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 13,
    justifyContent: "space-between",
  },
  metricValue: { fontSize: 27, fontWeight: "800" },
  metricLabel: { fontSize: 11, lineHeight: 15 },
  segment: { padding: 4, borderRadius: 13, flexDirection: "row" },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentSelected: { backgroundColor: ACCENT },
  segmentText: { fontSize: 13, fontWeight: "700", color: "#60646C" },
  segmentTextSelected: { color: "#FFFFFF" },
  section: { gap: 13 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  sectionCaption: { fontSize: 12, marginTop: 3 },
  sectionCount: { fontSize: 14, fontWeight: "800" },
  routeCard: { borderRadius: 15, padding: 14, gap: 11 },
  routeTopline: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeNumberWrap: {
    width: 46,
    height: 42,
    borderRadius: 11,
    backgroundColor: "#DDEFE8",
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: { color: ACCENT, fontSize: 13, fontWeight: "800" },
  routeInfo: { flex: 1, minWidth: 0, gap: 4 },
  routeTitle: { fontSize: 14, fontWeight: "700" },
  routeMeta: { fontSize: 11 },
  routeAction: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#E2F1EB",
  },
  routeActionText: { color: ACCENT, fontSize: 12, fontWeight: "800" },
  coverageLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#A9B1AE",
    paddingTop: 9,
  },
  coverageLabel: { fontSize: 11 },
  assignmentList: { gap: 11 },
  assignmentRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  assignmentMarker: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  assignmentDetails: { flex: 1, gap: 3 },
  assignmentName: { fontSize: 13, fontWeight: "700" },
  assignmentTime: { fontSize: 11 },
  assignmentStatus: { fontSize: 10, color: ACCENT, fontWeight: "700" },
  noAssignments: { fontSize: 12, paddingVertical: 4 },
  form: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#A9B1AE",
    paddingTop: 13,
    gap: 10,
  },
  formTitle: { fontSize: 15, fontWeight: "800" },
  fieldLabel: { fontSize: 11, fontWeight: "700" },
  driverChoices: { gap: 8, paddingBottom: 2 },
  driverChoice: {
    width: 128,
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
    gap: 5,
  },
  driverChoiceSelected: { backgroundColor: "#E5F3ED" },
  driverChoiceUnavailable: { opacity: 0.75 },
  driverChoiceName: { fontSize: 12, fontWeight: "700" },
  driverChoiceStatus: { fontSize: 10, fontWeight: "700" },
  conflictText: { color: "#9B3C2F", fontSize: 12, lineHeight: 17 },
  dateTimeRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1.4, gap: 6 },
  timeField: { flex: 1, gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 45,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButtonDisabled: { backgroundColor: "#84968E" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  upcomingRow: {
    minHeight: 64,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  upcomingDate: {
    width: 48,
    minHeight: 38,
    borderRadius: 9,
    backgroundColor: "#DDEFE8",
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingRoute: { color: ACCENT, fontSize: 11, fontWeight: "800" },
  upcomingArrow: { fontSize: 24 },
  emptyState: { borderRadius: 14, padding: 18, gap: 5 },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  emptyText: { fontSize: 12, lineHeight: 17 },
  createCard: { borderRadius: 14, padding: 14, gap: 10 },
  driverRow: {
    minHeight: 68,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800" },
  driverDetails: { flex: 1, minWidth: 0, gap: 4 },
  driverName: { fontSize: 13, fontWeight: "700" },
  driverMeta: { fontSize: 10 },
  driverStats: { alignItems: "center", minWidth: 35 },
  driverShiftCount: { fontSize: 15, fontWeight: "800" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
