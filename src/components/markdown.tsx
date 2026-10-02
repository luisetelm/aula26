import ReactMarkdown from "react-markdown";

// Markdown sin HTML: react-markdown no interpreta HTML incrustado.
export function Markdown({ children }: { children: string }) {
  if (!children.trim()) return null;
  return (
    <div className="md">
      <ReactMarkdown
        components={{ a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
