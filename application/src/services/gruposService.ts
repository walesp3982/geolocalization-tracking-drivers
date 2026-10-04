import { apiRequest } from "@/services/api";
import {
  Chofer,
  CrearGrupoPayload,
  EditarGrupoPayload,
  EditarRepresentantePayload,
  Grupo,
} from "@/types/grupo";

export const gruposService = {
  listar: async (): Promise<Grupo[]> => {
    return apiRequest<Grupo[]>("/grupos");
  },

  obtener: async (grupoId: string): Promise<Grupo> => {
    return apiRequest<Grupo>(`/grupos/${grupoId}`);
  },

  crear: async (payload: CrearGrupoPayload): Promise<Grupo> => {
    return apiRequest<Grupo>("/grupos", {
      method: "POST",
      json: payload,
    });
  },

  editar: async (
    grupoId: string,
    payload: EditarGrupoPayload,
  ): Promise<Grupo> => {
    return apiRequest<Grupo>(`/grupos/${grupoId}`, {
      method: "PUT",
      json: payload,
    });
  },

  eliminar: async (grupoId: string): Promise<void> => {
    await apiRequest<void>(`/grupos/${grupoId}`, {
      method: "DELETE",
    });
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
