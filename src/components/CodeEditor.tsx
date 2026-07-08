import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { python } from "@codemirror/lang-python";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { indentOnInput, bracketMatching } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CodeEditor({ value, onChange }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // 保持 onChange 引用最新,避免每次重建编辑器
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        python(),
        oneDark,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        updateListener,
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
            backgroundColor: "#1e1e26",
          },
          ".cm-scroller": {
            fontFamily: "var(--font-mono)",
            lineHeight: "1.6",
            backgroundColor: "#1e1e26",
          },
          ".cm-content": {
            padding: "12px",
          },
          // 光标:亮青色 + 加粗,在深色背景上醒目
          ".cm-cursor": {
            borderLeftColor: "#22d3ee",
            borderLeftWidth: "2px",
          },
          ".cm-cursor.cm-cursor-primary": {
            borderLeftColor: "#22d3ee",
          },
          // 当前行高亮的背景稍微亮一点
          "&.cm-focused .cm-activeLine": {
            backgroundColor: "#282833",
          },
          ".cm-activeLine": {
            backgroundColor: "#282833",
          },
          ".cm-gutters": {
            borderRight: "1px solid #3f3f46",
            backgroundColor: "#18181b",
          },
          ".cm-lineNumbers .cm-gutterElement": {
            color: "#71717a",
            padding: "0 8px 0 4px",
          },
          // 选中文本的颜色
          ".cm-selectionBackground, ::selection": {
            backgroundColor: "#264f78",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 只在挂载时创建一次,value 变化由下面的 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部 value 变化时同步到编辑器(避免光标跳动,只在内容不同步时更新)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="flex-1 w-full min-h-[240px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-900"
    />
  );
}
