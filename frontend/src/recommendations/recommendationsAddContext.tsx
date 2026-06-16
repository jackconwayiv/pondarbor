import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";
import AddRecommendationModal from "./AddRecommendationModal";

type OpenAddModalOptions = {
  defaultCategorySlug?: string;
  onSuccess?: () => void;
};

type RecommendationsAddContextValue = {
  openAddModal: (options?: OpenAddModalOptions) => void;
  refreshNonce: number;
};

const RecommendationsAddContext = createContext<RecommendationsAddContextValue | null>(null);

export function useRecommendationsAdd(): RecommendationsAddContextValue {
  const ctx = useContext(RecommendationsAddContext);
  if (!ctx) {
    throw new Error("useRecommendationsAdd must be used within RecommendationsAddProvider");
  }
  return ctx;
}

export function RecommendationsAddProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultCategorySlug, setDefaultCategorySlug] = useState<string | undefined>(undefined);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const handledAddParamRef = useRef(false);

  const openAddModal = useCallback((options?: OpenAddModalOptions) => {
    setDefaultCategorySlug(options?.defaultCategorySlug);
    onSuccessRef.current = options?.onSuccess;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("add") !== "1") {
      handledAddParamRef.current = false;
      return;
    }
    if (handledAddParamRef.current) return;
    handledAddParamRef.current = true;
    const category = searchParams.get("category") ?? undefined;
    openAddModal({ defaultCategorySlug: category });
    const next = new URLSearchParams(searchParams);
    next.delete("add");
    next.delete("category");
    setSearchParams(next, { replace: true });
  }, [openAddModal, searchParams, setSearchParams]);

  const value = useMemo(
    () => ({ openAddModal, refreshNonce }),
    [openAddModal, refreshNonce],
  );

  return (
    <RecommendationsAddContext.Provider value={value}>
      {children}
      <AddRecommendationModal
        open={open}
        onOpenChange={setOpen}
        defaultCategorySlug={defaultCategorySlug}
        onSuccess={() => {
          onSuccessRef.current?.();
          onSuccessRef.current = undefined;
          setRefreshNonce((n) => n + 1);
        }}
      />
    </RecommendationsAddContext.Provider>
  );
}
