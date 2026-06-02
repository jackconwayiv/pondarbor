import { Navigate, useParams } from "react-router";

/** Old `/meal/weeks/:id` → `/meal/plan/plans/:id` */
export function LegacyRedirectPlansWeekDetail() {
  const { id } = useParams();
  if (id == null) return <Navigate to="/meal/plan/overview" replace />;
  return <Navigate to={`/meal/plan/plans/${id}`} replace />;
}
