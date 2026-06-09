import { Streamdown } from 'streamdown';
import remarkGfm from 'remark-gfm';
import { harden } from 'rehype-harden';
import 'streamdown/styles.css';

type Props = { content: string; streaming?: boolean };

export function MarkdownRenderer({ content, streaming = false }: Props): React.ReactElement {
  return (
    <Streamdown
      mode={streaming ? 'streaming' : 'static'}
      parseIncompleteMarkdown={streaming}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[harden, { allowedLinkPrefixes: ['*'] }]]}
    >
      {content}
    </Streamdown>
  );
}