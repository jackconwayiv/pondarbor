import { Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { PanelSessionReconnect } from "../components/panelStatus";
import { APP_TEXT_SIZES } from "../theme/typography";
import { deleteTemplate, fetchTemplates } from "./api";
import { SCORENADO_CARD_GRID_PROPS, ScorenadoGameCard } from "./ScorenadoGameCard";
import { sortTemplatesByUpdated } from "./scorenadoSort";
import { ScorenadoTemplateDetailModal } from "./ScorenadoTemplateDetailModal";
import { ScorenadoTemplateEditorModal } from "./ScorenadoTemplateEditorModal";
import type { ScoreboardTemplate } from "./types";

export default function ScorenadoTemplatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getApiAccessToken } = useAppSession();
  const [templates, setTemplates] = useState<ScoreboardTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ScoreboardTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const all = await fetchTemplates(token);
      setTemplates(sortTemplatesByUpdated(all.filter((t) => t.can_edit)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load templates.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const isNew = searchParams.get("new") === "1";
    const editId = searchParams.get("edit")?.trim();
    if (!isNew && !editId) return;
    if (isNew) {
      setEditorTemplateId(null);
      setEditorOpen(true);
    } else if (editId) {
      setEditorTemplateId(editId);
      setEditorOpen(true);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const openNewEditor = () => {
    setEditorTemplateId(null);
    setEditorOpen(true);
  };

  const openEditEditor = (t: ScoreboardTemplate) => {
    if (!t.can_edit) return;
    setEditorTemplateId(t.id);
    setEditorOpen(true);
  };

  const removeTemplate = async (t: ScoreboardTemplate) => {
    setDeleteBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await deleteTemplate(token, t.id);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      throw err;
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        LOADING…
      </Text>
    );
  }

  if (error && templates.length === 0) {
    return (
      <PanelSessionReconnect sessionError={error} onRetry={() => void load()} />
    );
  }

  return (
    <Stack gap="4" w="100%">
      <Heading size="sm" className="scorenado-pixel-title" fontSize="0.75rem">
        Your templates
      </Heading>

      {error ? (
        <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
          {error}
        </Text>
      ) : null}

      <SimpleGrid {...SCORENADO_CARD_GRID_PROPS}>
        <ScorenadoGameCard
          label="+"
          index={0}
          variant="newTemplate"
          onClick={openNewEditor}
        />
        {templates.map((t, index) => (
          <ScorenadoGameCard
            key={t.id}
            label={t.name}
            index={index + 1}
            variant="label"
            privateTemplate={!t.is_published}
            onClick={() => setSelected(t)}
          />
        ))}
      </SimpleGrid>

      <ScorenadoTemplateDetailModal
        template={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onEdit={(t) => {
          setSelected(null);
          openEditEditor(t);
        }}
        deleteBusy={deleteBusy}
        onDelete={removeTemplate}
      />

      <ScorenadoTemplateEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={editorTemplateId}
        onSaved={() => load()}
      />
    </Stack>
  );
}
