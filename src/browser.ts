// ProofLoop: titik masuk bundel peramban. Mengekspos inti sebagai window.PLCore. © 2026 Vassel Goleyu.
export {
  TRANSITIONS, STAGES, EVENTS, nextStage, canTransition, isGuideEditable,
  publishGuide, startAttempt, submitAttempt, completeReview,
  validateSteps, validateSubmission, validateReview, suggestOutcome, countedAssist,
  ISSUE_KINDS, ASSIST_TYPES, OUTCOME_LABEL, hasEvidence,
  nextVersion, currentVersion, activeAttempt,
} from './domain/workflow.ts';
