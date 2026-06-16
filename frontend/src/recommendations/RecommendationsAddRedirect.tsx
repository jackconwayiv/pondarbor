import { Navigate, useParams } from "react-router";

export default function RecommendationsAddRedirect() {
  const { categorySlug = "" } = useParams();
  const search = categorySlug
    ? `?add=1&category=${encodeURIComponent(categorySlug)}`
    : "?add=1";
  return <Navigate to={`/recommendations${search}`} replace />;
}
