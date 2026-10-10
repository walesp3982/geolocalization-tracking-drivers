import { apiRequest } from "@/services/api";

export type JefeConductor = {
  id_conductor: number;
  name: string;
  id_group: number;
  code: string;
  telefono: string | null;
  activo: boolean;
};

export type JefeRuta = {
  id_ruta: number;
  id_grupo: number;
  numero_ruta: string;
  lugar_initial: string;
  lugar_final: string;
  tiempo_estimado: number | null;
};

export type RutaAsignacion = {
  id_asignacion: number;
  id_ruta: number;
  id_conductor: number;
  fecha_hora_inicio: string;
  fecha_hora_comienzo: string | null;
  fecha_hora_fin: string | null;
  fecha_hora_fin_estimada: string;
  estado_tracking: string | null;
  conductor: JefeConductor;
};

export type AsignacionesDeRuta = {
  ruta: {
    id_ruta: number;
    numero_ruta: string;
    lugar_inicial: string;
    lugar_final: string;
  };
  asignaciones: RutaAsignacion[];
  total_asignaciones: number;
  conductores_asignados: number;
};

type CrearConductorPayload = {
  nombre: string;
  telefono: string;
  password: string;
};

export const jefeGrupoService = {
  listarConductores: () =>
    apiRequest<{
      conductores: JefeConductor[];
      actual_page: number;
      max_page: number;
    }>("/jefe-grupo/conductores?type=both&limit=100"),

  listarRutas: () => apiRequest<JefeRuta[]>("/jefe-grupo/rutas"),

  listarAsignacionesRuta: (rutaId: number) =>
    apiRequest<AsignacionesDeRuta>(`/jefe-grupo/rutas/${rutaId}/asignaciones`),

  crearConductor: (payload: CrearConductorPayload) =>
    apiRequest<JefeConductor>("/jefe-grupo/conductores", {
      method: "POST",
      headers: { "Idempotency-Key": createIdempotencyKey() },
      json: payload,
    }),

  asignarRuta: (rutaId: number, conductorId: number, fechaInicio: string) =>
    apiRequest<unknown>(
      `/jefe-grupo/ruta/${rutaId}/conductores/${conductorId}/asignaciones`,
      {
        method: "POST",
        json: { fecha_inicio: fechaInicio },
      },
    ),
};

function createIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}
