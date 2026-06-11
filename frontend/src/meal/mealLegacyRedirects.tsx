import { Navigate, useParams } from "react-router";

/** Old `/meal/weeks/:id` → week editor (resolves instance id to `week_start`). */
export function LegacyRedirectPlansWeekDetail() {
  const { id } = useParams();
  if (id == null) return <Navigate to="/meal/plan" replace />;
  return <Navigate to={`/meal/plan/plans/${id}`} replace />;
}
