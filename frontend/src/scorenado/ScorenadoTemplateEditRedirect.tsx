import { Navigate, useParams } from "react-router";

/** Legacy route: open the templates tab editor modal. */
export default function ScorenadoTemplateEditRedirect() {
  const { templateId } = useParams<{ templateId: string }>();
  return (
    <Navigate
      to={`/scorenado/templates?edit=${encodeURIComponent(templateId ?? "")}`}
      replace
    />
  );
}
