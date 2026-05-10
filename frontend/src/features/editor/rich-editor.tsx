import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import {
  baseKeymap,
  chainCommands,
  exitCode,
  liftEmptyBlock,
  toggleMark,
} from 'prosemirror-commands';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { keymap } from 'prosemirror-keymap';
import { history, redo, undo } from 'prosemirror-history';
import { inputRules } from 'prosemirror-inputrules';
import {
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  CodeIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  LeftToRightBlockQuoteIcon,
  CodeSquareIcon,
  UndoIcon,
  RedoIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { markdownSchema } from './markdown-schema';
import { parseMarkdown, serializeMarkdown } from './markdown-serializer';
import { cn } from '@/lib/utils';

export type RichEditorProps = {
  initialContent: string;
  onChange?: (markdown: string) => void;
  className?: string;
  autofocus?: boolean;
};

function createEditorKeymap(schema: Schema) {
  // Build commands for marks
  const keymaps: Record<
    string,
    (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean
  > = {
    'Mod-z': undo,
    'Mod-Shift-z': redo,
    'Mod-y': redo,
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-`': toggleCode(schema),
    'Shift-Enter': chainCommands(
      exitCode,
      (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        if (dispatch) dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()));
        return true;
      },
    ),
    Enter: splitListItem(schema.nodes.list_item),
    'Mod-[': liftListItem(schema.nodes.list_item),
    'Mod-]': sinkListItem(schema.nodes.list_item),
    'Mod-Shift-8': wrapInList(schema.nodes.bullet_list),
    'Mod-Shift-7': wrapInList(schema.nodes.ordered_list),
    Backspace: chainCommands(liftEmptyBlock, (state, dispatch) => {
      // Handle backspace at start of heading to convert to paragraph
      const { selection } = state;
      if (selection.empty && selection.$from.parent.type === schema.nodes.heading) {
        if (selection.$from.parentOffset === 0) {
          if (dispatch) {
            const tr = state.tr;
            tr.setBlockType(
              selection.$from.blockRange()!.start,
              selection.$from.blockRange()!.end,
              schema.nodes.paragraph,
            );
            dispatch(tr);
          }
          return true;
        }
      }
      return false;
    }),
  };

  // Tab handling
  keymaps.Tab = (state, dispatch) => {
    if (sinkListItem(schema.nodes.list_item)(state, dispatch)) return true;
    return false;
  };
  keymaps['Shift-Tab'] = liftListItem(schema.nodes.list_item);

  return keymap(keymaps);
}

function toggleCode(schema: Schema) {
  return toggleMark(schema.marks.code);
}

export function RichEditor({
  initialContent,
  onChange,
  className,
  autofocus = false,
}: RichEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: parseMarkdown(initialContent || ''),
      schema: markdownSchema,
      plugins: [
        history(),
        createEditorKeymap(markdownSchema),
        keymap(baseKeymap),
        inputRules({ rules: buildInputRules(markdownSchema) }),
      ],
    });

    const view = new EditorView(containerRef.current, {
      state,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setEditorState(newState);
        if (transaction.docChanged && onChangeRef.current) {
          const markdown = serializeMarkdown(newState.doc);
          onChangeRef.current(markdown);
        }
      },
    });

    viewRef.current = view;
    setEditorState(state);

    if (autofocus) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Only run once on mount

  const execCommand = useCallback(
    (command: (state: EditorState, dispatch: EditorView['dispatch']) => boolean) => {
      const view = viewRef.current;
      if (!view) return;
      command(view.state, view.dispatch);
      view.focus();
    },
    [],
  );

  const isMarkActive = useCallback(
    (markName: string) => {
      if (!editorState) return false;
      const { from, to } = editorState.selection;
      let active = false;
      editorState.doc.nodesBetween(from, to, (node) => {
        if (node.marks.some((mark) => mark.type.name === markName)) {
          active = true;
          return false;
        }
      });
      return active;
    },
    [editorState],
  );

  const isBlockActive = useCallback(
    (nodeName: string, attrs: Record<string, unknown> = {}) => {
      if (!editorState) return false;
      const { $from } = editorState.selection;

      // Check from current depth up to doc root
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === nodeName) {
          const matchAttrs = Object.entries(attrs).every(
            ([key, value]) => node.attrs[key] === value,
          );
          if (matchAttrs) return true;
        }
      }
      return false;
    },
    [editorState],
  );

  const toggleHeading = useCallback((level: number) => {
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const { $from } = state.selection;
    const nodeType = markdownSchema.nodes.heading;
    const paragraph = markdownSchema.nodes.paragraph;

    const isHeading = $from.parent.type === nodeType && $from.parent.attrs.level === level;
    const type = isHeading ? paragraph : nodeType;
    const attrs = isHeading ? {} : { level };

    const tr = state.tr.setBlockType(
      $from.before($from.depth),
      $from.after($from.depth),
      type,
      attrs,
    );
    if (!tr.steps.length) return;
    view.dispatch(tr);
    view.focus();
  }, []);

  const toggleBlockquote = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const { $from, $to } = state.selection;
    const blockquote = markdownSchema.nodes.blockquote;

    const range = $from.blockRange($to);
    if (!range) return;

    let bqDepth = -1;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === blockquote) {
        bqDepth = d;
        break;
      }
    }

    if (bqDepth > -1) {
      // Lift out of blockquote
      const tr = state.tr.lift(range, bqDepth - 1);
      if (tr.steps.length) view.dispatch(tr);
    } else {
      // Wrap in blockquote
      const tr = state.tr.wrap(range, [{ type: blockquote }]);
      if (tr && tr.steps.length) view.dispatch(tr);
    }
    view.focus();
  }, []);

  const toggleCodeBlock = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const { $from } = state.selection;

    const isCodeBlock = $from.parent.type === markdownSchema.nodes.code_block;
    const tr = state.tr.setBlockType(
      $from.before($from.depth),
      $from.after($from.depth),
      isCodeBlock ? markdownSchema.nodes.paragraph : markdownSchema.nodes.code_block,
    );
    if (tr.steps.length) view.dispatch(tr);
    view.focus();
  }, []);

  const toggleList = useCallback(
    (listType: 'bullet_list' | 'ordered_list') => {
      const view = viewRef.current;
      if (!view) return;
      const { state } = view;
      const { $from } = state.selection;
      const targetType = markdownSchema.nodes[listType];

      // Check if inside ANY list
      let currentListDepth = -1;
      let currentListType = null;
      for (let d = $from.depth; d > 0; d--) {
        const type = $from.node(d).type;
        if (
          type === markdownSchema.nodes.bullet_list ||
          type === markdownSchema.nodes.ordered_list
        ) {
          currentListDepth = d;
          currentListType = type;
          break;
        }
      }

      if (currentListDepth > -1) {
        if (currentListType === targetType) {
          // Same list type => unwrap (lift)
          execCommand(liftListItem(markdownSchema.nodes.list_item));
        } else {
          // Different list type => change the type of the list node itself!
          const listPos = $from.before(currentListDepth);
          const tr = state.tr.setNodeMarkup(listPos, targetType);
          view.dispatch(tr);
          view.focus();
        }
      } else {
        // Not in list => wrap
        execCommand(wrapInList(targetType));
      }
    },
    [execCommand],
  );

  const toggleBulletList = useCallback(() => toggleList('bullet_list'), [toggleList]);

  const toggleOrderedList = useCallback(() => toggleList('ordered_list'), [toggleList]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <EditorToolbar
        isBold={isMarkActive('strong')}
        isItalic={isMarkActive('em')}
        isCode={isMarkActive('code')}
        isStrikethrough={isMarkActive('strike')}
        isHeading1={isBlockActive('heading', { level: 1 })}
        isHeading2={isBlockActive('heading', { level: 2 })}
        isHeading3={isBlockActive('heading', { level: 3 })}
        isBlockquote={isBlockActive('blockquote')}
        isCodeBlock={isBlockActive('code_block')}
        isBulletList={isBlockActive('bullet_list')}
        isOrderedList={isBlockActive('ordered_list')}
        onBold={() => execCommand(toggleMark(markdownSchema.marks.strong))}
        onItalic={() => execCommand(toggleMark(markdownSchema.marks.em))}
        onCode={() => execCommand(toggleCode(markdownSchema))}
        onStrikethrough={() => execCommand(toggleMark(markdownSchema.marks.strike))}
        onHeading1={() => toggleHeading(1)}
        onHeading2={() => toggleHeading(2)}
        onHeading3={() => toggleHeading(3)}
        onBlockquote={toggleBlockquote}
        onCodeBlock={toggleCodeBlock}
        onBulletList={toggleBulletList}
        onOrderedList={toggleOrderedList}
        onUndo={() => execCommand(undo)}
        onRedo={() => execCommand(redo)}
      />
      <div
        ref={containerRef}
        className="flex flex-col flex-1 overflow-y-auto px-6 py-6 cursor-text [&>.ProseMirror]:flex-1"
        onClick={(e) => {
          if (e.target === e.currentTarget && viewRef.current) {
            viewRef.current.focus();
          }
        }}
      />
    </div>
  );
}

import { wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';

function buildInputRules(schema: Schema) {
  return [
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*(\*\s?|-\s?)$/, schema.nodes.bullet_list),
    wrappingInputRule(/^\s*(\d+)\.\s$/, schema.nodes.ordered_list, (match: RegExpMatchArray) => ({
      order: +match[1],
    })),
    textblockTypeInputRule(/^#{1,6}\s$/, schema.nodes.heading, (match: RegExpMatchArray) => ({
      level: match[0].length - 1,
    })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block),
  ];
}

// Toolbar component

type EditorToolbarProps = {
  isBold: boolean;
  isItalic: boolean;
  isCode: boolean;
  isStrikethrough: boolean;
  isHeading1: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isBlockquote: boolean;
  isCodeBlock: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  onBold: () => void;
  onItalic: () => void;
  onCode: () => void;
  onStrikethrough: () => void;
  onHeading1: () => void;
  onHeading2: () => void;
  onHeading3: () => void;
  onBlockquote: () => void;
  onCodeBlock: () => void;
  onBulletList: () => void;
  onOrderedList: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function EditorToolbar({
  isBold,
  isItalic,
  isCode,
  isStrikethrough,
  isHeading1,
  isHeading2,
  isHeading3,
  isBlockquote,
  isCodeBlock,
  isBulletList,
  isOrderedList,
  onBold,
  onItalic,
  onCode,
  onStrikethrough,
  onHeading1,
  onHeading2,
  onHeading3,
  onBlockquote,
  onCodeBlock,
  onBulletList,
  onOrderedList,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-card/50 px-4 py-2 flex-wrap">
      <div className="flex items-center gap-0.5">
        <ToolbarButton title="Undo (Ctrl+Z)" onClick={onUndo}>
          <HugeiconsIcon icon={UndoIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Redo (Ctrl+Shift+Z)" onClick={onRedo}>
          <HugeiconsIcon icon={RedoIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton title="Heading 1 (Ctrl+Alt+1)" active={isHeading1} onClick={onHeading1}>
          H1
        </ToolbarButton>
        <ToolbarButton title="Heading 2 (Ctrl+Alt+2)" active={isHeading2} onClick={onHeading2}>
          H2
        </ToolbarButton>
        <ToolbarButton title="Heading 3 (Ctrl+Alt+3)" active={isHeading3} onClick={onHeading3}>
          H3
        </ToolbarButton>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton title="Bold (Ctrl+B)" active={isBold} onClick={onBold}>
          <HugeiconsIcon icon={TextBoldIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic (Ctrl+I)" active={isItalic} onClick={onItalic}>
          <HugeiconsIcon icon={TextItalicIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={isStrikethrough} onClick={onStrikethrough}>
          <HugeiconsIcon icon={TextStrikethroughIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Inline Code (Ctrl+`)" active={isCode} onClick={onCode}>
          <HugeiconsIcon icon={CodeIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton
          title="Bullet List (Ctrl+Shift+8)"
          active={isBulletList}
          onClick={onBulletList}
        >
          <HugeiconsIcon icon={LeftToRightListBulletIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Ordered List (Ctrl+Shift+7)"
          active={isOrderedList}
          onClick={onOrderedList}
        >
          <HugeiconsIcon icon={LeftToRightListNumberIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton title="Blockquote" active={isBlockquote} onClick={onBlockquote}>
          <HugeiconsIcon icon={LeftToRightBlockQuoteIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Code Block" active={isCodeBlock} onClick={onCodeBlock}>
          <HugeiconsIcon icon={CodeSquareIcon} className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
