import { apiRequest } from "@/services/api";
import {
    Chofer,
    ConductorDetalle,
    CrearConductorPayload,
    CrearGrupoPayload,
    CrearRutaPayload,
    EditarConductorPayload,
    EditarGrupoPayload,
    EditarRepresentantePayload,
    Grupo,
} from "@/types/grupo";

export const gruposService = {
  listar: async (): Promise<Grupo[]> => {
    return apiRequest<Grupo[]>("/admin/grupos-operativos");
  },

  obtener: async (grupoId: string): Promise<Grupo> => {
    return apiRequest<Grupo>(`/admin/grupos-operativos/${grupoId}`);
  },

  crear: async (payload: CrearGrupoPayload): Promise<Grupo> => {
    return apiRequest<Grupo>("/admin/grupos-operativos", {
      method: "POST",
      json: payload,
    });
  },

  editar: async (
    grupoId: string,
    payload: EditarGrupoPayload,
  ): Promise<Grupo> => {
    return apiRequest<Grupo>(`/admin/grupos-operativos/${grupoId}`, {
      method: "PUT",
      json: payload,
    });
  },

  asignarJefeExistente: async (grupoId: string, conductorId: string) => {
    return apiRequest<{
      id_grupo: number;
      id_representante: number;
      representante: { nombre: string; telefono: string | null };
    }>(
      `/admin/grupos_operativos/${grupoId}/representante/conductor_existente`,
      {
        method: "PUT",
        json: { id_conductor: Number(conductorId) },
      },
    );
  },

  eliminar: async (grupoId: string): Promise<void> => {
    await apiRequest<void>(`/admin/grupos-operativos/${grupoId}`, {
      method: "DELETE",
    });
  },

  crearConductor: async (
    grupoId: string,
    payload: CrearConductorPayload,
  ): Promise<ConductorDetalle> => {
    return apiRequest<ConductorDetalle>(
      `/admin/grupos-operativos/${grupoId}/conductores`,
      { method: "POST", json: payload },
    );
  },

  obtenerConductor: async (
    grupoId: string,
    conductorId: string,
  ): Promise<ConductorDetalle> => {
    return apiRequest<ConductorDetalle>(
      `/admin/grupos-operativos/${grupoId}/conductores/${conductorId}`,
    );
  },

  editarConductor: async (
    grupoId: string,
    conductorId: string,
    payload: EditarConductorPayload,
  ): Promise<ConductorDetalle> => {
    return apiRequest<ConductorDetalle>(
      `/admin/grupos-operativos/${grupoId}/conductores/${conductorId}`,
      { method: "PUT", json: payload },
    );
  },

  crearRuta: async (grupoId: string, payload: CrearRutaPayload) => {
    return apiRequest<{ id: string; numero_ruta: string }>(
      `/admin/grupos-operativos/${grupoId}/rutas`,
      { method: "POST", json: payload },
    );
  },

  eliminarChofer: async (grupoId: string, choferId: string): Promise<void> => {
    await apiRequest<void>(`/grupos/${grupoId}/choferes/${choferId}`, {
      method: "DELETE",
    });
  },

  editarRepresentanteChofer: async (
    grupoId: string,
    choferId: string,
    payload: EditarRepresentantePayload,
  ): Promise<Chofer> => {
    return apiRequest<Chofer>(
      `/grupos/${grupoId}/choferes/${choferId}/representante`,
      {
        method: "PUT",
        json: payload,
      },
    );
  },
};
