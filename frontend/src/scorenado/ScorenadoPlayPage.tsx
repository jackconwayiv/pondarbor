import { Flex, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { PanelEmptyState, PanelSessionReconnect } from "../components/panelStatus";
import { APP_TEXT_SIZES } from "../theme/typography";
import { createGame, fetchTemplates, inviteFriendToSeat } from "./api";
import { SCORENADO_CARD_GRID_PROPS, ScorenadoGameCard } from "./ScorenadoGameCard";
import {
  ScorenadoStartGameModal,
  type StartGamePlayerSetup,
} from "./ScorenadoStartGameModal";
import { sortTemplatesByLastPlayed } from "./scorenadoSort";
import type { ScoreboardTemplate } from "./types";

export default function ScorenadoPlayPage() {
  const navigate = useNavigate();
  const { getApiAccessToken } = useAppSession();
  const [templates, setTemplates] = useState<ScoreboardTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<ScoreboardTemplate | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      setTemplates(sortTemplatesByLastPlayed(await fetchTemplates(token)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load templates.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const startGame = async (
    template: ScoreboardTemplate,
    opts: {
      playerCount: number;
      roundCount: number;
      players: StartGamePlayerSetup[];
    },
  ) => {
    setStartingId(template.id);
    setError(null);
    try {
      const token = await getApiAccessToken();
      let game = await createGame(token, {
        template_id: template.id,
        players: opts.players.map(({ display_name, color, sort_order }) => ({
          display_name,
          color,
          sort_order,
        })),
        ...(template.scored_by_rounds ? { round_count: opts.roundCount } : {}),
      });
      for (const setup of opts.players) {
        if (!setup.invite_user_id || setup.sort_order === 0) continue;
        const seat = game.players.find((p) => p.sort_order === setup.sort_order);
        if (!seat) continue;
        game = await inviteFriendToSeat(
          token,
          game.id,
          seat.id,
          setup.invite_user_id,
        );
      }
      setPendingTemplate(null);
      void navigate(`/scorenado/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start game.");
    } finally {
      setStartingId(null);
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
    <Flex direction="column" gap="4" w="100%">
      <Heading size="sm" className="scorenado-pixel-title" fontSize="0.75rem">
        Start a game
      </Heading>

      {error ? (
        <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
          {error}
        </Text>
      ) : null}

      {templates.length === 0 ? (
        <PanelEmptyState
          title="No templates yet"
          description="Create a scoreboard template to get started."
        />
      ) : (
        <SimpleGrid {...SCORENADO_CARD_GRID_PROPS}>
          {templates.map((t, index) => (
            <ScorenadoGameCard
              key={t.id}
              label={t.name}
              index={index}
              loading={startingId === t.id}
              onClick={() => setPendingTemplate(t)}
            />
          ))}
        </SimpleGrid>
      )}

      <ScorenadoStartGameModal
        template={pendingTemplate}
        open={pendingTemplate != null}
        onOpenChange={(open) => {
          if (!open && !startingId) setPendingTemplate(null);
        }}
        starting={pendingTemplate != null && startingId === pendingTemplate.id}
        onStart={(opts) => {
          if (!pendingTemplate) return;
          void startGame(pendingTemplate, opts);
        }}
      />

      <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Or{" "}
        <Link to="/scorenado/templates?new=1" style={{ textDecoration: "underline" }}>
          create a custom template
        </Link>
        .
      </Text>
    </Flex>
  );
}
