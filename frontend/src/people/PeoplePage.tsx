import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import {
  PanelEmptyState,
  PanelErrorState,
  PanelMessageSlot,
  PanelPageShell,
  SessionLoadingCard,
} from "../components/panelStatus";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import {
  familyLinksVariantForForm,
  PersonFamilyLinksFields,
} from "./PersonFamilyLinksFields";
import { PersonFormFields } from "./PersonFormFields";
import PeopleTreeView from "./PeopleTreeView";
import {
  createGuardianLink,
  createPartnership,
  createPerson,
  deleteGuardianLink,
  deletePartnership,
  deletePerson,
  fetchPeopleGraph,
  fetchPeopleGraphForUser,
  patchPartnership,
  patchPerson,
} from "./api";
import { syncSelfParentLinks } from "./parentSync";
import { personPayloadFromForm } from "./personPayload";
import { buildTreeRows } from "./rankPeople";
import type { PeopleGraphBundle, PeoplePerson } from "./types";

function emptyForm() {
  return {
    name: "",
    core: "cousin",
    alias: "",
    prefix: [] as string[],
    suffix: [] as string[],
    birth: "",
    death: "",
    gender: "",
    imageKey: "",
    imageUrl: "",
    mother: "",
    father: "",
    stepMother: "",
    stepFather: "",
    partnerOther: "",
    guardian: "",
  };
}

export default function PeoplePage({
  readOnly: readOnlyProp,
  ownerUserId,
  embed,
  ownerDisplayName,
}: {
  readOnly?: boolean;
  ownerUserId?: number;
  /** When true, omit outer shell (e.g. nested under friend profile tabs). */
  embed?: boolean;
  /** Friend profile embed: heading uses this name. */
  ownerDisplayName?: string;
} = {}) {
  const readOnly = readOnlyProp || ownerUserId != null;
  const { isAuthenticated, isLoading, getApiAccessToken } = useAppSession();
  const [bundle, setBundle] = useState<PeopleGraphBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<PeoplePerson | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fetchGenRef = useRef(0);

  const [form, setForm] = useState(emptyForm);

  const setFormField = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K],
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "core" && value !== "friend" && prev.suffix.includes("best")) {
        next.suffix = prev.suffix.filter((t) => t !== "best");
      }
      if (
        key === "core" &&
        (value === "mother" || value === "father") &&
        value !== prev.core
      ) {
        next.mother = "";
        next.father = "";
      }
      return next;
    });
  };

  const refresh = useCallback(async () => {
    setError(null);
    const token = await getApiAccessToken();
    const data =
      ownerUserId != null
        ? await fetchPeopleGraphForUser(token, ownerUserId)
        : await fetchPeopleGraph(token);
    setBundle(data);
  }, [getApiAccessToken, ownerUserId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const gen = ++fetchGenRef.current;
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } catch (e: unknown) {
        if (!cancelled && gen === fetchGenRef.current) {
          setError(e instanceof Error ? e.message : "Failed to load.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refresh]);

  const treeRows = useMemo(() => {
    if (!bundle) return { rowsByRank: [], friendRow: [] };
    return buildTreeRows(bundle.people, bundle.partnerships);
  }, [bundle]);

  const pageHeading = useMemo(() => {
    if (ownerUserId != null && ownerDisplayName?.trim()) {
      return `${ownerDisplayName.trim()}'s Family Tree`;
    }
    if (ownerUserId != null) {
      return "Family Tree";
    }
    return "Family Tree";
  }, [ownerUserId, ownerDisplayName]);

  const pageIntro = useMemo(() => {
    if (readOnly) {
      return "View how this person organizes their relatives, partners, and connections.";
    }
    return "Add relatives, link parents and partners, and show off your family tree.";
  }, [readOnly]);

  const loadFormFromPerson = (p: PeoplePerson) => {
    setForm({
      name: p.name,
      core: p.relation_core,
      alias: p.relation_alias || "",
      prefix: [...(p.relation_prefix_tokens || [])],
      suffix: [...(p.relation_suffix_tokens || [])],
      birth: p.birthday || "",
      death: p.death_date || "",
      gender: p.gender || "",
      imageKey: p.image_key || "",
      imageUrl: p.image_url || "",
      mother: p.bio_mother_id || "",
      father: p.bio_father_id || "",
      stepMother: p.step_mother_id || "",
      stepFather: p.step_father_id || "",
      partnerOther: "",
      guardian: "",
    });
  };

  const openEdit = (p: PeoplePerson) => {
    setEditPerson(p);
    loadFormFromPerson(p);
    setConfirmDelete(false);
    setEditOpen(true);
  };

  const familyLinkCandidates = useMemo(() => {
    if (!bundle) return [];
    return bundle.people.filter((p) => p.id !== editPerson?.id);
  }, [bundle, editPerson?.id]);

  const addFamilyLinkCandidates = useMemo(() => bundle?.people ?? [], [bundle]);

  const addFamilyLinksVariant = familyLinksVariantForForm(false, form.core, true);
  const editFamilyLinksVariant = editPerson
    ? familyLinksVariantForForm(editPerson.is_self, form.core, false)
    : "their-parents";

  const saveEdit = async () => {
    if (!editPerson || readOnly || !bundle) return;
    setBusy(true);
    setError(null);
    const previousCore = editPerson.relation_core;
    try {
      const token = await getApiAccessToken();
      await patchPerson(
        token,
        editPerson.id,
        personPayloadFromForm(form, { editingSelf: editPerson.is_self }),
      );
      await syncSelfParentLinks(token, bundle, patchPerson, {
        editedPersonId: editPerson.id,
        relationCore: form.core,
        prefixTokens: form.prefix,
        suffixTokens: form.suffix,
        previousCore,
        previousPrefixTokens: editPerson.relation_prefix_tokens ?? [],
        previousSuffixTokens: editPerson.relation_suffix_tokens ?? [],
        editingSelf: editPerson.is_self,
        formMother: form.mother,
        formFather: form.father,
      });
      if (form.partnerOther) {
        await createPartnership(token, {
          person_one_id: editPerson.id,
          person_two_id: form.partnerOther,
        });
      }
      if (form.guardian) {
        await createGuardianLink(token, editPerson.id, { guardian_id: form.guardian });
      }
      setEditOpen(false);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveNew = async () => {
    if (readOnly || !bundle) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const created = await createPerson(
        token,
        personPayloadFromForm(form, { isCreate: true }),
      );
      await syncSelfParentLinks(token, bundle, patchPerson, {
        editedPersonId: created.id,
        relationCore: form.core,
        prefixTokens: form.prefix,
        suffixTokens: form.suffix,
      });
      if (form.partnerOther) {
        await createPartnership(token, {
          person_one_id: created.id,
          person_two_id: form.partnerOther,
        });
      }
      if (form.guardian) {
        await createGuardianLink(token, created.id, { guardian_id: form.guardian });
      }
      setAddOpen(false);
      setForm(emptyForm());
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!editPerson || readOnly || editPerson.is_self) return;
    setBusy(true);
    try {
      const token = await getApiAccessToken();
      await deletePerson(token, editPerson.id);
      setEditOpen(false);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (isLoading) {
    return <SessionLoadingCard />;
  }
  if (!isAuthenticated) {
    if (embed) {
      return (
        <Box p={{ base: "2", md: "2" }}>
          <Text fontSize={APP_TEXT_SIZES.body} color="fg">
            Sign in to view people.
          </Text>
        </Box>
      );
    }
    return <Navigate to="/" replace />;
  }

  if (error && !bundle) {
    if (embed) {
      return (
        <PanelErrorState title="Could not load family tree." description={error} />
      );
    }
    return (
      <PanelPageShell>
        <Box p={{ base: "2", md: "2" }}>
          <PanelErrorState title="Could not load family tree." description={error} />
        </Box>
      </PanelPageShell>
    );
  }

  const openAddDialog = () => {
    setForm(emptyForm());
    setAddOpen(true);
  };

  const mainBody = (
    <>
      <Stack
        gap="2"
        px={{ base: "2", md: "2" }}
        pt={{ base: "2", md: "2" }}
        pb="2"
        overflow="visible"
      >
        {embed ? (
          <Stack gap="2">
            <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="2">
              <Heading as="h2" size="md" color="fg" flex="1" minW="12rem">
                {pageHeading}
              </Heading>
              {!readOnly ? (
                <PondButton
                  type="button"
                  colorPalette="lilypad"
                  size="sm"
                  flexShrink={0}
                  onClick={openAddDialog}
                >
                  Add person
                </PondButton>
              ) : null}
            </HStack>
          </Stack>
        ) : (
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <HStack
              justify="space-between"
              align="flex-start"
              flexWrap="wrap"
              gap="2"
              mb="2"
            >
              <Heading as="h1" size={{ base: "lg", md: "xl" }} flex="1" minW="12rem">
                <HStack
                  as="span"
                  display="inline-flex"
                  gap="2"
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Text as="span" aria-hidden="true">
                    🌳
                  </Text>
                  <Text as="span">{pageHeading}</Text>
                  {!bundle ? (
                    <Text
                      as="span"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="fg.muted"
                      fontWeight="medium"
                      aria-live="polite"
                    >
                      Loading…
                    </Text>
                  ) : null}
                </HStack>
              </Heading>
              {!readOnly ? (
                <PondButton
                  type="button"
                  colorPalette="lilypad"
                  size="sm"
                  flexShrink={0}
                  onClick={openAddDialog}
                >
                  Add person
                </PondButton>
              ) : null}
            </HStack>
            <Text fontSize={APP_TEXT_SIZES.body} lineHeight="snug" color="fg">
              {pageIntro}
            </Text>
          </Box>
        )}

        {error ? <PanelMessageSlot error={error} /> : null}

        {!bundle ? (
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Loading tree…
            </Text>
          </Box>
        ) : bundle.people.length === 0 ? (
          <PanelEmptyState
            title="No people on your tree yet."
            description="Add yourself, parents, siblings, and anyone else you want to track."
            actionLabel={readOnly ? undefined : "Add person"}
            onAction={readOnly ? undefined : openAddDialog}
            actionColorPalette="lilypad"
          />
        ) : (
          <PeopleTreeView
            bundle={bundle}
            rowsByRank={treeRows.rowsByRank}
            friendRow={treeRows.friendRow}
            expandedId={expandedId}
            readOnly={readOnly}
            showLegend={!embed}
            onToggle={(personId) => {
              setExpandedId(expandedId === personId ? null : personId);
            }}
            onEdit={openEdit}
          />
        )}

      </Stack>

      <AppModal open={addOpen} onOpenChange={setAddOpen} title="Add person" size="lg">
        <Stack gap="3">
          <PersonFormFields
                  formName={form.name}
                  onFormNameChange={(v) => setFormField("name", v)}
                  formCore={form.core}
                  onFormCoreChange={(v) => setFormField("core", v)}
                  formAlias={form.alias}
                  onFormAliasChange={(v) => setFormField("alias", v)}
                  prefixTokens={form.prefix}
                  onPrefixTokensChange={(v) => setFormField("prefix", v)}
                  suffixTokens={form.suffix}
                  onSuffixTokensChange={(v) => setFormField("suffix", v)}
                  formBirth={form.birth}
                  onFormBirthChange={(v) => setFormField("birth", v)}
                  formDeath={form.death}
                  onFormDeathChange={(v) => setFormField("death", v)}
                  formGender={form.gender}
                  onFormGenderChange={(v) => setFormField("gender", v)}
                  formImageKey={form.imageKey}
                  onFormImageKeyChange={(v) => setFormField("imageKey", v)}
                  getApiAccessToken={getApiAccessToken}
                />
                <PersonFamilyLinksFields
                  candidates={addFamilyLinkCandidates}
                  subjectName={form.name}
                  formMother={form.mother}
                  onFormMotherChange={(v) => setFormField("mother", v)}
                  formFather={form.father}
                  onFormFatherChange={(v) => setFormField("father", v)}
                  formStepMother={form.stepMother}
                  onFormStepMotherChange={(v) => setFormField("stepMother", v)}
                  formStepFather={form.stepFather}
                  onFormStepFatherChange={(v) => setFormField("stepFather", v)}
                  variant={addFamilyLinksVariant}
                  relationCore={form.core}
                  relationPrefixTokens={form.prefix}
                  relationSuffixTokens={form.suffix}
                  formPartnerOther={form.partnerOther}
                  onFormPartnerOtherChange={(v) => setFormField("partnerOther", v)}
                  formGuardian={form.guardian}
                  onFormGuardianChange={(v) => setFormField("guardian", v)}
                />
          <HStack gap="2" flexWrap="wrap" justify="flex-end" pt="1">
            <PondButton
              type="button"
              colorPalette="sky"
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </PondButton>
            <PondButton
              type="button"
              colorPalette="lilypad"
              loading={busy}
              onClick={() => void saveNew()}
            >
              Save
            </PondButton>
          </HStack>
        </Stack>
      </AppModal>

      <AppModal
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) setEditOpen(false);
        }}
        title={editPerson ? `Edit ${editPerson.name}` : "Edit person"}
        size="lg"
      >
        {editPerson ? (
          <Stack gap="3">
                    <PersonFormFields
                      formName={form.name}
                      onFormNameChange={(v) => setFormField("name", v)}
                      formCore={form.core}
                      onFormCoreChange={(v) => setFormField("core", v)}
                      formAlias={form.alias}
                      onFormAliasChange={(v) => setFormField("alias", v)}
                      prefixTokens={form.prefix}
                      onPrefixTokensChange={(v) => setFormField("prefix", v)}
                      suffixTokens={form.suffix}
                      onSuffixTokensChange={(v) => setFormField("suffix", v)}
                      formBirth={form.birth}
                      onFormBirthChange={(v) => setFormField("birth", v)}
                      formDeath={form.death}
                      onFormDeathChange={(v) => setFormField("death", v)}
                      formGender={form.gender}
                      onFormGenderChange={(v) => setFormField("gender", v)}
                      formImageKey={form.imageKey}
                      formImageUrl={form.imageUrl}
                      onFormImageKeyChange={(v) => setFormField("imageKey", v)}
                      getApiAccessToken={getApiAccessToken}
                      disabled={readOnly}
                      relationCoreLocked={editPerson.is_self}
                    />
                    {!readOnly ? (
                      <PersonFamilyLinksFields
                        candidates={familyLinkCandidates}
                        subjectPersonId={editPerson.id}
                        subjectName={editPerson.name}
                        existingPartnerIds={editPerson.partnerships.map(
                          (p) => p.other_person_id,
                        )}
                        formMother={form.mother}
                        onFormMotherChange={(v) => setFormField("mother", v)}
                        formFather={form.father}
                        onFormFatherChange={(v) => setFormField("father", v)}
                        formStepMother={form.stepMother}
                        onFormStepMotherChange={(v) => setFormField("stepMother", v)}
                        formStepFather={form.stepFather}
                        onFormStepFatherChange={(v) => setFormField("stepFather", v)}
                        variant={editFamilyLinksVariant}
                        relationCore={form.core}
                        formPartnerOther={form.partnerOther}
                        onFormPartnerOtherChange={(v) => setFormField("partnerOther", v)}
                        formGuardian={form.guardian}
                        onFormGuardianChange={(v) => setFormField("guardian", v)}
                      />
                    ) : null}
            {editPerson.partnerships.length > 0 ? (
              <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
                <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
                  Partnerships
                </Text>
                {editPerson.partnerships.map((pr) => {
                  const other = bundle?.people.find((x) => x.id === pr.other_person_id);
                  return (
                    <HStack key={pr.id} justify="space-between" flexWrap="wrap" gap="2">
                      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                        {other?.name ?? pr.other_person_id} — {pr.status}
                      </Text>
                      {!readOnly ? (
                        <HStack gap="1">
                          <PondButton
                            type="button"
                            size="xs"
                            colorPalette="sky"
                            variant="outline"
                            onClick={async () => {
                              const token = await getApiAccessToken();
                              const next = pr.status === "current" ? "former" : "current";
                              await patchPartnership(token, pr.id, { status: next });
                              await refresh();
                            }}
                          >
                            Toggle
                          </PondButton>
                          <PondButton
                            type="button"
                            size="xs"
                            colorPalette="nautical"
                            variant="outline"
                            onClick={async () => {
                              const token = await getApiAccessToken();
                              await deletePartnership(token, pr.id);
                              await refresh();
                            }}
                          >
                            Remove
                          </PondButton>
                        </HStack>
                      ) : null}
                    </HStack>
                  );
                })}
              </Stack>
            ) : null}
            {editPerson.guardian_links.length > 0 ? (
              <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
                <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
                  Guardians
                </Text>
                {editPerson.guardian_links.map((g) => {
                  const gu = bundle?.people.find((x) => x.id === g.guardian_id);
                  return (
                    <HStack key={g.id} justify="space-between" flexWrap="wrap" gap="2">
                      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                        {gu?.name ?? g.guardian_id}
                      </Text>
                      {!readOnly ? (
                        <PondButton
                          type="button"
                          size="xs"
                          colorPalette="nautical"
                          variant="outline"
                          onClick={async () => {
                            const token = await getApiAccessToken();
                            await deleteGuardianLink(token, editPerson.id, g.id);
                            await refresh();
                          }}
                        >
                          Remove
                        </PondButton>
                      ) : null}
                    </HStack>
                  );
                })}
              </Stack>
            ) : null}
            <HStack gap="2" flexWrap="wrap" justify="space-between" pt="1">
              <HStack gap="2" flexWrap="wrap">
                <PondButton
                  type="button"
                  colorPalette="sky"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                >
                  Close
                </PondButton>
                {!readOnly ? (
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
                    loading={busy}
                    onClick={() => void saveEdit()}
                  >
                    Save
                  </PondButton>
                ) : null}
              </HStack>
              {!readOnly && !editPerson.is_self ? (
                <PondButton
                  type="button"
                  colorPalette="nautical"
                  variant={confirmDelete ? "solid" : "outline"}
                  loading={busy}
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    void doDelete();
                  }}
                >
                  {confirmDelete ? "Confirm delete" : "Delete person"}
                </PondButton>
              ) : null}
            </HStack>
          </Stack>
        ) : null}
      </AppModal>
    </>
  );

  if (embed) {
    return mainBody;
  }

  return <PanelPageShell>{mainBody}</PanelPageShell>;
}
