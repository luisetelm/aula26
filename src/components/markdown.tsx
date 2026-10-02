import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Markdown sin HTML: react-markdown no interpreta HTML incrustado. GFM añade tablas, tachado y listas de tareas.
export function Markdown({ children }: { children: string }) {
  if (!children.trim()) return null;
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          // Las tablas anchas se desplazan dentro de su caja en vez de romper la página en el móvil.
          table: (props) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
