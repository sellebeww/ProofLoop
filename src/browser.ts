// ProofLoop: titik masuk bundel peramban. Mengekspos inti sebagai window.PLCore. © 2026 Vassel Goleyu.
export {
  TRANSITIONS, STAGES, EVENTS, nextStage, canTransition, isGuideEditable,
  publishGuide, startAttempt, submitAttempt, completeReview,
  validateSteps, validateSubmission, validateReview, suggestOutcome, countedAssist,
  ISSUE_KINDS, ASSIST_TYPES, OUTCOME_LABEL, hasEvidence,
  nextVersion, currentVersion, activeAttempt,
} from './domain/workflow.ts';
export { statusKey, isActive, portfolioMetrics, report } from './domain/metrics.ts';
export { usabilityOf, scoreAttempt, WEIGHTS, OUTCOME_POINTS } from './domain/usability.ts';
export {
  guideDocOf, guideToJson, guideToMarkdown, parseGuideFile, importGuideIntoDraft, createProcessFromGuideFile,
  workspaceToJson, parseWorkspaceJson, adoptImport,
} from './io/exchange.ts';
export { diffSteps, diffText } from './domain/diff.ts';
export { setStepEvidence, addComment, deleteComment, MAX_PHOTO_CHARS, MAX_EVIDENCE_TEXT } from './domain/evidence.ts';
