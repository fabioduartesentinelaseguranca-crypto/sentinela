import { useState, useEffect, createContext, useContext } from "react";
import { base44 } from "@/api/base44Client";

const ModulosContext = createContext({ modulosAtivos: new Set(), hasModulo: () => true, loading: true });

async function fetchModulos(setModulosAtivos, setLoading) {
  try {
    const list = await base44.entities.ClienteMunicipal.filter({ status: "ativo" }, "-created_date", 1);
    if (list.length > 0 && list[0].modulos_ativos?.length > 0) {
      setModulosAtivos(new Set(list[0].modulos_ativos));
    } else {
      setModulosAtivos(new Set(["*"]));
    }
  } catch {
    setModulosAtivos(new Set(["*"]));
  } finally {
    if (setLoading) setLoading(false);
  }
}

export function ModulosProvider({ children }) {
  const [modulosAtivos, setModulosAtivos] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carrega imediatamente
    fetchModulos(setModulosAtivos, setLoading);

    // Subscreve atualizações em tempo real no ClienteMunicipal
    const unsubscribe = base44.entities.ClienteMunicipal.subscribe((event) => {
      if (event.type === "update" || event.type === "create") {
        fetchModulos(setModulosAtivos, null);
      }
    });

    return unsubscribe;
  }, []);

  const hasModulo = (id) => modulosAtivos.has("*") || modulosAtivos.has(id);

  return (
    <ModulosContext.Provider value={{ modulosAtivos, hasModulo, loading }}>
      {children}
    </ModulosContext.Provider>
  );
}

export function useModulos() {
  return useContext(ModulosContext);
}