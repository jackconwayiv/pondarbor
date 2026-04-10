import { Navigate, useParams } from "react-router";

/** Old `/meal/weeks/:id` → `/meal/plan/plans/:id` */
export function LegacyRedirectPlansWeekDetail() {
  const { id } = useParams();
  if (id == null) return <Navigate to="/meal/plan/plans" replace />;
  return <Navigate to={`/meal/plan/plans/${id}`} replace />;
}

/** Old `/meal/templates/:id` → `/meal/plan/templates/:id` */
export function LegacyRedirectPlansTemplateDetail() {
  const { id } = useParams();
  if (id == null) return <Navigate to="/meal/plan/templates" replace />;
  return <Navigate to={`/meal/plan/templates/${id}`} replace />;
}
