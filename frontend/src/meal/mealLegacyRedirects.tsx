import { Navigate, useParams } from "react-router";

/** Old `/meal/weeks/:id` → `/meal/plans/weeks/:id` */
export function LegacyRedirectPlansWeekDetail() {
  const { id } = useParams();
  if (id == null) return <Navigate to="/meal/plans/today" replace />;
  return <Navigate to={`/meal/plans/weeks/${id}`} replace />;
}

/** Old `/meal/templates/:id` → `/meal/plans/templates/:id` */
export function LegacyRedirectPlansTemplateDetail() {
  const { id } = useParams();
  if (id == null) return <Navigate to="/meal/plans/templates" replace />;
  return <Navigate to={`/meal/plans/templates/${id}`} replace />;
}
