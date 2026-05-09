import { Schema } from 'prosemirror-model';
import { schema as defaultSchema } from 'prosemirror-markdown';

export const markdownSchema = new Schema({
  nodes: {
    doc: defaultSchema.spec.nodes.get('doc')!,
    paragraph: defaultSchema.spec.nodes.get('paragraph')!,
    text: defaultSchema.spec.nodes.get('text')!,
    heading: defaultSchema.spec.nodes.get('heading')!,
    blockquote: defaultSchema.spec.nodes.get('blockquote')!,
    image: defaultSchema.spec.nodes.get('image')!,
    code_block: {
      ...defaultSchema.spec.nodes.get('code_block')!,
      attrs: { language: { default: '' } },
    },
    bullet_list: defaultSchema.spec.nodes.get('bullet_list')!,
    ordered_list: defaultSchema.spec.nodes.get('ordered_list')!,
    list_item: defaultSchema.spec.nodes.get('list_item')!,
    horizontal_rule: defaultSchema.spec.nodes.get('horizontal_rule')!,
    hard_break: defaultSchema.spec.nodes.get('hard_break')!,
  },
  marks: {
    em: defaultSchema.spec.marks.get('em')!,
    strong: defaultSchema.spec.marks.get('strong')!,
    code: defaultSchema.spec.marks.get('code')!,
    link: defaultSchema.spec.marks.get('link')!,
    strike: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
      toDOM() {
        return ['s', 0];
      },
    },
  },
});

export type MarkdownSchema = typeof markdownSchema;
