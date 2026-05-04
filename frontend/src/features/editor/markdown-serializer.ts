import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownSerializer,
  MarkdownParser,
} from 'prosemirror-markdown';
import { markdownSchema } from './markdown-schema';
import type { Node as PMNode } from 'prosemirror-model';

// Omit image token since we don't support images in the schema yet
const tokens = { ...defaultMarkdownParser.tokens };
delete tokens.image;

// Use the default parser from prosemirror-markdown with our schema.
// It already handles all commonmark tokens correctly.
export const markdownParser = new MarkdownParser(
  markdownSchema,
  defaultMarkdownParser.tokenizer,
  tokens,
);

// Extend the default serializer with our custom nodes/marks (strike, code_block with language)
const baseNodes = { ...defaultMarkdownSerializer.nodes };
const baseMarks = { ...defaultMarkdownSerializer.marks };

export const markdownSerializer = new MarkdownSerializer(
  {
    ...baseNodes,
    code_block(state, node) {
      state.write('```' + ((node.attrs.language as string) || '') + '\n');
      state.text(node.textContent);
      state.ensureNewLine();
      state.write('```');
      state.closeBlock(node);
    },
  },
  {
    ...baseMarks,
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
  },
);

export function parseMarkdown(content: string) {
  return markdownParser.parse(content);
}

export function serializeMarkdown(doc: PMNode) {
  return markdownSerializer.serialize(doc);
}
