import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type UpdateToastReleaseNotesProps = {
  body: string;
  onOpenExternalUrl: (url: string) => void | Promise<void>;
};

export function UpdateToastReleaseNotes({ body, onOpenExternalUrl }: UpdateToastReleaseNotesProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          if (!href) {
            return <span>{children}</span>;
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                event.preventDefault();
                void onOpenExternalUrl(href);
              }}
            >
              {children}
            </a>
          );
        },
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
