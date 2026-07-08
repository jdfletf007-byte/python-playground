import { useEffect, useRef, useState } from "react";
import CodeEditor from "./components/CodeEditor";

// Pyodide 类型(最简声明,完整类型从 CDN 加载)
declare global {
  interface Window {
    loadPyodide?: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
    __pp_capture_image?: (base64: string) => void;
  }
}

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (
    code: string,
    options?: { messageCallback?: (msg: string) => void },
  ) => Promise<void>;
  setStdout: (options: { batched: (msg: string) => void }) => void;
  setStderr: (options: { batched: (msg: string) => void }) => void;
}

// Pyodide 版本(锁 0.27.3+,避开 0.27.1/0.27.2 的 iOS Safari 崩溃 bug)
const PYODIDE_VERSION = "0.27.7";
// 本地自托管:核心运行时 + lock.json + 常用包 wheel 都在 public/pyodide/,离线可用
const PYODIDE_BASE = `${import.meta.env.BASE_URL}pyodide/`;

type LoadState = "idle" | "loading" | "ready" | "error";

export default function App() {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState("");
  const [outputType, setOutputType] = useState<"stdout" | "stderr" | "">("");
  const [images, setImages] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const stdoutBuffer = useRef<string[]>([]);
  const stderrBuffer = useRef<string[]>([]);
  const imageBuffer = useRef<string[]>([]);

  // 加载 Pyodide
  useEffect(() => {
    window.__pp_capture_image = (base64: string) => {
      imageBuffer.current.push(base64);
    };

    if (window.loadPyodide) {
      void initPyodide();
      return;
    }

    const script = document.createElement("script");
    script.src = `${PYODIDE_BASE}pyodide.js`;
    script.onload = () => void initPyodide();
    script.onerror = () => {
      setLoadError(`无法加载 ${PYODIDE_BASE}pyodide.js(本地文件缺失或 dev 服务器未提供)`);
      setLoadState("error");
    };
    document.head.appendChild(script);

    async function initPyodide() {
      try {
        setLoadState("loading");
        const py = await window.loadPyodide!({ indexURL: PYODIDE_BASE });

        py.setStdout({
          batched: (msg: string) => stdoutBuffer.current.push(msg + "\n"),
        });
        py.setStderr({
          batched: (msg: string) => stderrBuffer.current.push(msg + "\n"),
        });

        // 注入 matplotlib 辅助函数:用 Agg backend 渲染成 PNG,通过 JS bridge 传出
        await py.runPythonAsync(MATPLOTLIB_HELPER);

        setPyodide(py);
        setLoadState("ready");
      } catch (err) {
        const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error("Pyodide 初始化失败:", err);
        setLoadError(errMsg);
        setLoadState("error");
      }
    }
  }, []);

  async function runCode() {
    if (!pyodide || isRunning) return;
    setIsRunning(true);
    stdoutBuffer.current = [];
    stderrBuffer.current = [];
    imageBuffer.current = [];
    setOutput("");
    setOutputType("");
    setImages([]);

    try {
      // 先清理上次运行残留的 matplotlib figure(Pyodide 单全局命名空间,状态会残留)
      await pyodide.runPythonAsync("_pp_close_all()");

      // 扫描代码里的 import,显式从 CDN 加载需要的包
      // 不用 loadPackagesFromImports,因为它依赖 indexURL 下的完整包列表(本地没托管全部包)
      const packages = detectRequiredPackages(code);
      if (packages.length > 0) {
        setOutput(`正在加载依赖包:${packages.join(", ")}(首次约 10-30 秒)…`);
        setOutputType("");
        await loadRequiredPackages(pyodide, code);
        // 注意:不清空 output,保留 registerChineseFont 的诊断 print
      }

      // 把 plt.show() 改成空操作,防止用户代码里的 show() 和末尾 _pp_show_all 重复画图
      await pyodide.runPythonAsync("_pp_install_noop_show()");

      // 用户代码末尾自动调用 _pp_show_all(),捕获漏画的 matplotlib figure
      const wrapped = `${code}\ntry:\n    _pp_show_all()\nexcept Exception:\n    pass`;
      await pyodide.runPythonAsync(wrapped);

      const stdoutText = stdoutBuffer.current.join("");
      const stderrText = stderrBuffer.current.join("");

      if (stderrText) {
        setOutput(stderrText);
        setOutputType("stderr");
      } else if (stdoutText) {
        setOutput(stdoutText);
        setOutputType("stdout");
      } else if (imageBuffer.current.length === 0) {
        setOutput("(无输出)");
        setOutputType("");
      }
      if (imageBuffer.current.length > 0) {
        setImages([...imageBuffer.current]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setOutput(errMsg);
      setOutputType("stderr");
    } finally {
      setIsRunning(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center px-6">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin dark:border-zinc-700 dark:border-t-zinc-100" />
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">正在加载 Python 运行时…</p>
          <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-2">
            首次加载约 10-15 秒,之后会缓存
          </p>
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center px-6 max-w-lg">
          <p className="text-rose-600 dark:text-rose-400 font-medium mb-2">
            Python 运行时加载失败
          </p>
          <p className="text-zinc-500 dark:text-zinc-500 text-sm mb-3">
            请刷新重试。如果反复失败,把下面的错误信息发给我。
          </p>
          {loadError && (
            <pre className="text-left text-xs font-mono text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-3 mb-4 whitespace-pre-wrap break-all max-h-48 overflow-auto">
              {loadError}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Python 练习场
        </h1>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">PoC</span>
      </header>

      <main className="flex-1 flex flex-col gap-3 p-3 min-h-0">
        <CodeEditor value={code} onChange={setCode} />

        <button
          onClick={runCode}
          disabled={!pyodide || isRunning}
          className="px-4 py-3 bg-zinc-900 text-white rounded-lg font-medium text-sm active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isRunning ? "运行中…" : "运行"}
        </button>

        {(output || images.length > 0) && (
          <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 min-h-[120px]">
            {images.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={`data:image/png;base64,${src}`}
                    alt={`输出图 ${i + 1}`}
                    className="max-w-full h-auto rounded"
                  />
                ))}
              </div>
            )}
            {output && (
              <pre
                className={`font-mono text-sm whitespace-pre-wrap break-words ${
                  outputType === "stderr"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {output}
              </pre>
            )}
          </div>
        )}
      </main>

      <footer className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center">
          Pyodide {PYODIDE_VERSION} · 代码在浏览器本地运行
        </p>
      </footer>
    </div>
  );
}

// Pyodide 官方预编译、可从 CDN 加载的常用包
// 命中即加载,没命中就走 Python 标准库(已随核心运行时打包)
const PYODIDE_PACKAGES = [
  "numpy",
  "pandas",
  "matplotlib",
  "scikit-learn",
  "scipy",
  "sympy",
  "micropip",
];

// 扫描代码里的 import 语句,返回需要加载的包名(纯检测,不触发加载)
function detectRequiredPackages(code: string): string[] {
  const imported = new Set<string>();
  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    const m1 = trimmed.match(/^import\s+([a-zA-Z_][\w]*)/);
    const m2 = trimmed.match(/^from\s+([a-zA-Z_][\w]*)/);
    const mod = m1?.[1] ?? m2?.[1];
    if (mod) imported.add(mod);
  }
  return PYODIDE_PACKAGES.filter((pkg) => imported.has(pkg));
}

// 从本地加载大包(pandas/matplotlib 等)
// 核心运行时 + lock.json + 常用包 wheel 都自托管在 public/pyodide/,离线可用
// loadPackagesFromImports 会扫描 import 语句,查 lock.json,自动解析并加载所有依赖
async function loadRequiredPackages(
  pyodide: PyodideInterface,
  code: string,
): Promise<void> {
  if (detectRequiredPackages(code).length === 0) return;
  await pyodide.loadPackagesFromImports(code, { messageCallback: () => {} });
}

// matplotlib Agg backend → base64 PNG 捕获辅助代码
// 重定向 plt.show():用 Agg backend 渲染成 PNG,通过 JS bridge 传出来
const MATPLOTLIB_HELPER = `
import base64
import io

def _pp_capture_and_send(fig):
    """把 matplotlib figure 渲染成 PNG 并通过 JS bridge 传出去。"""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    buf.seek(0)
    import js
    js.window.__pp_capture_image(base64.b64encode(buf.read()).decode("ascii"))
    buf.close()

def _pp_install_noop_show():
    """把 plt.show() 改成空操作,防止用户代码里的 show() 和末尾 _pp_show_all 重复画图。
    figure 仍保留在内存里,由 _pp_show_all 统一捕获。"""
    try:
        import matplotlib.pyplot as plt
        plt.show = lambda *a, **k: None
    except ImportError:
        pass

def _pp_show_all():
    """捕获所有打开的 matplotlib figure 并清空。用户代码末尾自动调用。"""
    try:
        import matplotlib.pyplot as plt
        for num in plt.get_fignums():
            _pp_capture_and_send(plt.figure(num))
        plt.close("all")
    except ImportError:
        pass

def _pp_close_all():
    """运行前清理上次残留的 matplotlib figure(Pyodide 单全局命名空间会保留状态)。"""
    try:
        import matplotlib.pyplot as plt
        plt.close("all")
    except ImportError:
        pass
`;

const DEFAULT_CODE = "";
