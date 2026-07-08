import { useState } from "react";
import type { PyFile } from "../hooks/useFiles";

interface FileManagerProps {
  files: PyFile[];
  activeName: string;
  onClose: () => void;
  onSelect: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}

export default function FileManager({
  files,
  activeName,
  onClose,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: FileManagerProps) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
    setCreating(false);
  }

  function handleRenameSubmit() {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    onRename(renaming, renameValue.trim());
    setRenaming(null);
    setRenameValue("");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">文件</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 text-2xl leading-none px-2 active:text-zinc-100"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 文件列表 */}
        <div className="flex-1 overflow-auto px-2 py-2">
          {files.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">
              还没有保存的文件
            </p>
          )}
          {files.map((file) => (
            <div
              key={file.name}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 ${
                file.name === activeName
                  ? "bg-blue-600/20 border border-blue-600/40"
                  : "active:bg-zinc-800"
              }`}
            >
              {renaming === file.name ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="flex-1 bg-zinc-800 text-zinc-100 text-sm px-2 py-1 rounded border border-zinc-600 focus:outline-none focus:border-blue-500"
                />
              ) : (
                <>
                  <button
                    onClick={() => onSelect(file.name)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm text-zinc-100 font-medium">
                      {file.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatTime(file.updatedAt)}
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setRenaming(file.name);
                      setRenameValue(file.name.replace(/\.py$/, ""));
                    }}
                    className="text-zinc-400 text-xs px-2 py-1 active:text-zinc-100"
                    aria-label="重命名"
                  >
                    重命名
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`删除 ${file.name}?`)) onDelete(file.name);
                    }}
                    className="text-rose-400 text-xs px-2 py-1 active:text-rose-300"
                    aria-label="删除"
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* 底部新建区 */}
        <div className="px-4 py-3 border-t border-zinc-800">
          {creating ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                placeholder="文件名(不用加.py)"
                className="flex-1 bg-zinc-800 text-zinc-100 text-sm px-3 py-2 rounded-lg border border-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg active:scale-[0.98]"
              >
                创建
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                className="px-3 py-2 text-zinc-400 text-sm active:text-zinc-100"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full px-4 py-2.5 bg-zinc-800 text-zinc-100 text-sm rounded-lg active:scale-[0.98] border border-zinc-700"
            >
              + 新建文件
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
