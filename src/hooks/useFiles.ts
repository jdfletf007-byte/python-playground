import { useCallback, useEffect, useState } from "react";

// localStorage 存储 key
const STORAGE_KEY = "pp_files";
// 当前活动文件 key
const ACTIVE_KEY = "pp_active_file";

export interface PyFile {
  name: string;
  content: string;
  updatedAt: number;
}

// 从 localStorage 读取所有文件
function loadFiles(): Record<string, PyFile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PyFile>;
  } catch {
    return {};
  }
}

// 把所有文件写回 localStorage
function saveFiles(files: Record<string, PyFile>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch (err) {
    console.error("保存文件失败:", err);
  }
}

// 生成唯一文件名(如果重名自动加数字后缀)
function uniqueName(base: string, existing: Record<string, PyFile>): string {
  const cleanBase = base.endsWith(".py") ? base : `${base}.py`;
  if (!existing[cleanBase]) return cleanBase;
  // 去掉 .py 后加数字
  const stem = cleanBase.replace(/\.py$/, "");
  let i = 2;
  while (existing[`${stem}${i}.py`]) i++;
  return `${stem}${i}.py`;
}

export function useFiles() {
  const [files, setFiles] = useState<Record<string, PyFile>>({});
  const [activeName, setActiveName] = useState<string>("");

  // 初始化:从 localStorage 加载
  useEffect(() => {
    const loaded = loadFiles();
    setFiles(loaded);
    const savedActive = localStorage.getItem(ACTIVE_KEY);
    if (savedActive && loaded[savedActive]) {
      setActiveName(savedActive);
    }
  }, []);

  // 文件列表变化时写回 localStorage
  const persistFiles = useCallback((newFiles: Record<string, PyFile>) => {
    setFiles(newFiles);
    saveFiles(newFiles);
  }, []);

  // 切换活动文件时记住
  useEffect(() => {
    if (activeName) {
      localStorage.setItem(ACTIVE_KEY, activeName);
    }
  }, [activeName]);

  // 新建文件,返回新文件名
  const createFile = useCallback(
    (name: string, content = ""): string => {
      const finalName = uniqueName(name, files);
      const newFile: PyFile = {
        name: finalName,
        content,
        updatedAt: Date.now(),
      };
      persistFiles({ ...files, [finalName]: newFile });
      setActiveName(finalName);
      return finalName;
    },
    [files, persistFiles],
  );

  // 保存(更新当前文件内容)
  const saveFile = useCallback(
    (name: string, content: string) => {
      if (!files[name]) return;
      const updated: PyFile = { ...files[name], content, updatedAt: Date.now() };
      persistFiles({ ...files, [name]: updated });
    },
    [files, persistFiles],
  );

  // 重命名
  const renameFile = useCallback(
    (oldName: string, newName: string): string => {
      if (!files[oldName]) return oldName;
      const finalName = uniqueName(newName, { ...files, [oldName]: undefined as unknown as PyFile });
      const newFiles = { ...files };
      const file = newFiles[oldName];
      delete newFiles[oldName];
      newFiles[finalName] = { ...file, name: finalName, updatedAt: Date.now() };
      persistFiles(newFiles);
      if (activeName === oldName) {
        setActiveName(finalName);
      }
      return finalName;
    },
    [files, activeName, persistFiles],
  );

  // 删除
  const deleteFile = useCallback(
    (name: string) => {
      if (!files[name]) return;
      const newFiles = { ...files };
      delete newFiles[name];
      persistFiles(newFiles);
      if (activeName === name) {
        setActiveName("");
      }
    },
    [files, activeName, persistFiles],
  );

  // 获取当前文件内容
  const getActiveContent = useCallback((): string => {
    if (!activeName || !files[activeName]) return "";
    return files[activeName].content;
  }, [activeName, files]);

  // 按名字取文件内容
  const getFileContent = useCallback(
    (name: string): string => {
      return files[name]?.content ?? "";
    },
    [files],
  );

  // 文件列表(按更新时间倒序)
  const fileList = Object.values(files).sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    files: fileList,
    activeName,
    setActiveName,
    createFile,
    saveFile,
    renameFile,
    deleteFile,
    getActiveContent,
    getFileContent,
  };
}
