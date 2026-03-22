import type { RequestUserInputQuestion, RequestUserInputRequest } from "../../../types";
import {
  getRequestUserInputNoteKey,
  getRequestUserInputQuestionKey,
  getRequestUserInputSelectedIndex,
  type RequestUserInputNotesState,
  type RequestUserInputSelectionState,
} from "../../app/utils/requestUserInput";

export type PendingInputDraftView = {
  activeQuestion: RequestUserInputQuestion | null;
  activeQuestionKey: string | null;
  activeSelectedIndex: number | null;
  activeNoteKey: string | null;
  activeAnswerText: string;
};

export function resolvePendingInputDraftView({
  request,
  questionIndex,
  selections,
  notes,
}: {
  request: RequestUserInputRequest | null;
  questionIndex: number;
  selections: RequestUserInputSelectionState;
  notes: RequestUserInputNotesState;
}): PendingInputDraftView {
  const activeQuestion = request?.params.questions[questionIndex] ?? null;
  if (!activeQuestion) {
    return {
      activeQuestion: null,
      activeQuestionKey: null,
      activeSelectedIndex: null,
      activeNoteKey: null,
      activeAnswerText: "",
    };
  }

  const activeQuestionKey = getRequestUserInputQuestionKey(activeQuestion, questionIndex);
  const activeSelectedIndex = getRequestUserInputSelectedIndex(
    activeQuestion.options,
    selections[activeQuestionKey]
  );
  const activeNoteKey = getRequestUserInputNoteKey(
    activeQuestionKey,
    (activeQuestion.options?.length ?? 0) > 0,
    activeSelectedIndex
  );

  return {
    activeQuestion,
    activeQuestionKey,
    activeSelectedIndex,
    activeNoteKey,
    activeAnswerText: notes[activeNoteKey] ?? "",
  };
}

export function getPendingInputAnswerPlaceholder(question: RequestUserInputQuestion | null) {
  if (!question) {
    return "Type your answer";
  }
  if ((question.options?.length ?? 0) > 0) {
    return "Type your own answer, or leave this blank to use the selected option.";
  }
  return "Type your answer, or leave this blank to skip.";
}

export function resolvePendingInputNumberShortcut(optionCount: number, key: string) {
  if (optionCount <= 0 || !/^[1-9]$/.test(key)) {
    return null;
  }
  const nextIndex = Number.parseInt(key, 10) - 1;
  return nextIndex >= 0 && nextIndex < optionCount ? nextIndex : null;
}

export function resolvePendingInputArrowShortcut({
  optionCount,
  key,
  selectedIndex,
}: {
  optionCount: number;
  key: string;
  selectedIndex: number | null;
}) {
  if (
    optionCount <= 0 ||
    (key !== "ArrowDown" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowLeft")
  ) {
    return null;
  }
  const currentIndex = selectedIndex ?? 0;
  const delta = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
  return (currentIndex + delta + optionCount) % optionCount;
}

export function applyPendingInputTextInsertion({
  nextText,
  nextCursor,
  textarea,
  onAnswerChange,
  onSelectionChange,
}: {
  nextText: string;
  nextCursor: number;
  textarea: HTMLTextAreaElement | null;
  onAnswerChange: (value: string) => void;
  onSelectionChange: (selectionStart: number | null) => void;
}) {
  onAnswerChange(nextText);
  requestAnimationFrame(() => {
    if (!textarea) {
      return;
    }
    textarea.focus();
    textarea.setSelectionRange(nextCursor, nextCursor);
    onSelectionChange(nextCursor);
  });
}
