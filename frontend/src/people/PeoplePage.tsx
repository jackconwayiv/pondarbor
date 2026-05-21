import { Box, Heading, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
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
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../theme/typography";
import {
  familyLinksFormHasValues,
  familyLinksVariantForForm,
  PersonFamilyLinksSection,
} from "./PersonFamilyLinksFields";
import { PersonFormFields } from "./PersonFormFields";
import FamilyTreeDisplayView from "./FamilyTreeDisplayView";
import FamilyTreeEditListView from "./FamilyTreeEditListView";
import FamilyTreeRearrangeView from "./FamilyTreeRearrangeView";
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
  patchPeopleTreeLayout,
  patchPerson,
} from "./api";
import { resolveDisplayLayout, seedLayoutFromPeople } from "./treeLayout";
import { FamilyTreeSetupWizard } from "./wizard/FamilyTreeSetupWizard";
import { isWizardAutoOpenDisabled } from "./wizard/wizardStorage";
import { syncSelfParentLinks } from "./parentSync";
import {
  applyPersonFormField,
  emptyPersonForm,
  personToFormState,
} from "./personFormState";
import { personPayloadFromForm } from "./personPayload";
import type { PeopleGraphBundle, PeoplePerson, PeopleTreeLayout } from "./types";

export type TreeInteractionMode = "view" | "rearrange" | "edit";

const TREE_MODE_TABS: { id: TreeInteractionMode; label: string }[] = [
  { id: "view", label: "View" },
  { id: "rearrange", label: "Rearrange" },
  { id: "edit", label: "People" },
];

function parseTreeMode(value: string | null | undefined): TreeInteractionMode {
  if (value === "rearrange" || value === "edit") return value;
  return "view";
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
  const { isAuthenticated, isLoading, getApiAccessToken, sessionUser } = useAppSession();
  const [bundle, setBundle] = useState<PeopleGraphBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [treeMode, setTreeMode] = useState<TreeInteractionMode>("view");
  const [treeLayout, setTreeLayout] = useState<PeopleTreeLayout | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<PeoplePerson | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fetchGenRef = useRef(0);

  const [form, setForm] = useState(emptyPersonForm);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardCloseDisablesAuto, setWizardCloseDisablesAuto] = useState(false);
  const autoOpenAttemptedRef = useRef(false);
  const layoutSeedAttemptedRef = useRef(false);
  const layoutPatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFormField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((prev) => applyPersonFormField(prev, key, value));
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

  const nonSelfCount = useMemo(
    () => bundle?.people.filter((p) => !p.is_self).length ?? 0,
    [bundle],
  );

  useEffect(() => {
    if (readOnly || !bundle || !sessionUser?.user.id) return;
    if (autoOpenAttemptedRef.current) return;
    if (nonSelfCount > 0) return;
    if (isWizardAutoOpenDisabled(sessionUser.user.id)) return;
    autoOpenAttemptedRef.current = true;
    setWizardCloseDisablesAuto(true);
    setWizardOpen(true);
  }, [readOnly, bundle, nonSelfCount, sessionUser?.user.id]);

  const openWizard = (fromAuto = false) => {
    setWizardCloseDisablesAuto(fromAuto);
    setWizardOpen(true);
  };

  const memberCount = bundle?.people.length ?? 0;
  const showSetupTreeButton =
    !readOnly &&
    Boolean(bundle) &&
    (memberCount < 5 || treeMode === "edit");

  const resolvedLayout = useMemo(() => {
    if (!bundle) return null;
    return resolveDisplayLayout(bundle.layout, bundle.people, bundle.partnerships);
  }, [bundle]);

  useEffect(() => {
    if (!bundle || !resolvedLayout) {
      setTreeLayout(null);
      return;
    }
    setTreeLayout(resolvedLayout);
  }, [bundle, resolvedLayout]);

  useEffect(() => {
    if (readOnly || !bundle || layoutSeedAttemptedRef.current) return;
    if (bundle.layout && Object.keys(bundle.layout.positions).length > 0) {
      layoutSeedAttemptedRef.current = true;
      return;
    }
    layoutSeedAttemptedRef.current = true;
    const seed = seedLayoutFromPeople(bundle.people, bundle.partnerships);
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const saved = await patchPeopleTreeLayout(token, seed);
        setBundle((prev) => (prev ? { ...prev, layout: saved } : prev));
        setTreeLayout(saved);
      } catch (e: unknown) {
        layoutSeedAttemptedRef.current = false;
        setError(e instanceof Error ? e.message : "Failed to save initial layout.");
      }
    })();
  }, [readOnly, bundle, getApiAccessToken]);

  useEffect(() => {
    return () => {
      if (layoutPatchTimerRef.current) clearTimeout(layoutPatchTimerRef.current);
    };
  }, []);

  const scheduleLayoutPatch = useCallback(
    (layout: PeopleTreeLayout) => {
      setTreeLayout(layout);
      if (layoutPatchTimerRef.current) clearTimeout(layoutPatchTimerRef.current);
      layoutPatchTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const token = await getApiAccessToken();
            const saved = await patchPeopleTreeLayout(token, layout);
            setBundle((prev) => (prev ? { ...prev, layout: saved } : prev));
            setTreeLayout(saved);
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to save layout.");
          }
        })();
      }, 400);
    },
    [getApiAccessToken],
  );

  const pageHeading = useMemo(() => {
    if (ownerUserId != null && ownerDisplayName?.trim()) {
      return `${ownerDisplayName.trim()}'s Family Tree`;
    }
    if (ownerUserId != null) {
      return "Family Tree";
    }
    return "Family Tree";
  }, [ownerUserId, ownerDisplayName]);

  const loadFormFromPerson = (p: PeoplePerson) => {
    setForm(personToFormState(p));
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
      setForm(emptyPersonForm());
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
    setForm(emptyPersonForm());
    setAddOpen(true);
  };

  const ownerUserIdForWizard = sessionUser?.user.id;

  const showTreeToolbar = !readOnly && Boolean(bundle) && nonSelfCount > 0;

  const headerToolbarButton = showTreeToolbar ? (
    showSetupTreeButton ? (
      <PondButton
        type="button"
        colorPalette="sky"
        size="sm"
        variant="outline"
        flexShrink={0}
        onClick={() => openWizard(false)}
      >
        Set up tree
      </PondButton>
    ) : (
      <PondButton
        type="button"
        colorPalette="lilypad"
        size="sm"
        flexShrink={0}
        onClick={openAddDialog}
      >
        Add person
      </PondButton>
    )
  ) : null;

  const layoutLoadingHint = (
    <Box px={{ base: "2", md: "2" }} py="2">
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Loading tree layout…
      </Text>
    </Box>
  );

  const readOnlyTreeBody =
    bundle && nonSelfCount > 0 ? (
      treeLayout ? (
        <FamilyTreeDisplayView bundle={{ ...bundle, layout: treeLayout }} />
      ) : (
        layoutLoadingHint
      )
    ) : null;

  const editableTreeTabs =
    bundle && nonSelfCount > 0 ? (
      <Tabs.Root
        value={treeMode}
        variant="plain"
        lazyMount
        unmountOnExit
        onValueChange={(details) => setTreeMode(parseTreeMode(details.value))}
      >
        <Tabs.List
          {...APP_SHELL_TAB_LIST_PROPS}
          py={undefined}
          pt="1"
          pb="2"
        >
          {TREE_MODE_TABS.map(({ id, label }) => (
            <Tabs.Trigger key={id} value={id} {...APP_SHELL_TAB_TRIGGER_PROPS}>
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="view" p={{ base: "2", md: "2" }}>
          {treeLayout ? (
            <FamilyTreeDisplayView bundle={{ ...bundle, layout: treeLayout }} />
          ) : (
            layoutLoadingHint
          )}
        </Tabs.Content>
        <Tabs.Content value="rearrange" p={{ base: "2", md: "2" }}>
          {treeLayout ? (
            <FamilyTreeRearrangeView
              bundle={bundle}
              layout={treeLayout}
              onLayoutChange={scheduleLayoutPatch}
            />
          ) : (
            layoutLoadingHint
          )}
        </Tabs.Content>
        <Tabs.Content value="edit" p={{ base: "2", md: "2" }}>
          <FamilyTreeEditListView
            bundle={bundle}
            onEditPerson={openEdit}
            onAddPerson={openAddDialog}
          />
        </Tabs.Content>
      </Tabs.Root>
    ) : null;

  const treeArea = (
    <>
      {error ? <PanelMessageSlot error={error} /> : null}
      {!bundle ? (
        embed && readOnly ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Loading tree…
          </Text>
        ) : (
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              Loading tree…
            </Text>
          </Box>
        )
      ) : nonSelfCount === 0 ? (
        <PanelEmptyState
          title="Your family tree is ready to grow."
          description="Walk through a quick setup for parents, siblings, and more."
          actionLabel={readOnly ? undefined : "Set up tree"}
          onAction={readOnly ? undefined : () => openWizard(false)}
          actionColorPalette="lilypad"
        />
      ) : readOnly ? (
        readOnlyTreeBody
      ) : (
        editableTreeTabs
      )}
    </>
  );

  const mainBody = (
    <>
      {embed && readOnly ? (
        treeArea
      ) : (
        <Stack
          gap="1"
          px={{ base: "2", md: "2" }}
          pt={{ base: "2", md: "2" }}
          pb="2"
          overflow="visible"
        >
          {embed ? (
            <Heading as="h2" size="md" color="fg">
              {pageHeading}
            </Heading>
          ) : (
            <Box
              {...PANEL_ENTRY_CARD_PROPS}
              pb={bundle && nonSelfCount > 0 ? "1" : undefined}
            >
              <HStack
                justify="space-between"
                align="flex-start"
                gap="2"
                flexWrap="nowrap"
              >
                <Heading as="h1" size={{ base: "lg", md: "xl" }} flex="1" minW={0}>
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
                {headerToolbarButton}
              </HStack>
            </Box>
          )}
          {treeArea}
        </Stack>
      )}

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
                <PersonFamilyLinksSection
                  key={`add-person-links-${addOpen}`}
                  defaultOpen={
                    addFamilyLinksVariant === "parent-relation-hint" ||
                    familyLinksFormHasValues(form)
                  }
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
                      <PersonFamilyLinksSection
                        key={`edit-person-links-${editPerson.id}-${editOpen}`}
                        defaultOpen={
                          familyLinksFormHasValues(form) ||
                          editPerson.partnerships.length > 0 ||
                          editPerson.guardian_links.length > 0
                        }
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
                      >
                        {editPerson.partnerships.length > 0 ? (
                          <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
                            <Text
                              fontSize={APP_TEXT_SIZES.label}
                              fontWeight="semibold"
                              color="fg"
                            >
                              Partnerships
                            </Text>
                            {editPerson.partnerships.map((pr) => {
                              const other = bundle?.people.find(
                                (x) => x.id === pr.other_person_id,
                              );
                              return (
                                <HStack
                                  key={pr.id}
                                  justify="space-between"
                                  flexWrap="wrap"
                                  gap="2"
                                >
                                  <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                                    {other?.name ?? pr.other_person_id} — {pr.status}
                                  </Text>
                                  <HStack gap="1">
                                    <PondButton
                                      type="button"
                                      size="xs"
                                      colorPalette="sky"
                                      variant="outline"
                                      onClick={async () => {
                                        const token = await getApiAccessToken();
                                        const next =
                                          pr.status === "current" ? "former" : "current";
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
                                </HStack>
                              );
                            })}
                          </Stack>
                        ) : null}
                        {editPerson.guardian_links.length > 0 ? (
                          <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
                            <Text
                              fontSize={APP_TEXT_SIZES.label}
                              fontWeight="semibold"
                              color="fg"
                            >
                              Guardians
                            </Text>
                            {editPerson.guardian_links.map((g) => {
                              const gu = bundle?.people.find((x) => x.id === g.guardian_id);
                              return (
                                <HStack
                                  key={g.id}
                                  justify="space-between"
                                  flexWrap="wrap"
                                  gap="2"
                                >
                                  <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                                    {gu?.name ?? g.guardian_id}
                                  </Text>
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
                                </HStack>
                              );
                            })}
                          </Stack>
                        ) : null}
                      </PersonFamilyLinksSection>
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

      {bundle && ownerUserIdForWizard != null && !readOnly ? (
        <FamilyTreeSetupWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          bundle={bundle}
          refresh={refresh}
          getApiAccessToken={getApiAccessToken}
          userId={ownerUserIdForWizard}
          markAutoOpenDisabledOnClose={wizardCloseDisablesAuto}
        />
      ) : null}
    </>
  );

  if (embed) {
    return mainBody;
  }

  return <PanelPageShell>{mainBody}</PanelPageShell>;
}
