export const REVIEW_PACK_EMPTY_SECTION_LABELS = {
  assumptions: "The runtime did not record explicit review assumptions for this pack.",
  warnings: "The runtime did not record any warnings for this review pack.",
  artifacts: "No artifacts or evidence references were attached to this review pack.",
  reproduction:
    "The runtime did not record reproduction guidance for this review pack. Re-run the linked validations or inspect attached evidence.",
  rollback:
    "The runtime did not record rollback guidance for this review pack. Use diff evidence or reopen the mission thread before reverting changes.",
} as const;

export const MISSION_RUN_EMPTY_SECTION_LABELS = {
  warnings: "The runtime did not record warnings for this mission run.",
  validations: "No runtime validation details were recorded for this mission run.",
  artifacts: "No runtime artifacts or evidence references were attached to this mission run.",
  autoDrive: "This run did not publish an AutoDrive route snapshot.",
} as const;
