export function insertComposerLineBreak({
  text,
  selectionStart,
  selectionEnd,
}: {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}) {
  const nextText = `${text.slice(0, selectionStart)}\n${text.slice(selectionEnd)}`;
  return {
    nextText,
    nextCursor: selectionStart + 1,
  };
}
