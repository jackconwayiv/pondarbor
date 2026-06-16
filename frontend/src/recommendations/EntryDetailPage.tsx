import { Navigate, useParams } from "react-router";

export default function EntryDetailPage() {
  const { categorySlug = "", entryId = "" } = useParams();
  const id = Number.parseInt(entryId, 10);
  if (!Number.isFinite(id) || id < 1 || !categorySlug) {
    return <Navigate to="/recommendations" replace />;
  }
  return <Navigate to={`/recommendations/${categorySlug}?entry=${id}`} replace />;
}
