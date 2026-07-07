# PythonPlayground AGENTS.md

请用简体中文回复,思考过程也用中文。

## 项目定位

**手机端 Python 学习实验室**(不是"在线运行环境")。

定位决定功能优先级:围绕学习展开(内置练习、错误解释、代码模板、学习记录),不做迷你 IDE(不加 Git、多语言、终端)。

真实需求:用户白天 8 小时只能用手机学 Python,市面 App 跑 3 次就收费。这个工具解决这个痛点 - 零成本、无限次、离线可用。

## 技术决策记录(已锁定,改动需充分理由)

### 运行核心:Pyodide(锁 0.27.3+)
- CPython 编译成 WebAssembly,纯前端运行,零服务器计算成本
- 原生支持 numpy / pandas / matplotlib / scikit-learn
- **锁版本 0.27.3+**:0.27.1 / 0.27.2 在 iOS 18.3.2 Safari 上有整页崩溃 bug
- 不考虑 Brython / Skulpt / RustPython(不支持数据科学栈)
- JupyterLite 手机端 UI 不可用(GitHub issue #3275),自己做手机优先界面是对的

### 前端:Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- Vite 而非 Next.js:本项目纯客户端运行,Next.js 的 SSR/SEO/API Routes 全是零价值,徒增心智负担
- Vite 产物是纯静态文件,部署到任何静态托管都极简单
- Pyodide 的 loadPyodide() 必须在 client 侧动态 import,Next.js 还要 'use client' 双重包裹,更啰嗦

### 代码编辑器:CodeMirror 6(不用 Monaco)
- Monaco 5MB+ 手机加载慢,CodeMirror 6 几百 KB,移动端友好

### 图表渲染:matplotlib Agg backend → base64 PNG
- 不用 SVG / mpld3,手机触摸交互差且兼容性不稳
- 静态 PNG 学习够用

### 执行隔离:Web Worker + interrupt buffer
- Pyodide 必须跑在 Web Worker,否则执行 pandas 时主线程卡死、UI 无响应
- SharedArrayBuffer + pyodide.setInterruptBuffer 实现停止按钮,防死循环卡死

### 小程序:不做
- 个人主体不支持 web-view 组件(微信硬规定),只有企业主体能用
- 走 PWA 到底,添加到桌面全屏运行

## Pyodide 已知限制(影响场景评估)

- 不支持 requests / yfinance 这类抓数据的库(C 扩展 + socket 问题)
- 用户场景以离线数据处理为主(上传 CSV/Excel → pandas 处理),这个限制影响很小
- requests 替代方案:pyodide.http.pyfetch
- 第三方包只能装 Pyodide 官方打包的,纯 PyPI pip install 不行

## 文件系统:MEMFS
- Pyodide 是虚拟文件系统,读不到手机本地文件
- 用户要跑 `pd.read_csv('data.csv')`,数据通过 JS 侧上传 → 写入 MEMFS → Python 读取
- 用 FileReader / ArrayBuffer 处理上传

## 部署方案(两步走)
- **阶段 0-1**:Vercel 免费托管(连 GitHub 自动部署),Pyodide 本体自托管(打进 public/pyodide/,不依赖 jsDelivr 外部 CDN,保证离线可用)
- **阶段 1 后期若国内体验差**:切腾讯云 COS 对象存储 + CDN + 备案域名(几块/年)
- 不买轻量服务器,静态文件不需要

工作流:代码存 GitHub → Vercel/腾讯云读 GitHub 自动部署 → 手机访问网址

## PoC 验证清单(阶段 0 必须真机跑完)

按重要性排:
1. 三段基础代码跑通:纯语法 / pandas DataFrame+groupby / matplotlib 折线图(Agg→PNG)
2. iOS Safari 真机:Pyodide 能否加载、matplotlib 能否渲染
3. 低端安卓真机(3-4GB 内存):首次加载时长,跑大 DataFrame 会不会 OOM
4. 内存极限测试:`pd.DataFrame(np.random.rand(10000, 5))` 看会不会发烫/崩溃
5. 4G 网络加载掐表:从打开到能点运行 ≤30 秒
6. 断网运行:Pyodide 加载完后断网点运行能否跑
7. 后台切换:切到微信再回来,锁屏解锁,Pyodide 是否还在
8. PWA 添加到桌面:能否全屏运行
9. 键盘遮挡:代码编辑区在键盘弹起时是否被挡
10. JupyterLite 对照:手机打开官方 demo 感受"为什么不好用"(免费确认项目合法性)

## 前端设计原则(从 design-taste-frontend skill 提取适用部分)

Taste Skill 主战场是 landing page,对工具型应用只有部分适用。硬适用的:

- **响应式**:全用 `min-h-[100dvh]` 不用 `h-screen`(防 iOS 地址栏跳动);grid 优先于 flex 百分式运算
- **交互状态完整性**:loading / empty / error 全套;按钮 tactile feedback(`:active` 时 scale-[0.98])
- **暗色模式**:整页一个主题锁定,默认跟随 prefers-color-scheme,加手动切换
- **图标**:Phosphor Icons(`@phosphor-icons/react`),不手画 SVG,一个项目只用一套图标
- **字体**:不用 Inter 做默认,选 Geist 或类似;代码区用等宽字体
- **AI Tells 避免**:不用 AI 紫色渐变、不用 em-dash(改普通连字符)、不手画 SVG、不用纯黑纯白(用 zinc-950 / off-white)
- **性能**:只动画 transform/opacity,尊重 prefers-reduced-motion
- **触控友好**:按钮最小触控区 44x44px

## 编程规范(遵循根 AGENTS.md 的 Karpathy 规范)

- 简洁至上:不写需求之外的功能,不过度抽象
- 手术式修改:只碰必须碰的,匹配现有风格
- 目标驱动:每步都有验证标准

## 当前阶段

阶段 0(PoC):验证 Pyodide 在真机上能否跑通。
