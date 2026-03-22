import type {
  RequestUserInputQuestion,
  RequestUserInputRequest,
  RequestUserInputResponse,
} from "../../../types";

export type RequestUserInputSelectionState = Record<string, number | null>;
export type RequestUserInputNotesState = Record<string, string>;

export function getRequestUserInputQuestionKey(
  question: RequestUserInputQuestion,
  index: number
): string {
  return question.id || `question-${index}`;
}

export function getRequestUserInputSelectedIndex(
  options: RequestUserInputQuestion["options"] | undefined,
  selectedIndex: number | null | undefined
): number | null {
  const optionCount = options?.length ?? 0;
  if (optionCount === 0) {
    return null;
  }
  if (selectedIndex === null || selectedIndex === undefined) {
    return 0;
  }
  return selectedIndex >= 0 && selectedIndex < optionCount ? selectedIndex : 0;
}

export function getRequestUserInputNoteKey(
  questionKey: string,
  hasOptions: boolean,
  selectedIndex: number | null
): string {
  return hasOptions ? `${questionKey}::${selectedIndex ?? 0}` : questionKey;
}

export function createInitialRequestUserInputState(request: RequestUserInputRequest): {
  selections: RequestUserInputSelectionState;
  notes: RequestUserInputNotesState;
} {
  const selections: RequestUserInputSelectionState = {};
  const notes: RequestUserInputNotesState = {};

  request.params.questions.forEach((question, index) => {
    const questionKey = getRequestUserInputQuestionKey(question, index);
    const hasOptions = (question.options?.length ?? 0) > 0;
    const selectedIndex = hasOptions ? 0 : null;
    selections[questionKey] = selectedIndex;
    notes[getRequestUserInputNoteKey(questionKey, hasOptions, selectedIndex)] = "";
  });

  return { selections, notes };
}

function buildQuestionAnswerList(
  question: RequestUserInputQuestion,
  questionKey: string,
  selections: RequestUserInputSelectionState,
  notes: RequestUserInputNotesState
): string[] {
  const answers: string[] = [];
  const options = question.options ?? [];
  const hasOptions = options.length > 0;
  const selectedIndex = getRequestUserInputSelectedIndex(options, selections[questionKey]);

  if (selectedIndex !== null) {
    const selectedOption = options[selectedIndex];
    const selectedValue =
      selectedOption?.label?.trim() || selectedOption?.description?.trim() || "";
    if (selectedValue) {
      answers.push(selectedValue);
    }
  }

  const noteKey = getRequestUserInputNoteKey(questionKey, hasOptions, selectedIndex);
  const note = (notes[noteKey] ?? "").trim();
  if (!note) {
    return hasOptions ? answers : ["skipped"];
  }

  answers.push(hasOptions ? `user_note: ${note}` : note);
  return answers;
}

export function buildRequestUserInputResponse(
  request: RequestUserInputRequest,
  selections: RequestUserInputSelectionState,
  notes: RequestUserInputNotesState
): RequestUserInputResponse {
  const answers: RequestUserInputResponse["answers"] = {};

  request.params.questions.forEach((question, index) => {
    if (!question.id) {
      return;
    }
    const questionKey = getRequestUserInputQuestionKey(question, index);
    answers[question.id] = {
      answers: buildQuestionAnswerList(question, questionKey, selections, notes),
    };
  });

  return { answers };
}
