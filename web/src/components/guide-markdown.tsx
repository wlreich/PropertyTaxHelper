import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Server-render trusted editorial GFM; raw HTML is never executed. */
export function GuideMarkdown({ markdown, label }: { markdown: string; label: string }) {
  return <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    h3: ({ children }) => <h5>{children}</h5>,
    table: ({ children }) => <div className="guide-table-scroll" role="region" aria-label={`${label}: scrollable table`} tabIndex={0}><table>{children}</table></div>,
    th: ({ children }) => <th scope="col">{children}</th>,
    p: ({ children, node }) => {
      const text = node?.children?.[0];
      const founder = text?.type === 'element' && text.tagName === 'strong' && text.children.some(child => child.type === 'text' && child.value.startsWith('From the founder'));
      return <p className={founder ? 'guide-founder-note' : undefined}>{children}</p>;
    },
  }}>{markdown}</Markdown>;
}
