export interface Representante {
  nombre: string;
  telefono: string;
  email?: string;
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
  representante?: Representante; // puede no tener representante asignado aún
  choferes: Chofer[];
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
  representante?: Representante;
}

export interface EditarRepresentantePayload {
  representante: Representante;
}