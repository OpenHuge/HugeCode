import { Button, Icon } from "../../../design-system";
import Check from "lucide-react/dist/esm/icons/check";
import type { RequestUserInputQuestion } from "../../../types";
import { joinClassNames } from "../../../utils/classNames";
import { ComposerResolverPanel } from "./ComposerResolverPanel";
import * as styles from "./ComposerPendingUserInputPanel.css";

type ComposerPendingUserInputPanelProps = {
  requestIndex: number;
  requestCount: number;
  question: RequestUserInputQuestion;
  questionIndex: number;
  questionCount: number;
  selectedIndex: number | null;
  onSelectOption: (index: number) => void;
};

export function ComposerPendingUserInputPanel({
  requestIndex,
  requestCount,
  question,
  questionIndex,
  questionCount,
  selectedIndex,
  onSelectOption,
}: ComposerPendingUserInputPanelProps) {
  const options = question.options ?? [];
  const hasOptions = options.length > 0;

  return (
    <ComposerResolverPanel
      ariaLabel="Pending answers"
      headerClassName={styles.panelHeader}
      header={
        <>
          <div className={styles.progressRow}>
            <span className={styles.progressBadge}>{`${questionIndex + 1}/${questionCount}`}</span>
            {requestCount > 1 ? (
              <span
                className={styles.sectionLabel}
              >{`Request ${requestIndex} of ${requestCount}`}</span>
            ) : null}
          </div>
          {question.header ? <div className={styles.sectionLabel}>{question.header}</div> : null}
        </>
      }
      title={question.question}
      titleClassName={styles.question}
      helper={
        hasOptions
          ? "Choose the best fit below, then add any custom note in the main composer."
          : "Type your answer in the main composer below. Leave it blank to skip."
      }
      helperClassName={styles.helper}
      footer="Press 1-9 to choose an option. Your normal draft is preserved and will return when this request is resolved."
      footerClassName={styles.footerNote}
    >
      {hasOptions ? (
        <div className={styles.optionList} role="list">
          {options.map((option, index) => {
            const isSelected = selectedIndex === index;
            return (
              <Button
                key={`${question.id || question.question}-${option.label}-${index}`}
                type="button"
                variant="ghost"
                className={joinClassNames(
                  styles.optionButton,
                  isSelected && styles.optionButtonSelected
                )}
                onClick={() => onSelectOption(index)}
              >
                <span
                  className={joinClassNames(
                    styles.optionIndex,
                    isSelected && styles.optionIndexSelected
                  )}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.description ? (
                    <span className={styles.optionDescription}>{option.description}</span>
                  ) : null}
                </span>
                <span className={styles.optionCheck} aria-hidden>
                  {isSelected ? <Icon icon={Check} size="sm" /> : null}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </ComposerResolverPanel>
  );
}
