export interface Representante {
  nombre: string;
  telefono: string;
  email?: string;
  code?: string;
  password?: string;
}

export interface Ruta {
  id: string;
  nombre: string; // ej: "Ruta Centro - Norte"
  horaInicio?: string; // "08:00"
}

export interface Chofer {
  id: string;
  nombre: string;
  activo: boolean; // soft delete: false = eliminado
  representante: Representante;
  rutas: Ruta[];
}

export interface Grupo {
  id: string;
  nombre: string;
  lineas: string[]; // ej: ["231"] — líneas que pertenecen a este grupo
  representante?: Representante | null; // puede no tener representante asignado aún
  choferes: Chofer[];
  rutasDisponibles?: Ruta[];
}

export interface ConductorDetalle extends Chofer {
  code: string;
  telefono: string | null;
  id_grupo: string;
}

export interface CrearConductorPayload {
  code: string;
  nombre: string;
  telefono?: string;
  password: string;
}

export interface EditarConductorPayload {
  nombre?: string;
  telefono?: string | null;
}

export interface PuntoControlPayload {
  coordenadas: [number, number];
  radio: number;
  n_puntos_relativo: number;
}

export interface CrearRutaPayload {
  numero_ruta: string;
  lugar_inicial: string;
  lugar_final: string;
  tiempo_estimado?: number;
  geojson: {
    type: "Feature";
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
  };
  puntos_control: PuntoControlPayload[];
}

// Payloads para crear/editar
export interface CrearGrupoPayload {
  nombre: string;
  lineas: string[];
  representante?: Representante;
}

export interface EditarGrupoPayload {
  nombre: string;
  lineas: string[];
  representante?: Representante | null;
}

export interface EditarRepresentantePayload {
  representante: Representante;
}
