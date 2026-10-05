import { gruposService } from "@/services/gruposService";
import type { CrearRutaPayload, PuntoControlPayload } from "@/types/grupo";
import { File as ExpoFile } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Coordinate = [number, number];
type ControlPointDraft = {
  longitud: string;
  latitud: string;
  radio: string;
  cantidad: string;
};

function getLineCoordinates(parsed: unknown): Coordinate[] {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("El archivo no contiene un GeoJSON válido.");
  }
  const root = parsed as {
    type?: unknown;
    geometry?: unknown;
    features?: unknown;
  };
  let geometry: unknown = root;

  if (root.type === "Feature") {
    geometry = root.geometry;
  } else if (root.type === "FeatureCollection") {
    if (!Array.isArray(root.features) || root.features.length !== 1) {
      throw new Error("El FeatureCollection debe contener una sola ruta.");
    }
    const feature = root.features[0] as { geometry?: unknown };
    geometry = feature?.geometry;
  }

  if (!geometry || typeof geometry !== "object") {
    throw new Error("No se encontró la geometría de la ruta.");
  }
  const line = geometry as { type?: unknown; coordinates?: unknown };
  if (line.type !== "LineString" || !Array.isArray(line.coordinates)) {
    throw new Error("La geometría del archivo debe ser una LineString.");
  }

  const coordinates = line.coordinates.map((coordinate): Coordinate => {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      typeof coordinate[0] !== "number" ||
      typeof coordinate[1] !== "number" ||
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1]) ||
      coordinate[0] < -180 ||
      coordinate[0] > 180 ||
      coordinate[1] < -90 ||
      coordinate[1] > 90
    ) {
      throw new Error("Hay coordenadas inválidas. Usa [longitud, latitud].");
    }
    return [coordinate[0], coordinate[1]];
  });

  if (coordinates.length < 2) {
    throw new Error("La ruta necesita al menos dos coordenadas.");
  }
  return coordinates;
}

function readControlPoints(
  drafts: ControlPointDraft[],
): PuntoControlPayload[] {
  return drafts.map((point, index) => {
    const longitud = Number(point.longitud.trim());
    const latitud = Number(point.latitud.trim());
    const radio = Number(point.radio.trim());
    const cantidad = Number(point.cantidad.trim());
    if (
      !point.longitud.trim() ||
      !point.latitud.trim() ||
      !point.radio.trim() ||
      !point.cantidad.trim() ||
      !Number.isFinite(longitud) ||
      !Number.isFinite(latitud) ||
      !Number.isFinite(radio) ||
      !Number.isInteger(cantidad) ||
      longitud < -180 ||
      longitud > 180 ||
      latitud < -90 ||
      latitud > 90 ||
      radio <= 0 ||
      cantidad < 1
    ) {
      throw new Error(`Completa correctamente las coordenadas y cantidades del punto ${index + 1}.`);
    }
    return {
      coordenadas: [longitud, latitud],
      radio,
      n_puntos_relativo: cantidad,
    };
  });
}

function RoutePreview({
  coordinates,
  controlPoints,
}: {
  coordinates: Coordinate[];
  controlPoints: PuntoControlPayload[];
}) {
  const [width, setWidth] = useState(0);
  const height = 190;
  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };
  const allCoordinates = [
    ...coordinates,
    ...controlPoints.map((point) => point.coordenadas),
  ];
  const longitudes = allCoordinates.map(([longitude]) => longitude);
  const latitudes = allCoordinates.map(([, latitude]) => latitude);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes) || 0.0001;
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes) || 0.0001;
  const pad = 22;
  const innerWidth = Math.max(0, width - pad * 2);
  const innerHeight = height - pad * 2;
  const position = ([longitude, latitude]: Coordinate) => ({
    x: pad + ((longitude - Math.min(...longitudes)) / longitudeSpan) * innerWidth,
    y: height - pad - ((latitude - Math.min(...latitudes)) / latitudeSpan) * innerHeight,
  });
  const linePoints = coordinates.map(position);
  const controls = controlPoints.map((point) => position(point.coordenadas));

  return (
    <View style={styles.previewMap} onLayout={onLayout}>
      {[0, 1, 2, 3].map((line) => (
        <View key={`grid-${line}`} style={[styles.gridLine, { top: `${(line + 1) * 20}%` }]} />
      ))}
      {linePoints.slice(1).map((end, index) => {
        const start = linePoints[index];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        return (
          <View
            key={`segment-${index}`}
            style={[
              styles.routeSegment,
              {
                left: (start.x + end.x - length) / 2,
                top: (start.y + end.y - 3) / 2,
                width: length,
                transform: [{ rotate: `${angle}rad` }],
              },
            ]}
          />
        );
      })}
      {linePoints.map((point, index) => (
        <View
          key={`vertex-${index}`}
          style={[
            styles.routeVertex,
            index === 0 && styles.startVertex,
            index === linePoints.length - 1 && styles.endVertex,
            { left: point.x - 5, top: point.y - 5 },
          ]}
        />
      ))}
      {controls.map((point, index) => (
        <View
          key={`control-${index}`}
          style={[styles.controlVertex, { left: point.x - 6, top: point.y - 6 }]}
        >
          <Text style={styles.controlNumber}>{index + 1}</Text>
        </View>
      ))}
      <View style={styles.previewLegend}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>Ruta</Text>
        <View style={styles.legendControl} />
        <Text style={styles.legendText}>Puntos control</Text>
      </View>
    </View>
  );
}

export default function CrearRutaScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const router = useRouter();
  const [numeroRuta, setNumeroRuta] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [duracion, setDuracion] = useState("");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinate[] | null>(null);
  const [controlPoints, setControlPoints] = useState<ControlPointDraft[]>([
    { longitud: "", latitud: "", radio: "50", cantidad: "1" },
  ]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const elegirGeoJSON = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/geo+json", "application/json", "application/octet-stream"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith(".geojson")) {
        throw new Error("Selecciona un archivo con extensión .geojson.");
      }
      const text = asset.file
        ? await asset.file.text()
        : await new ExpoFile(asset.uri).text();
      const parsed: unknown = JSON.parse(text);
      const parsedCoordinates = getLineCoordinates(parsed);
      setCoordinates(parsedCoordinates);
      setArchivoNombre(asset.name);
      setPreviewVisible(false);
    } catch (error) {
      Alert.alert(
        "GeoJSON inválido",
        error instanceof Error ? error.message : "No se pudo leer el archivo.",
      );
    }
  };

  const construirPuntos = () => readControlPoints(controlPoints);
  const preview = () => {
    try {
      if (!coordinates) throw new Error("Selecciona primero el archivo GeoJSON.");
      if (!numeroRuta.trim() || !origen.trim() || !destino.trim()) {
        throw new Error("Completa número de ruta, origen y destino.");
      }
      if (!controlPoints.length) {
        throw new Error("Agrega al menos un punto de control.");
      }
      if (duracion.trim() && (!Number.isInteger(Number(duracion)) || Number(duracion) < 1)) {
        throw new Error("La duración debe ser un número entero mayor que cero.");
      }
      construirPuntos();
      setPreviewVisible(true);
    } catch (error) {
      Alert.alert(
        "No se puede previsualizar",
        error instanceof Error ? error.message : "Revisa los datos ingresados.",
      );
      setPreviewVisible(false);
    }
  };

  const enviar = async () => {
    if (!grupoId || !coordinates || !previewVisible) return;
    let points: PuntoControlPayload[];
    try {
      points = construirPuntos();
    } catch (error) {
      Alert.alert("Revisa los puntos", error instanceof Error ? error.message : "Datos inválidos.");
      setPreviewVisible(false);
      return;
    }
    setGuardando(true);
    try {
      const payload: CrearRutaPayload = {
        numero_ruta: numeroRuta.trim(),
        lugar_inicial: origen.trim(),
        lugar_final: destino.trim(),
        tiempo_estimado: duracion.trim() ? Number(duracion) : undefined,
        geojson: {
          type: "Feature",
          geometry: { type: "LineString", coordinates },
        },
        puntos_control: points,
      };
      await gruposService.crearRuta(grupoId, payload);
      Alert.alert("Ruta creada", "La ruta quedó registrada en el grupo.", [
        { text: "Aceptar", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        "No se pudo crear la ruta",
        error instanceof Error ? error.message : "Intenta nuevamente.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const actualizarPunto = (
    index: number,
    field: keyof ControlPointDraft,
    value: string,
  ) => {
    setControlPoints((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [field]: value } : point,
      ),
    );
    setPreviewVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Volver al grupo</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nueva ruta</Text>
        <Text style={styles.subtitle}>El archivo se valida localmente antes de enviarlo.</Text>

        <Text style={styles.label}>Número de ruta</Text>
        <TextInput
          style={styles.input}
          value={numeroRuta}
          onChangeText={(value) => {
            setNumeroRuta(value);
            setPreviewVisible(false);
          }}
          maxLength={10}
        />
        <View style={styles.twoColumns}>
          <View style={styles.column}>
            <Text style={styles.label}>Origen</Text>
            <TextInput
              style={styles.input}
              value={origen}
              onChangeText={(value) => {
                setOrigen(value);
                setPreviewVisible(false);
              }}
            />
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Destino</Text>
            <TextInput
              style={styles.input}
              value={destino}
              onChangeText={(value) => {
                setDestino(value);
                setPreviewVisible(false);
              }}
            />
          </View>
        </View>
        <Text style={styles.label}>Duración estimada en minutos (opcional)</Text>
        <TextInput
          style={styles.input}
          value={duracion}
          onChangeText={(value) => {
            setDuracion(value);
            setPreviewVisible(false);
          }}
          keyboardType="number-pad"
        />

        <Text style={styles.sectionTitle}>Trazado GeoJSON</Text>
        <TouchableOpacity style={styles.fileButton} onPress={elegirGeoJSON} accessibilityRole="button">
          <Text style={styles.fileButtonText}>{archivoNombre || "Seleccionar archivo .geojson"}</Text>
        </TouchableOpacity>
        {coordinates ? (
          <Text style={styles.fileSummary}>{coordinates.length} coordenadas de trazado cargadas</Text>
        ) : null}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Puntos de control</Text>
            <Text style={styles.helper}>Longitud, latitud, radio y cantidad relativa.</Text>
          </View>
          <TouchableOpacity
            style={styles.addPointButton}
            onPress={() => {
              setControlPoints((current) => [
                ...current,
                { longitud: "", latitud: "", radio: "50", cantidad: "1" },
              ]);
              setPreviewVisible(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.addPointText}>+ Punto</Text>
          </TouchableOpacity>
        </View>

        {controlPoints.map((point, index) => (
          <View style={styles.pointBlock} key={`point-${index}`}>
            <View style={styles.pointHeading}>
              <Text style={styles.pointTitle}>Punto {index + 1}</Text>
              {controlPoints.length > 1 ? (
                <TouchableOpacity
                  onPress={() => {
                    setControlPoints((current) => current.filter((_, item) => item !== index));
                    setPreviewVisible(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.removeText}>Quitar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Longitud</Text>
                <TextInput
                  style={styles.input}
                  value={point.longitud}
                  onChangeText={(value) => actualizarPunto(index, "longitud", value)}
                  keyboardType="decimal-pad"
                  placeholder="-70.123"
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Latitud</Text>
                <TextInput
                  style={styles.input}
                  value={point.latitud}
                  onChangeText={(value) => actualizarPunto(index, "latitud", value)}
                  keyboardType="decimal-pad"
                  placeholder="-33.456"
                />
              </View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Radio en metros</Text>
                <TextInput
                  style={styles.input}
                  value={point.radio}
                  onChangeText={(value) => actualizarPunto(index, "radio", value)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Cantidad relativa</Text>
                <TextInput
                  style={styles.input}
                  value={point.cantidad}
                  onChangeText={(value) => actualizarPunto(index, "cantidad", value)}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.previewButton} onPress={preview} accessibilityRole="button">
          <Text style={styles.previewButtonText}>Previsualizar ruta</Text>
        </TouchableOpacity>

        {previewVisible && coordinates ? (
          <View style={styles.previewPanel}>
            <View style={styles.previewHeading}>
              <Text style={styles.previewTitle}>{numeroRuta.trim()} · {origen.trim()} a {destino.trim()}</Text>
              <Text style={styles.previewMeta}>{coordinates.length} vértices · {controlPoints.length} puntos control</Text>
            </View>
            <RoutePreview coordinates={coordinates} controlPoints={construirPuntos()} />
            <Text style={styles.coordinateHeading}>Coordenadas del trazado · [longitud, latitud]</Text>
            <ScrollView style={styles.coordinateList} nestedScrollEnabled>
              {coordinates.map(([longitude, latitude], index) => (
                <Text style={styles.coordinateRow} key={`coord-${index}`}>
                  {String(index + 1).padStart(2, "0")}   {longitude}, {latitude}
                </Text>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.sendButton, guardando && styles.disabledButton]}
              onPress={enviar}
              disabled={guardando}
              accessibilityRole="button"
            >
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>Enviar al backend</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#fff", flex: 1 },
  content: { gap: 5, padding: 18, paddingBottom: 38 },
  back: { color: "#2563eb", fontWeight: "600", marginBottom: 8 },
  title: { color: "#111827", fontSize: 23, fontWeight: "700" },
  subtitle: { color: "#6b7280", fontSize: 13, marginBottom: 8 },
  label: { color: "#374151", fontSize: 13, fontWeight: "600", marginTop: 9, marginBottom: 4 },
  input: { backgroundColor: "#fff", borderColor: "#d1d5db", borderRadius: 7, borderWidth: 1, color: "#111827", minWidth: 0, paddingHorizontal: 10, paddingVertical: 10 },
  twoColumns: { flexDirection: "row", gap: 10 },
  column: { flex: 1, minWidth: 0 },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "700", marginTop: 17 },
  fileButton: { alignItems: "flex-start", backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", borderRadius: 7, borderWidth: 1, marginTop: 7, padding: 12 },
  fileButtonText: { color: "#1f2937", fontWeight: "600" },
  fileSummary: { color: "#047857", fontSize: 12, marginTop: 6 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  helper: { color: "#6b7280", fontSize: 12, marginTop: 3 },
  addPointButton: { borderColor: "#0f766e", borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  addPointText: { color: "#0f766e", fontSize: 12, fontWeight: "700" },
  pointBlock: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 11 },
  pointHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  pointTitle: { color: "#334155", fontSize: 13, fontWeight: "700" },
  removeText: { color: "#b91c1c", fontSize: 12, fontWeight: "600" },
  smallLabel: { color: "#64748b", fontSize: 11, marginBottom: 4, marginTop: 6 },
  previewButton: { alignItems: "center", backgroundColor: "#0f766e", borderRadius: 7, marginTop: 17, padding: 13 },
  previewButtonText: { color: "#fff", fontWeight: "700" },
  previewPanel: { borderColor: "#cbd5e1", borderRadius: 9, borderWidth: 1, marginTop: 16, padding: 12 },
  previewHeading: { marginBottom: 10 },
  previewTitle: { color: "#111827", fontSize: 15, fontWeight: "700" },
  previewMeta: { color: "#64748b", fontSize: 12, marginTop: 4 },
  previewMap: { backgroundColor: "#f2f7f2", borderColor: "#dbe7dc", borderRadius: 7, borderWidth: 1, height: 190, overflow: "hidden", position: "relative" },
  gridLine: { backgroundColor: "#e1ebe2", height: StyleSheet.hairlineWidth, left: 0, position: "absolute", right: 0 },
  routeSegment: { backgroundColor: "#0f766e", height: 3, position: "absolute" },
  routeVertex: { backgroundColor: "#0f766e", borderColor: "#fff", borderRadius: 6, borderWidth: 1, height: 10, position: "absolute", width: 10 },
  startVertex: { backgroundColor: "#16a34a" },
  endVertex: { backgroundColor: "#dc2626" },
  controlVertex: { alignItems: "center", backgroundColor: "#f59e0b", borderColor: "#fff", borderRadius: 10, borderWidth: 1, height: 14, justifyContent: "center", position: "absolute", width: 14 },
  controlNumber: { color: "#fff", fontSize: 8, fontWeight: "700" },
  previewLegend: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 5, bottom: 7, flexDirection: "row", gap: 6, paddingHorizontal: 7, paddingVertical: 5, position: "absolute", right: 7 },
  legendDot: { backgroundColor: "#0f766e", borderRadius: 3, height: 6, width: 12 },
  legendControl: { backgroundColor: "#f59e0b", borderRadius: 5, height: 9, marginLeft: 7, width: 9 },
  legendText: { color: "#475569", fontSize: 10 },
  coordinateHeading: { color: "#374151", fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 5 },
  coordinateList: { backgroundColor: "#f8fafc", borderRadius: 6, maxHeight: 132, paddingHorizontal: 9 },
  coordinateRow: { color: "#475569", fontFamily: "monospace", fontSize: 11, paddingVertical: 4 },
  sendButton: { alignItems: "center", backgroundColor: "#1d4ed8", borderRadius: 7, marginTop: 13, padding: 14 },
  disabledButton: { opacity: 0.55 },
  sendButtonText: { color: "#fff", fontWeight: "700" },
});
