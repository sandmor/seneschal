import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { EditorState, Transaction, Plugin } from 'prosemirror-state';
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
import { history, redo as prosemirrorRedo, undo as prosemirrorUndo } from 'prosemirror-history';
import { inputRules, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import {
  ySyncPlugin,
  yUndoPlugin,
  yUndoPluginKey,
  prosemirrorToYXmlFragment,
  undoCommand as yUndoCommand,
  redoCommand as yRedoCommand,
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from 'y-prosemirror';
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
  ydoc?: Y.Doc;
  provider?: WebsocketProvider;
};

type PresenceUser = {
  color: string;
  name: string;
  tabId?: string;
};

type PresenceOverlayItem = {
  clientId: number;
  user: PresenceUser;
  caret: {
    left: number;
    top: number;
    height: number;
  };
  selections: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
};

type PresenceCandidate = {
  anchor: number;
  clientId: number;
  head: number;
  lastUpdated: number;
  user: PresenceUser;
};

function createEditorKeymap(schema: Schema) {
  // Build commands for marks
  const keymaps: Record<
    string,
    (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean
  > = {
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

function getUndoRedoCommands(state: EditorState | null) {
  if (state && yUndoPluginKey.getState(state)) {
    return { undo: yUndoCommand, redo: yRedoCommand };
  }
  return { undo: prosemirrorUndo, redo: prosemirrorRedo };
}

export function RichEditor({
  initialContent,
  onChange,
  className,
  autofocus = false,
  ydoc,
  provider,
}: RichEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorSurfaceRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [presenceItems, setPresenceItems] = useState<PresenceOverlayItem[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const plugins: Plugin[] = [
      createEditorKeymap(markdownSchema),
      keymap(baseKeymap),
      inputRules({ rules: buildInputRules(markdownSchema) }),
    ];

    let state: EditorState;
    let removeProviderSyncListener: (() => void) | undefined;

    if (ydoc) {
      const yXmlFragment = ydoc.get('prosemirror', Y.XmlFragment);
      plugins.unshift(ySyncPlugin(yXmlFragment));
      if (provider) {
        plugins.push(createPresenceAwarenessPlugin(provider));
      }
      plugins.push(yUndoPlugin());
      plugins.push(
        keymap({ 'Mod-z': yUndoCommand, 'Mod-Shift-z': yRedoCommand, 'Mod-y': yRedoCommand }),
      );

      state = EditorState.create({
        schema: markdownSchema,
        plugins,
      });

      const handleSync = (isSynced: boolean) => {
        if (!isSynced) return;
        if (yXmlFragment.length === 0 && initialContent) {
          const pmDoc = parseMarkdown(initialContent);
          if (pmDoc) {
            prosemirrorToYXmlFragment(pmDoc, yXmlFragment);
          }
        }
      };

      if (provider) {
        provider.on('sync', handleSync);
        removeProviderSyncListener = () => provider.off('sync', handleSync);
        if ((provider as unknown as { synced: boolean }).synced) {
          handleSync(true);
        }
      } else {
        if (yXmlFragment.length === 0 && initialContent) {
          const pmDoc = parseMarkdown(initialContent);
          if (pmDoc) {
            prosemirrorToYXmlFragment(pmDoc, yXmlFragment);
          }
        }
      }
    } else {
      plugins.unshift(
        history(),
        keymap({
          'Mod-z': prosemirrorUndo,
          'Mod-Shift-z': prosemirrorRedo,
          'Mod-y': prosemirrorRedo,
        }),
      );

      state = EditorState.create({
        doc: parseMarkdown(initialContent || ''),
        schema: markdownSchema,
        plugins,
      });
    }

    let schedulePresenceUpdate = () => {};
    let presenceBinding: { destroy: () => void; schedule: () => void } | undefined;

    const view = new EditorView(containerRef.current, {
      state,
      dispatchTransaction(this: EditorView, transaction) {
        const newState = this.state.apply(transaction);
        this.updateState(newState);
        setEditorState(newState);
        schedulePresenceUpdate();
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

    if (provider) {
      presenceBinding = bindPresenceOverlay({
        view,
        provider,
        surface: editorSurfaceRef.current,
        onPresenceChange: setPresenceItems,
      });
      schedulePresenceUpdate = presenceBinding.schedule;
      schedulePresenceUpdate();
    } else {
      setPresenceItems([]);
    }

    return () => {
      presenceBinding?.destroy();
      removeProviderSyncListener?.();
      view.destroy();
      viewRef.current = null;
      setPresenceItems([]);
    };
  }, [autofocus, provider, ydoc]);

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

  const { undo: undoCmd, redo: redoCmd } = getUndoRedoCommands(editorState);

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
        onUndo={() => execCommand(undoCmd)}
        onRedo={() => execCommand(redoCmd)}
      />
      <div
        ref={editorSurfaceRef}
        className="relative flex flex-col flex-1 overflow-y-auto px-6 py-6 cursor-text [&_.ProseMirror]:flex-1"
        onClick={(e) => {
          if (e.target === e.currentTarget && viewRef.current) {
            viewRef.current.focus();
          }
        }}
      >
        <div ref={containerRef} className="contents" />
        <PresenceOverlay items={presenceItems} />
      </div>
    </div>
  );
}

function createPresenceAwarenessPlugin(provider: WebsocketProvider) {
  return new Plugin({
    view(view) {
      const updateCursorInfo = () => {
        const ystate = ySyncPluginKey.getState(view.state);
        if (!ystate) return;

        const current = provider.awareness.getLocalState() ?? {};
        if (view.hasFocus()) {
          const { selection } = view.state;
          const anchor = absolutePositionToRelativePosition(
            selection.anchor,
            ystate.type,
            ystate.binding.mapping,
          );
          const head = absolutePositionToRelativePosition(
            selection.head,
            ystate.type,
            ystate.binding.mapping,
          );

          if (
            current.cursor == null ||
            !Y.compareRelativePositions(
              Y.createRelativePositionFromJSON(current.cursor.anchor),
              anchor,
            ) ||
            !Y.compareRelativePositions(Y.createRelativePositionFromJSON(current.cursor.head), head)
          ) {
            provider.awareness.setLocalStateField('cursor', { anchor, head });
          }
          return;
        }

        if (current.cursor != null) {
          provider.awareness.setLocalStateField('cursor', null);
        }
      };

      view.dom.addEventListener('focusin', updateCursorInfo);
      view.dom.addEventListener('focusout', updateCursorInfo);
      updateCursorInfo();

      return {
        update: updateCursorInfo,
        destroy: () => {
          view.dom.removeEventListener('focusin', updateCursorInfo);
          view.dom.removeEventListener('focusout', updateCursorInfo);
          provider.awareness.setLocalStateField('cursor', null);
        },
      };
    },
  });
}

function bindPresenceOverlay({
  view,
  provider,
  surface,
  onPresenceChange,
}: {
  view: EditorView;
  provider: WebsocketProvider;
  surface: HTMLDivElement | null;
  onPresenceChange: (items: PresenceOverlayItem[]) => void;
}) {
  let frame = 0;

  const renderPresence = () => {
    if (!surface) {
      onPresenceChange([]);
      return;
    }

    const ystate = ySyncPluginKey.getState(view.state);
    if (!ystate) {
      onPresenceChange([]);
      return;
    }

    const localUser = getAwarenessUser(provider.awareness.getLocalState());
    const candidates = new Map<string, PresenceCandidate>();

    for (const [clientId, state] of provider.awareness.getStates()) {
      if (clientId === provider.doc.clientID) continue;

      const user = getAwarenessUser(state);
      const cursor = getAwarenessCursor(state);
      if (!user || !cursor) continue;
      if (user.tabId && localUser?.tabId === user.tabId) continue;

      const anchor = relativePositionToAbsolutePosition(
        ystate.doc,
        ystate.type,
        Y.createRelativePositionFromJSON(cursor.anchor),
        ystate.binding.mapping,
      );
      const head = relativePositionToAbsolutePosition(
        ystate.doc,
        ystate.type,
        Y.createRelativePositionFromJSON(cursor.head),
        ystate.binding.mapping,
      );
      if (anchor === null || head === null) continue;

      const key = user.tabId ?? String(clientId);
      const lastUpdated = provider.awareness.meta.get(clientId)?.lastUpdated ?? 0;
      const previous = candidates.get(key);
      if (!previous || previous.lastUpdated <= lastUpdated) {
        candidates.set(key, { anchor, clientId, head, lastUpdated, user });
      }
    }

    const nextItems = Array.from(candidates.values()).map((candidate) =>
      createPresenceOverlayItem({ ...candidate, surface, view }),
    );
    onPresenceChange(nextItems);
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      renderPresence();
    });
  };

  provider.awareness.on('change', schedule);
  provider.awareness.on('update', schedule);
  surface?.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  return {
    schedule,
    destroy: () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      provider.awareness.off('change', schedule);
      provider.awareness.off('update', schedule);
      surface?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      onPresenceChange([]);
    },
  };
}

function createPresenceOverlayItem({
  clientId,
  user,
  anchor,
  head,
  surface,
  view,
}: {
  clientId: number;
  user: PresenceUser;
  anchor: number;
  head: number;
  surface: HTMLDivElement;
  view: EditorView;
}): PresenceOverlayItem {
  const caretRect = view.coordsAtPos(head);
  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head);

  return {
    clientId,
    user,
    caret: {
      left: Math.round(viewportXToSurfaceX(caretRect.left, surface)),
      top: Math.round(viewportYToSurfaceY(caretRect.top, surface)),
      height: Math.max(Math.round(caretRect.bottom - caretRect.top), 16),
    },
    selections: from === to ? [] : getSelectionRects(view, from, to, surface),
  };
}

function getSelectionRects(view: EditorView, from: number, to: number, surface: HTMLDivElement) {
  try {
    const start = view.domAtPos(from);
    const end = view.domAtPos(to);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        left: Math.round(viewportXToSurfaceX(rect.left, surface)),
        top: Math.round(viewportYToSurfaceY(rect.top, surface)),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }));
  } catch {
    return [];
  }
}

function viewportXToSurfaceX(x: number, surface: HTMLDivElement) {
  return x - surface.getBoundingClientRect().left + surface.scrollLeft;
}

function viewportYToSurfaceY(y: number, surface: HTMLDivElement) {
  return y - surface.getBoundingClientRect().top + surface.scrollTop;
}

function getAwarenessUser(state: unknown): PresenceUser | null {
  const user = (state as { user?: Partial<PresenceUser> } | null)?.user;
  if (!user?.name || !user?.color) return null;
  return {
    color: user.color,
    name: user.name,
    tabId: user.tabId,
  };
}

function getAwarenessCursor(state: unknown) {
  return (state as { cursor?: { anchor: unknown; head: unknown } } | null)?.cursor ?? null;
}

function PresenceOverlay({ items }: { items: PresenceOverlayItem[] }) {
  return (
    <div className="seneschal-collab-overlay" aria-hidden="true">
      {items.map((item) => {
        const style = { '--collab-color': item.user.color } as CSSProperties;
        return (
          <div key={item.clientId} className="seneschal-collab-presence" style={style}>
            {item.selections.map((selection, index) => (
              <span
                key={`${item.clientId}-selection-${index}`}
                className="seneschal-collab-selection"
                style={{
                  height: selection.height,
                  transform: `translate(${selection.left}px, ${selection.top}px)`,
                  width: selection.width,
                }}
              />
            ))}
            <span
              className="seneschal-collab-cursor"
              style={{
                height: item.caret.height,
                transform: `translate(${item.caret.left}px, ${item.caret.top}px)`,
              }}
            >
              <span className="seneschal-collab-caret" />
              <span className="seneschal-collab-label">
                <span className="seneschal-collab-label-chip" />
                <span className="seneschal-collab-label-name">{item.user.name}</span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
