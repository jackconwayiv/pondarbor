import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppModal } from "../../components/AppModal";
import PondButton from "../../PondButton";
import { useIsMobile } from "../../responsive";
import {
  APP_TEXT_SIZES,
  HIDE_SCROLLBAR_CSS,
  PANEL_NESTED_BLOCK_PROPS,
} from "../../theme/typography";
import { PersonImageField } from "../PersonImageField";
import {
  emptyPersonForm,
  personToFormState,
  type PersonFormState,
} from "../personFormState";
import {
  buildWizardPrefill,
  siblingHouseholdTitle,
  siblingSpousePerson,
} from "./wizardPrefill";
import {
  persistChildOfSelf,
  persistGrandparent,
  persistNewPerson,
  persistPersonPatch,
  persistSelfImage,
  persistSpouseWithSelf,
  type WizardPersistDeps,
} from "./wizardPersist";
import { firstIncompleteWizardPage } from "./wizardResume";
import { setWizardAutoOpenDisabled } from "./wizardStorage";
import {
  activeWizardPages,
  pageIndexInActive,
  type WizardPageId,
} from "./wizardSteps";
import { newSiblingSpouseForm, relationLabelFromForm } from "./siblingSpouseForm";
import {
  defaultFatherForm,
  defaultMotherForm,
  newWizardDraft,
  suggestedRelationEntryProps,
  wizardEntryInProgress,
  wizardParentsAddBlocked,
  type WizardDraft,
  type WizardDraftKind,
} from "./wizardEntryUi";
import { WizardPersonEntry, newEntryForm } from "./WizardPersonEntry";
import { WizardStepShell } from "./WizardStepShell";
import type { PeopleGraphBundle, PeoplePerson } from "../types";

export type FamilyTreeSetupWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: PeopleGraphBundle;
  refresh: () => Promise<void>;
  getApiAccessToken: () => Promise<string>;
  userId: number;
  /** When true, closing via Close/X disables future auto-open. */
  markAutoOpenDisabledOnClose?: boolean;
};

function PrefillCard({
  person,
  onEdit,
  hideEdit = false,
}: {
  person: PeoplePerson;
  onEdit: () => void;
  hideEdit?: boolean;
}) {
  return (
    <HStack
      {...PANEL_NESTED_BLOCK_PROPS}
      justify="space-between"
      flexWrap="wrap"
      gap="2"
    >
      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
        {person.name}
      </Text>
      {hideEdit ? null : (
        <PondButton type="button" size="xs" variant="outline" colorPalette="sky" onClick={onEdit}>
          Edit
        </PondButton>
      )}
    </HStack>
  );
}

export function FamilyTreeSetupWizard({
  open,
  onOpenChange,
  bundle,
  refresh,
  getApiAccessToken,
  userId,
  markAutoOpenDisabledOnClose = false,
}: FamilyTreeSetupWizardProps) {
  const isMobile = useIsMobile();
  const prefill = useMemo(() => buildWizardPrefill(bundle), [bundle]);
  const activePages = useMemo(
    () => activeWizardPages(prefill.siblings.length > 0),
    [prefill.siblings.length],
  );

  const [pageId, setPageId] = useState<WizardPageId>("you");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState(() => emptyPersonForm());
  const [motherForm, setMotherForm] = useState(defaultMotherForm);
  const [fatherForm, setFatherForm] = useState(defaultFatherForm);
  const [selfImageKey, setSelfImageKey] = useState("");
  const [drafts, setDrafts] = useState<WizardDraft[]>([]);
  const [childKind, setChildKind] = useState<"child" | "pet">("child");
  const [spouseForSiblingId, setSpouseForSiblingId] = useState<string | null>(null);
  const [spouseForm, setSpouseForm] = useState(() => emptyPersonForm({ core: "brother", suffix: ["in_law"] }));
  const [showStepMotherForm, setShowStepMotherForm] = useState(false);
  const [showStepFatherForm, setShowStepFatherForm] = useState(false);

  const draftsOf = useCallback(
    (kind: WizardDraftKind) => drafts.filter((d) => d.kind === kind),
    [drafts],
  );
  const pushDraft = (draft: WizardDraft) => setDrafts((prev) => [...prev, draft]);
  const removeDraftById = (draftId: string) =>
    setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
  const patchDraftForm = (draftId: string, form: PersonFormState) =>
    setDrafts((prev) => prev.map((d) => (d.draftId === draftId ? { ...d, form } : d)));

  const entryInProgressState = useMemo(
    () => ({
      editingId,
      draftCount: drafts.length,
      spouseForSiblingId,
      showStepMotherForm,
      showStepFatherForm,
    }),
    [editingId, drafts.length, spouseForSiblingId, showStepMotherForm, showStepFatherForm],
  );
  const entryInProgress = useMemo(
    () => wizardEntryInProgress(entryInProgressState),
    [entryInProgressState],
  );
  const parentsAddBlocked = useMemo(
    () => wizardParentsAddBlocked(entryInProgressState, prefill.parentSlots),
    [entryInProgressState, prefill.parentSlots],
  );

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      setPageId(firstIncompleteWizardPage(bundle));
      setError(null);
      setEditingId(null);
      setShowStepMotherForm(false);
      setShowStepFatherForm(false);
      setDrafts([]);
      setMotherForm(defaultMotherForm());
      setFatherForm(defaultFatherForm());
      const self = prefill.self;
      setSelfImageKey(self?.image_key ?? "");
      wasOpenRef.current = true;
    }
  }, [open, bundle, prefill.self]);

  const pageIndex = pageIndexInActive(activePages, pageId);
  const hasPrior = pageIndex > 0;
  const hasNext = pageIndex < activePages.length - 1;
  const isLast = pageIndex === activePages.length - 1;

  const deps: WizardPersistDeps = useMemo(
    () => ({
      getToken: getApiAccessToken,
      bundle,
      refresh,
    }),
    [bundle, getApiAccessToken, refresh],
  );

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        setEditingId(null);
        setEntryForm(emptyPersonForm());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const goBack = () => {
    if (hasPrior) setPageId(activePages[pageIndex - 1]!);
  };
  const goNext = () => {
    if (hasNext) setPageId(activePages[pageIndex + 1]!);
  };

  const handleClose = (disableAuto: boolean) => {
    if (disableAuto && markAutoOpenDisabledOnClose) {
      setWizardAutoOpenDisabled(userId);
    }
    onOpenChange(false);
  };

  const startEdit = (p: PeoplePerson) => {
    setEditingId(p.id);
    setEntryForm(personToFormState(p));
  };

  const renderEditingEntry = (onSave: () => Promise<void>) => (
    <WizardPersonEntry
      form={entryForm}
      onFormChange={setEntryForm}
      busy={busy}
      getApiAccessToken={getApiAccessToken}
      saveLabel="Save"
      onClose={() => setEditingId(null)}
      onSave={() => void run(onSave)}
      {...suggestedRelationEntryProps(entryForm)}
    />
  );

  const renderDraftEntry = (
    draft: WizardDraft,
    onSave: (form: PersonFormState) => Promise<void>,
    opts?: { lockedCore?: string },
  ) => (
    <WizardPersonEntry
      key={draft.draftId}
      form={draft.form}
      onFormChange={(next) => patchDraftForm(draft.draftId, next)}
      busy={busy}
      getApiAccessToken={getApiAccessToken}
      saveLabel="Save"
      onClose={() => removeDraftById(draft.draftId)}
      onSave={() =>
        void run(async () => {
          await onSave(draft.form);
          removeDraftById(draft.draftId);
        })
      }
      {...(opts?.lockedCore
        ? {
            relationCoreLocked: true,
            defaultCore: opts.lockedCore,
            relationInDetails: true,
            showRelationFields: false,
          }
        : suggestedRelationEntryProps(draft.form))}
    />
  );

  const confirmReplace = (label: string): boolean => {
    return window.confirm(
      `Replace ${label}? The previous person stays on your tree but will no longer fill this slot.`,
    );
  };

  const saveParentSlot = async (
    slot: "mother" | "father" | "stepMother" | "stepFather",
    form: PersonFormState,
  ) => {
    if (!form.name.trim()) return;

    const existing =
      slot === "mother"
        ? prefill.parentSlots.mother
        : slot === "father"
          ? prefill.parentSlots.father
          : slot === "stepMother"
            ? prefill.parentSlots.stepMother
            : prefill.parentSlots.stepFather;

    if (existing && existing.id !== editingId && !confirmReplace(slot)) return;

    await run(async () => {
      if (editingId) {
        const prev = bundle.people.find((p) => p.id === editingId);
        await persistPersonPatch(deps, editingId, form, {
          previousCore: prev?.relation_core,
          previousPrefixTokens: prev?.relation_prefix_tokens,
          previousSuffixTokens: prev?.relation_suffix_tokens,
        });
      } else {
        const isStep = slot === "stepMother" || slot === "stepFather";
        await persistNewPerson(deps, form, {
          isCreate: true,
          setSelfStepMother: slot === "stepMother",
          setSelfStepFather: slot === "stepFather",
          linkSelfParents: !isStep,
        });
        if (slot === "mother") setMotherForm(defaultMotherForm());
        if (slot === "father") setFatherForm(defaultFatherForm());
        if (slot === "stepMother") setShowStepMotherForm(false);
        if (slot === "stepFather") setShowStepFatherForm(false);
      }
    });
  };

  const renderYouPage = () => {
    const self = prefill.self;
    if (!self) return null;
    return (
      <WizardStepShell pageId="you" hasPrior={hasPrior} hasNext={hasNext} helper="Add a photo for your place on the tree.">
        <Stack gap="3">
          <Text fontSize={APP_TEXT_SIZES.body} color="fg">
            {self.name}
          </Text>
          <PersonImageField
            imageKey={selfImageKey}
            imageUrl={self.image_url}
            onImageKeyChange={setSelfImageKey}
            getApiAccessToken={getApiAccessToken}
            disabled={busy}
          />
          <HStack justify="flex-end">
            <PondButton
              type="button"
              colorPalette="lilypad"
              size="sm"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await persistSelfImage(deps, self, selfImageKey);
                })
              }
            >
              Save photo
            </PondButton>
          </HStack>
        </Stack>
      </WizardStepShell>
    );
  };

  const renderParentSlot = (
    label: string,
    slot: "mother" | "father",
    person: PeoplePerson | null,
    form: PersonFormState,
    setForm: (next: PersonFormState) => void,
  ) => (
    <Stack gap="2" key={slot} {...PANEL_NESTED_BLOCK_PROPS}>
      <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
        {label}
      </Text>
      {person && editingId !== person.id ? (
        <PrefillCard person={person} hideEdit={entryInProgress} onEdit={() => startEdit(person)} />
      ) : (
        <WizardPersonEntry
          form={editingId === person?.id ? entryForm : form}
          onFormChange={editingId === person?.id ? setEntryForm : setForm}
          busy={busy}
          getApiAccessToken={getApiAccessToken}
          saveLabel="Save"
          onSave={() => void saveParentSlot(slot, editingId === person?.id ? entryForm : form)}
          {...suggestedRelationEntryProps(editingId === person?.id ? entryForm : form)}
        />
      )}
    </Stack>
  );

  const renderStepParentSlot = (
    addLabel: string,
    heading: string,
    slot: "stepMother" | "stepFather",
    person: PeoplePerson | null,
    showForm: boolean,
    onShowForm: () => void,
    onHideForm: () => void,
  ) => {
    if (person && editingId !== person.id) {
      return (
        <Stack gap="2" key={slot} {...PANEL_NESTED_BLOCK_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
            {heading}
          </Text>
          <PrefillCard person={person} hideEdit={entryInProgress} onEdit={() => startEdit(person)} />
        </Stack>
      );
    }
    if (showForm || editingId === person?.id) {
      return (
        <Stack gap="2" key={slot} {...PANEL_NESTED_BLOCK_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
            {heading}
          </Text>
          <WizardPersonEntry
            form={entryForm}
            onFormChange={setEntryForm}
            busy={busy}
            getApiAccessToken={getApiAccessToken}
            saveLabel="Save"
            onSave={() => void saveParentSlot(slot, entryForm)}
            onClose={() => {
              onHideForm();
              if (person && editingId === person.id) setEditingId(null);
            }}
            {...suggestedRelationEntryProps(entryForm)}
          />
        </Stack>
      );
    }
    if (parentsAddBlocked) return null;
    return (
      <PondButton
        key={slot}
        type="button"
        size="sm"
        variant="outline"
        colorPalette="sky"
        onClick={onShowForm}
      >
        {addLabel}
      </PondButton>
    );
  };

  const editingExtraParent =
    editingId != null && prefill.parentSlots.extra.some((p) => p.id === editingId);

  const renderParentsPage = () => (
    <WizardStepShell pageId="parents" hasPrior={hasPrior} hasNext={hasNext}>
      <Stack gap="3">
        {renderParentSlot(
          "Mother",
          "mother",
          prefill.parentSlots.mother,
          motherForm,
          setMotherForm,
        )}
        {renderParentSlot(
          "Father",
          "father",
          prefill.parentSlots.father,
          fatherForm,
          setFatherForm,
        )}
        {renderStepParentSlot(
          "Add step-mother",
          "Step-mother",
          "stepMother",
          prefill.parentSlots.stepMother,
          showStepMotherForm,
          () => {
            setShowStepMotherForm(true);
            setEntryForm(
              newEntryForm({ core: "mother", prefix: ["step"], gender: "female" }),
            );
          },
          () => setShowStepMotherForm(false),
        )}
        {renderStepParentSlot(
          "Add step-father",
          "Step-father",
          "stepFather",
          prefill.parentSlots.stepFather,
          showStepFatherForm,
          () => {
            setShowStepFatherForm(true);
            setEntryForm(newEntryForm({ core: "father", prefix: ["step"], gender: "male" }));
          },
          () => setShowStepFatherForm(false),
        )}
        {prefill.parentSlots.extra.map((p) =>
          editingId === p.id ? null : (
            <PrefillCard key={p.id} person={p} hideEdit={entryInProgress} onEdit={() => startEdit(p)} />
          ),
        )}
        {draftsOf("extraParent").map((draft, index) => (
          <Stack key={draft.draftId} gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
              {draftsOf("extraParent").length > 1
                ? `Other parent figure (${index + 1})`
                : "Other parent figure"}
            </Text>
            {renderDraftEntry(draft, async (form) => {
              await persistNewPerson(deps, form);
            })}
          </Stack>
        ))}
        {editingExtraParent ? renderEditingEntry(async () => {
          const prev = bundle.people.find((p) => p.id === editingId);
          if (!editingId || !prev) return;
          await persistPersonPatch(deps, editingId, entryForm, {
            previousCore: prev.relation_core,
            previousPrefixTokens: prev.relation_prefix_tokens,
            previousSuffixTokens: prev.relation_suffix_tokens,
          });
        }) : null}
        {!parentsAddBlocked ? (
          <PondButton
            type="button"
            size="sm"
            variant="outline"
            colorPalette="sky"
            onClick={() => {
              setEditingId(null);
              pushDraft(newWizardDraft("extraParent", { core: "mother" }));
            }}
          >
            Add another parent figure
          </PondButton>
        ) : null}
      </Stack>
    </WizardStepShell>
  );

  const renderRepeatablePage = (
    pageId: WizardPageId,
    kind: WizardDraftKind,
    helper: string,
    people: PeoplePerson[],
    makeForm: () => PersonFormState,
    onSave: (form: PersonFormState) => Promise<void>,
    opts?: { addButtonLabel?: string },
  ) => {
    const pageDrafts = draftsOf(kind);
    return (
      <WizardStepShell pageId={pageId} hasPrior={hasPrior} hasNext={hasNext} helper={helper}>
        <Stack gap="3">
          {people.map((p) =>
            editingId === p.id ? null : (
              <PrefillCard key={p.id} person={p} hideEdit={entryInProgress} onEdit={() => startEdit(p)} />
            ),
          )}
          {editingId && people.some((p) => p.id === editingId)
            ? renderEditingEntry(async () => {
                const prev = bundle.people.find((p) => p.id === editingId);
                if (!editingId || !prev) return;
                await persistPersonPatch(deps, editingId, entryForm, {
                  previousCore: prev.relation_core,
                  previousPrefixTokens: prev.relation_prefix_tokens,
                  previousSuffixTokens: prev.relation_suffix_tokens,
                });
              })
            : null}
          {pageDrafts.map((draft) => renderDraftEntry(draft, onSave))}
          {!entryInProgress ? (
            <PondButton
              type="button"
              size="sm"
              variant="outline"
              colorPalette="sky"
              onClick={() => {
                setEditingId(null);
                pushDraft(newWizardDraft(kind, makeForm()));
              }}
            >
              {opts?.addButtonLabel ?? "Add another"}
            </PondButton>
          ) : null}
        </Stack>
      </WizardStepShell>
    );
  };

  const renderSiblingsPage = () => (
    <WizardStepShell
      pageId="siblings"
      hasPrior={hasPrior}
      hasNext={hasNext}
      helper="Add brothers, sisters, or nonbinary siblings. Optional: add a spouse for each sibling."
    >
      <Stack gap="4">
        {prefill.siblings.map((sib) => {
          const spouse = siblingSpousePerson(bundle, sib);
          return (
            <Stack key={sib.id} gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
              {editingId !== sib.id ? (
                <PrefillCard person={sib} hideEdit={entryInProgress} onEdit={() => startEdit(sib)} />
              ) : editingId === sib.id ? (
                renderEditingEntry(async () => {
                  const prev = bundle.people.find((p) => p.id === editingId);
                  if (!editingId || !prev) return;
                  await persistPersonPatch(deps, editingId, entryForm, {
                    previousCore: prev.relation_core,
                    previousPrefixTokens: prev.relation_prefix_tokens,
                    previousSuffixTokens: prev.relation_suffix_tokens,
                  });
                })
              ) : null}
              {spouse ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" pl="2">
                  {sib.name}&apos;s spouse: {spouse.name} ({relationLabelFromForm(personToFormState(spouse))})
                </Text>
              ) : spouseForSiblingId === sib.id ? (
                <Stack gap="1" pl="2">
                  <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
                    {sib.name}&apos;s spouse
                  </Text>
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    Not your spouse — a partner line links them to {sib.name} on the tree. Adjust
                    their relation to you under Add details if you like.
                  </Text>
                  <WizardPersonEntry
                    form={spouseForm}
                    onFormChange={setSpouseForm}
                    busy={busy}
                    getApiAccessToken={getApiAccessToken}
                    saveLabel="Save"
                    {...suggestedRelationEntryProps(spouseForm)}
                    onClose={() => {
                      setSpouseForSiblingId(null);
                      setSpouseForm(newSiblingSpouseForm(sib));
                    }}
                    onSave={() =>
                      void run(async () => {
                        await persistNewPerson(deps, spouseForm, {
                          partnershipWithId: sib.id,
                        });
                        setSpouseForSiblingId(null);
                        setSpouseForm(newSiblingSpouseForm(sib));
                      })
                    }
                  />
                </Stack>
              ) : entryInProgress ? null : (
                <PondButton
                  type="button"
                  size="xs"
                  variant="outline"
                  colorPalette="sky"
                  ml="2"
                  onClick={() => {
                    setSpouseForSiblingId(sib.id);
                    setSpouseForm(newSiblingSpouseForm(sib));
                  }}
                >
                  Add spouse
                </PondButton>
              )}
            </Stack>
          );
        })}
        {draftsOf("sibling").map((draft) => (
          <Stack key={draft.draftId} gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
              New sibling
            </Text>
            {renderDraftEntry(draft, async (form) => {
              await persistNewPerson(deps, form);
            })}
          </Stack>
        ))}
        {!entryInProgress ? (
          <HStack gap="2" flexWrap="wrap">
            {(
              [
                { label: "brother", core: "brother", gender: "male" },
                { label: "sister", core: "sister", gender: "female" },
                { label: "nonbinary sibling", core: "brother", gender: "other", alias: "Sibling" },
              ] as const
            ).map((spec) => (
              <PondButton
                key={spec.label}
                type="button"
                size="sm"
                variant="outline"
                colorPalette="lilypad"
                onClick={() =>
                  pushDraft(
                    newWizardDraft("sibling", {
                      core: spec.core,
                      gender: spec.gender,
                      ...("alias" in spec && spec.alias ? { alias: spec.alias } : {}),
                    }),
                  )
                }
              >
                Add {spec.label}
              </PondButton>
            ))}
          </HStack>
        ) : null}
      </Stack>
    </WizardStepShell>
  );

  const renderChildrenPage = () => (
    <WizardStepShell pageId="children" hasPrior={hasPrior} hasNext={hasNext}>
      <Stack gap="3">
        <HStack gap="2">
          <PondButton
            type="button"
            size="sm"
            variant={childKind === "child" ? "solid" : "outline"}
            colorPalette="lilypad"
            onClick={() => setChildKind("child")}
          >
            Child
          </PondButton>
          <PondButton
            type="button"
            size="sm"
            variant={childKind === "pet" ? "solid" : "outline"}
            colorPalette="lilypad"
            onClick={() => setChildKind("pet")}
          >
            Pet
          </PondButton>
        </HStack>
        {[...prefill.children, ...prefill.pets].map((p) =>
          editingId === p.id ? null : (
            <PrefillCard key={p.id} person={p} hideEdit={entryInProgress} onEdit={() => startEdit(p)} />
          ),
        )}
        {editingId &&
        [...prefill.children, ...prefill.pets].some((p) => p.id === editingId)
          ? renderEditingEntry(async () => {
              const prev = bundle.people.find((p) => p.id === editingId);
              if (!editingId || !prev) return;
              await persistPersonPatch(deps, editingId, entryForm, {
                previousCore: prev.relation_core,
              });
            })
          : null}
        {draftsOf("child").map((draft) => (
          <Stack key={draft.draftId} gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
              New {draft.form.core === "pet" ? "pet" : "child"}
            </Text>
            {renderDraftEntry(
              draft,
              async (form) => {
                if (form.core === "pet") {
                  await persistNewPerson(deps, { ...form, core: "pet" });
                } else {
                  await persistChildOfSelf(deps, form);
                }
              },
              draft.form.core === "pet" ? { lockedCore: "pet" } : undefined,
            )}
          </Stack>
        ))}
        {!entryInProgress ? (
          <PondButton
            type="button"
            size="sm"
            variant="outline"
            colorPalette="lilypad"
            onClick={() => {
              setEditingId(null);
              pushDraft(
                newWizardDraft("child", { core: childKind === "pet" ? "pet" : "child" }),
              );
            }}
          >
            Add {childKind === "pet" ? "pet" : "child"}
          </PondButton>
        ) : null}
      </Stack>
    </WizardStepShell>
  );

  const renderGrandparentsPage = () => {
    const self = prefill.self;
    const sides: { id: string; label: string; side: "Maternal" | "Paternal" }[] = [];
    if (self?.bio_mother_id) {
      const mom = bundle.people.find((p) => p.id === self.bio_mother_id);
      sides.push({
        id: self.bio_mother_id,
        label: mom?.name ?? "Mother",
        side: "Maternal",
      });
    }
    if (self?.bio_father_id) {
      const dad = bundle.people.find((p) => p.id === self.bio_father_id);
      sides.push({
        id: self.bio_father_id,
        label: dad?.name ?? "Father",
        side: "Paternal",
      });
    }

    return (
      <WizardStepShell
        pageId="grandparents"
        hasPrior={hasPrior}
        hasNext={hasNext}
        helper={
          sides.length === 0
            ? "Add biological parents on the Parents page first, then you can add grandparents here."
            : "Add grandparents for each side. You can add more than two per side (e.g. step-grandparents)."
        }
      >
        <Stack gap="4">
          {sides.map(({ id, label, side }) => {
            const gps = prefill.grandparentsByParent[id] ?? [];
            return (
              <Stack key={id} gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
                <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
                  {side} — {label}&apos;s parents
                </Text>
                {gps.map((g) =>
                  editingId === g.id ? null : (
                    <PrefillCard key={g.id} person={g} hideEdit={entryInProgress} onEdit={() => startEdit(g)} />
                  ),
                )}
                {editingId && gps.some((g) => g.id === editingId)
                  ? renderEditingEntry(async () => {
                      const prev = bundle.people.find((p) => p.id === editingId);
                      if (!editingId || !prev) return;
                      await persistPersonPatch(deps, editingId, entryForm, {
                        previousCore: prev.relation_core,
                        previousPrefixTokens: prev.relation_prefix_tokens,
                        previousSuffixTokens: prev.relation_suffix_tokens,
                      });
                    })
                  : null}
                {draftsOf("grandparent")
                  .filter((d) => d.grandparentParentId === id)
                  .map((draft) => (
                    <Stack key={draft.draftId} gap="2">
                      {renderDraftEntry(draft, async (form) => {
                        await persistGrandparent(deps, form, id);
                      })}
                    </Stack>
                  ))}
                {!entryInProgress ? (
                  <HStack gap="2" flexWrap="wrap">
                    <PondButton
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="lilypad"
                      onClick={() => {
                        setEditingId(null);
                        pushDraft(
                          newWizardDraft("grandparent", { core: "grandma" }, { grandparentParentId: id }),
                        );
                      }}
                    >
                      Add {side} grandmother
                    </PondButton>
                    <PondButton
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="lilypad"
                      onClick={() => {
                        setEditingId(null);
                        pushDraft(
                          newWizardDraft("grandparent", { core: "grandpa" }, { grandparentParentId: id }),
                        );
                      }}
                    >
                      Add {side} grandfather
                    </PondButton>
                    <PondButton
                      type="button"
                      size="sm"
                      variant="outline"
                      colorPalette="sky"
                      onClick={() => {
                        setEditingId(null);
                        pushDraft(
                          newWizardDraft("grandparent", { core: "grandma" }, { grandparentParentId: id }),
                        );
                      }}
                    >
                      Add another
                    </PondButton>
                  </HStack>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      </WizardStepShell>
    );
  };

  const pageContent = () => {
    switch (pageId) {
      case "you":
        return renderYouPage();
      case "parents":
        return renderParentsPage();
      case "siblings":
        return renderSiblingsPage();
      case "children":
        return renderChildrenPage();
      case "grandparents":
        return renderGrandparentsPage();
      case "spouse":
        return renderRepeatablePage(
          "spouse",
          "spouse",
          "Add a spouse or partner. A partner line will connect them to you on the tree.",
          prefill.spouses,
          () => newEntryForm({ core: "spouse" }),
          async (form) => {
            await persistSpouseWithSelf(deps, form);
          },
          { addButtonLabel: "Add spouse or partner" },
        );
      case "aunts":
        return renderRepeatablePage(
          "aunts",
          "aunt",
          "Add aunts and uncles. Adjust relation to me under Add details if the default does not fit.",
          prefill.auntsUncles,
          () => newEntryForm({ core: "aunt" }),
          async (form) => {
            await persistNewPerson(deps, form);
          },
          { addButtonLabel: "Add aunt or uncle" },
        );
      case "cousins":
        return renderRepeatablePage(
          "cousins",
          "cousin",
          "Add cousins.",
          prefill.cousins,
          () => newEntryForm({ core: "cousin" }),
          async (form) => {
            await persistNewPerson(deps, form);
          },
          { addButtonLabel: "Add cousin" },
        );
      case "nieces":
        return (
          <WizardStepShell
            pageId="nieces"
            hasPrior={hasPrior}
            hasNext={hasNext}
            helper="Add nieces and nephews under each sibling."
          >
            <Stack gap="4">
              {prefill.siblings.map((sib) => {
                const spouse = siblingSpousePerson(bundle, sib);
                return (
                  <Stack key={sib.id} gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
                    <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
                      {siblingHouseholdTitle(sib, spouse)}
                    </Text>
                    {(prefill.niecesBySibling[sib.id] ?? []).map((n) =>
                      editingId === n.id ? null : (
                        <PrefillCard key={n.id} person={n} hideEdit={entryInProgress} onEdit={() => startEdit(n)} />
                      ),
                    )}
                    {editingId &&
                    (prefill.niecesBySibling[sib.id] ?? []).some((n) => n.id === editingId)
                      ? renderEditingEntry(async () => {
                          const prev = bundle.people.find((p) => p.id === editingId);
                          if (!editingId || !prev) return;
                          await persistPersonPatch(deps, editingId, entryForm, {
                            previousCore: prev.relation_core,
                            previousPrefixTokens: prev.relation_prefix_tokens,
                            previousSuffixTokens: prev.relation_suffix_tokens,
                          });
                        })
                      : null}
                    {draftsOf("niece")
                      .filter((d) => d.nieceSiblingId === sib.id)
                      .map((draft) => (
                        <Stack key={draft.draftId} gap="2">
                          {renderDraftEntry(draft, async (form) => {
                            await persistNewPerson(deps, form, {
                              nieceSibling: sib,
                              nieceSecondParentId: spouse?.id,
                            });
                          })}
                        </Stack>
                      ))}
                    {!entryInProgress ? (
                    <HStack gap="2" flexWrap="wrap">
                      <PondButton
                        type="button"
                        size="sm"
                        variant="outline"
                        colorPalette="lilypad"
                        onClick={() => {
                          setEditingId(null);
                          pushDraft(
                            newWizardDraft("niece", { core: "niece" }, { nieceSiblingId: sib.id }),
                          );
                        }}
                      >
                        Add niece
                      </PondButton>
                      <PondButton
                        type="button"
                        size="sm"
                        variant="outline"
                        colorPalette="lilypad"
                        onClick={() => {
                          setEditingId(null);
                          pushDraft(
                            newWizardDraft("niece", { core: "nephew" }, { nieceSiblingId: sib.id }),
                          );
                        }}
                      >
                        Add nephew
                      </PondButton>
                    </HStack>
                    ) : null}
                  </Stack>
                );
              })}
            </Stack>
          </WizardStepShell>
        );
      case "friends":
        return renderRepeatablePage(
          "friends",
          "friend",
          "Add friends to the bottom row of your tree.",
          prefill.friends,
          () => newEntryForm({ core: "friend" }),
          async (form) => {
            await persistNewPerson(deps, form);
          },
          { addButtonLabel: "Add friend" },
        );
      default:
        return null;
    }
  };

  /** svh = visible viewport on mobile (avoids 100dvh extending under browser chrome). */
  const shellHeight = isMobile ? "100svh" : "min(100dvh, 720px)";

  const navFooter = (
    <HStack
      gap="2"
      flexWrap="wrap"
      justify="space-between"
      w="full"
      pt="2"
      pb={{
        base: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        md: "2",
      }}
      px={{ base: "3", md: "4" }}
      borderTopWidth="1px"
      borderColor="border"
      bg="bg.panel"
    >
      <PondButton
        type="button"
        variant="outline"
        colorPalette="sky"
        size="sm"
        disabled={!hasPrior || busy}
        onClick={goBack}
      >
        Back
      </PondButton>
      <HStack gap="2">
        <PondButton
          type="button"
          variant="ghost"
          colorPalette="sky"
          size="sm"
          disabled={busy}
          onClick={goNext}
        >
          Skip
        </PondButton>
        {isLast ? (
          <PondButton
            type="button"
            colorPalette="lilypad"
            size="sm"
            disabled={busy}
            onClick={() => handleClose(false)}
          >
            Finish
          </PondButton>
        ) : (
          <PondButton
            type="button"
            colorPalette="lilypad"
            size="sm"
            disabled={busy}
            onClick={goNext}
          >
            Next
          </PondButton>
        )}
      </HStack>
    </HStack>
  );

  return (
    <AppModal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose(markAutoOpenDisabledOnClose);
        else onOpenChange(true);
      }}
      showHeader={false}
      size="xl"
      rootProps={{ scrollBehavior: "inside" }}
      positionerProps={
        isMobile
          ? {
              position: "fixed",
              inset: "0",
              px: "0",
              py: "0",
              m: "0",
              h: shellHeight,
              maxH: { base: "100dvh", md: shellHeight },
              w: "100vw",
              overflow: "hidden",
              alignItems: "stretch",
              justifyContent: "stretch",
            }
          : {
              px: "0",
              py: "0",
              overflow: "hidden",
              alignItems: "stretch",
              justifyContent: "stretch",
            }
      }
      contentProps={
        isMobile
          ? {
              maxW: "100vw",
              w: "100vw",
              h: shellHeight,
              maxH: shellHeight,
              minH: "0",
              m: "0",
              gap: "0",
              borderRadius: "0",
              borderWidth: "0",
              p: "0",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }
          : {
              maxW: "42rem",
              w: "min(100vw, 42rem)",
              h: shellHeight,
              maxH: shellHeight,
              minH: "0",
              m: "0",
              gap: "0",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }
      }
      bodyProps={{
        flex: "1 1 0",
        display: "flex",
        flexDirection: "column",
        minH: "0",
        h: "100%",
        overflow: "hidden",
        p: "0",
      }}
    >
      <Box
        h="100%"
        maxH={shellHeight}
        w="full"
        overflow="hidden"
        display="grid"
        gridTemplateRows="auto minmax(0, 1fr) auto"
        gridTemplateColumns="1fr"
      >
        <Stack
          gap="2"
          flexShrink={0}
          px={{ base: "3", md: "4" }}
          pt={{
            base: "max(0.75rem, env(safe-area-inset-top, 0px))",
            md: "4",
          }}
          pb="2"
        >
          <HStack justify="space-between" align="center">
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
              Set up your family tree
            </Text>
            <PondButton
              type="button"
              size="sm"
              variant="ghost"
              colorPalette="sky"
              onClick={() => handleClose(true)}
            >
              Close
            </PondButton>
          </HStack>
          {error ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="red.500">
              {error}
            </Text>
          ) : null}
        </Stack>

        <Box
          minH="0"
          overflowY="auto"
          overflowX="hidden"
          overscrollBehavior="contain"
          px={{ base: "3", md: "4" }}
          css={{ ...HIDE_SCROLLBAR_CSS, WebkitOverflowScrolling: "touch" }}
        >
          {pageContent()}
        </Box>

        {navFooter}
      </Box>
    </AppModal>
  );
}
