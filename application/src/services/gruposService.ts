import { Grupo, Chofer, CrearGrupoPayload, EditarGrupoPayload, EditarRepresentantePayload } from "@/types/grupo";

// Ajusta esto a tu .env. Si usas Expo, define EXPO_PUBLIC_API_URL en .env
// para que esté disponible en runtime sin config extra.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const gruposService = {
  listar: async (): Promise<Grupo[]> => {
    const res = await fetch(`${API_URL}/grupos`);
    return handleResponse<Grupo[]>(res);
  },

  obtener: async (grupoId: string): Promise<Grupo> => {
    const res = await fetch(`${API_URL}/grupos/${grupoId}`);
    return handleResponse<Grupo>(res);
  },

  crear: async (payload: CrearGrupoPayload): Promise<Grupo> => {
    const res = await fetch(`${API_URL}/grupos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<Grupo>(res);
  },

  editar: async (grupoId: string, payload: EditarGrupoPayload): Promise<Grupo> => {
    const res = await fetch(`${API_URL}/grupos/${grupoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<Grupo>(res);
  },

  eliminar: async (grupoId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/grupos/${grupoId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Error ${res.status}: ${body || res.statusText}`);
    }
  },

  eliminarChofer: async (grupoId: string, choferId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/grupos/${grupoId}/choferes/${choferId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Error ${res.status}: ${body || res.statusText}`);
    }
  },

  editarRepresentanteChofer: async (
    grupoId: string,
    choferId: string,
    payload: EditarRepresentantePayload
  ): Promise<Chofer> => {
    const res = await fetch(
      `${API_URL}/grupos/${grupoId}/choferes/${choferId}/representante`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res);
  },
};