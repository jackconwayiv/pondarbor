import { Navigate, useParams } from "react-router";

export default function ClosetItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const id = itemId ? Number.parseInt(itemId, 10) : Number.NaN;
  if (!Number.isFinite(id) || id < 1) {
    return <Navigate to="/closet?tab=items" replace />;
  }
  return <Navigate to={`/closet?tab=items&item=${id}`} replace />;
}
