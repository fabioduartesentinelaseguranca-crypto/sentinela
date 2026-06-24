import { useState, useEffect, createContext, useContext } from "react";
import { base44 } from "@/api/base44Client";

const ModulosContext = createContext({ modulosAtivos: new Set(), hasModulo: () => true, loading: true });

export function ModulosProvider({ children }) {
  const [modulosAtivos, setModulosAtivos] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ClienteMunicipal.filter({ status: "ativo" }, "-created_date", 1)
      .then(list => {
        if (list.length > 0 && list[0].modulos_ativos?.length > 0) {
          setModulosAtivos(new Set(list[0].modulos_ativos));
        } else {
          setModulosAtivos(new Set(["*"]));
        }
      })
      .catch(() => setModulosAtivos(new Set(["*"])))
      .finally(() => setLoading(false));
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