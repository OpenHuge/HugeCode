import MessagesSquare from "lucide-react/dist/esm/icons/messages-square";
import { useEffect, useMemo, useState } from "react";
import type {
  RequestUserInputQuestion,
  RequestUserInputRequest,
  RequestUserInputResponse,
} from "../../../types";
import { Button, RadioGroup } from "../../../design-system";
import {
  buildRequestUserInputResponse,
  createInitialRequestUserInputState,
  getRequestUserInputNoteKey,
  getRequestUserInputQuestionKey,
  getRequestUserInputSelectedIndex,
} from "../utils/requestUserInput";
import { TimelineMessageShell } from "../../messages/components/MessageTimelinePanels";

type RequestUserInputMessageProps = {
  requests: RequestUserInputRequest[];
  activeThreadId: string | null;
  activeWorkspaceId?: string | null;
  onSubmit: (request: RequestUserInputRequest, response: RequestUserInputResponse) => void;
  interactive?: boolean;
};

function questionAssistiveLabel(question: RequestUserInputQuestion): string {
  const header = question.header?.trim();
  const prompt = question.question?.trim();
  if (header && prompt) {
    return `${header}: ${prompt}`;
  }
  if (prompt) {
    return prompt;
  }
  if (header) {
    return header;
  }
  return "request input question";
}

export function RequestUserInputMessage({
  requests,
  activeThreadId,
  activeWorkspaceId,
  onSubmit,
  interactive = true,
}: RequestUserInputMessageProps) {
  const activeRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (!activeThreadId) {
          return false;
        }
        if (request.params.thread_id !== activeThreadId) {
          return false;
        }
        if (activeWorkspaceId && request.workspace_id !== activeWorkspaceId) {
          return false;
        }
        return true;
      }),
    [requests, activeThreadId, activeWorkspaceId]
  );
  const activeRequest = activeRequests[0];
  const [selections, setSelections] = useState<Record<string, number | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeRequest) {
      setSelections({});
      setNotes({});
      return;
    }
    const nextState = createInitialRequestUserInputState(activeRequest);
    setSelections(nextState.selections);
    setNotes(nextState.notes);
  }, [activeRequest]);

  if (!activeRequest) {
    return null;
  }

  const { questions } = activeRequest.params;
  const totalRequests = activeRequests.length;
  const questionSummary = questions.length === 1 ? "1 question" : `${questions.length} questions`;

  const handleSelect = (questionId: string, optionIndex: number) => {
    setSelections((current) => ({ ...current, [questionId]: optionIndex }));
  };

  const handleNotesChange = (noteKey: string, value: string) => {
    setNotes((current) => ({ ...current, [noteKey]: value }));
  };

  const handleSubmit = () => {
    onSubmit(activeRequest, buildRequestUserInputResponse(activeRequest, selections, notes));
  };

  return (
    <TimelineMessageShell modifierClassName="timeline-request-card">
      <div className="request-user-input-header">
        <div className="timeline-status-headline">
          <span className="timeline-status-icon" aria-hidden>
            <MessagesSquare size={16} />
          </span>
          <div className="timeline-status-copy">
            <div className="request-user-input-title">Input requested</div>
            <div className="request-user-input-question-text">
              {interactive
                ? "Answer the active questions here to keep the turn moving."
                : "This request is active in the composer below."}
            </div>
          </div>
        </div>
        <div className="timeline-approval-pill">
          {totalRequests > 1 ? `Request 1 of ${totalRequests}` : questionSummary}
        </div>
      </div>
      <div className="request-user-input-body">
        {questions.length ? (
          interactive ? (
            questions.map((question, index) => {
              const questionId = getRequestUserInputQuestionKey(question, index);
              const options = question.options ?? [];
              const selectedIndex = getRequestUserInputSelectedIndex(
                options,
                selections[questionId]
              );
              const hasOptions = options.length > 0;
              const noteKey = getRequestUserInputNoteKey(questionId, hasOptions, selectedIndex);
              const questionHeaderId = question.header ? `${questionId}-header` : undefined;
              const questionTextId = `${questionId}-prompt`;
              const optionsLabelledBy = questionHeaderId
                ? `${questionHeaderId} ${questionTextId}`
                : questionTextId;
              const isSecret = Boolean(question.isSecret);
              const notePlaceholder = question.isOther
                ? "Type your answer (optional)"
                : isSecret
                  ? "Type secret answer"
                  : hasOptions
                    ? "Add notes (optional)"
                    : "Type your answer (optional)";
              return (
                <section key={questionId} className="request-user-input-question">
                  {question.header ? (
                    <div className="request-user-input-question-header" id={questionHeaderId}>
                      {question.header}
                    </div>
                  ) : null}
                  <div className="request-user-input-question-text" id={questionTextId}>
                    {question.question}
                  </div>
                  {hasOptions ? (
                    <RadioGroup
                      ariaLabelledBy={optionsLabelledBy}
                      groupClassName="request-user-input-options"
                      optionClassName="request-user-input-option"
                      name={`${activeRequest.request_id}-${questionId}`}
                      variant="card"
                      value={selectedIndex === null ? undefined : String(selectedIndex)}
                      onValueChange={(nextValue) => {
                        const nextIndex = Number.parseInt(nextValue, 10);
                        if (!Number.isNaN(nextIndex)) {
                          handleSelect(questionId, nextIndex);
                        }
                      }}
                      options={options.map((option, optionIndex) => ({
                        value: String(optionIndex),
                        label: option.label,
                        description: option.description,
                        leadingLabel: optionIndex + 1,
                      }))}
                    />
                  ) : null}
                  {isSecret ? (
                    <input
                      className="request-user-input-notes"
                      type="password"
                      aria-label={`Notes for ${questionAssistiveLabel(question)}`}
                      placeholder={notePlaceholder}
                      value={notes[noteKey] ?? ""}
                      onChange={(event) => handleNotesChange(noteKey, event.target.value)}
                    />
                  ) : (
                    <textarea
                      className="request-user-input-notes"
                      aria-label={`Notes for ${questionAssistiveLabel(question)}`}
                      placeholder={notePlaceholder}
                      value={notes[noteKey] ?? ""}
                      onChange={(event) => handleNotesChange(noteKey, event.target.value)}
                      rows={2}
                    />
                  )}
                </section>
              );
            })
          ) : (
            <section className="request-user-input-question request-user-input-question--summary">
              {questions[0]?.header ? (
                <div className="request-user-input-question-header">{questions[0].header}</div>
              ) : null}
              <div className="request-user-input-question-text">{questions[0]?.question}</div>
              <div className="request-user-input-empty">
                Continue in the composer below to answer this request.
              </div>
            </section>
          )
        ) : (
          <div className="request-user-input-empty">No questions provided.</div>
        )}
      </div>
      {interactive ? (
        <div className="request-user-input-actions">
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            Submit answers
          </Button>
        </div>
      ) : null}
    </TimelineMessageShell>
  );
}
