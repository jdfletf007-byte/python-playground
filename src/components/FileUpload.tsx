import { useRef, useState } from "react";

interface FileUploadProps {
  onUpload: (fileName: string, data: Uint8Array) => Promise<void>;
}

export default function FileUpload({ onUpload }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await onUpload(file.name, buf);
      setUploadedName(file.name);
      setTimeout(() => setUploadedName(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      // 清空 input,允许重复上传同一文件
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,.json,.tsv"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-zinc-400 dark:text-zinc-600 active:text-zinc-900 dark:active:text-zinc-100 px-2 py-1 disabled:opacity-40"
        title="上传数据文件(CSV/TXT)给 pandas 使用"
      >
        {uploading ? "上传中…" : "上传数据"}
      </button>
      {uploadedName && (
        <span className="text-xs text-green-600 dark:text-green-400 ml-2">
          ✓ {uploadedName} 已加载
        </span>
      )}
      {error && (
        <span className="text-xs text-rose-600 dark:text-rose-400 ml-2">
          {error}
        </span>
      )}
    </div>
  );
}
