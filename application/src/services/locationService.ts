import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "background-location-task";

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  LOCATION_TASK_NAME,
  async ({ data, error }) => {
  if (error) {
    console.error("Error en la tarea de ubicación en segundo plano:", error);
    return;
  }

  if (!data?.locations.length) {
    return;
  }

  const ultimaUbicacion = data.locations[data.locations.length - 1];
  const { latitude, longitude } = ultimaUbicacion.coords;

  console.log("Ubicación en segundo plano:", latitude, longitude);
});

export async function iniciarRastreoUbicacion(): Promise<boolean> {
  const { status: fgStatus } =
    await Location.requestForegroundPermissionsAsync();

  if (fgStatus !== "granted") {
    console.warn("Permiso de ubicación en primer plano denegado");
    return false;
  }

  const { status: bgStatus } =
    await Location.requestBackgroundPermissionsAsync();

  if (bgStatus !== "granted") {
    console.warn("Permiso de ubicación en segundo plano denegado");
    return false;
  }

  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    console.log("El rastreo ya estaba activo");
    return true;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 20,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Rastreo de recorrido activo",
      notificationBody: "Se está monitoreando tu ubicación durante el recorrido.",
    },
  });

  console.log("✅ Rastreo de ubicación en segundo plano iniciado");
  return true;
}

export async function detenerRastreoUbicacion(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log("Rastreo de ubicación detenido");
  }
}