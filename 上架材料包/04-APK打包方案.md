# APK 打包方案

> 目标：把万年历打包成可安装的安卓 APK。给出两条路径，**推荐方案 A（云打包）**——零本地依赖、10 分钟出包；方案 B 为本地构建，适合后续频繁迭代。

## 方案 A：HBuilderX 云打包（推荐，零本地依赖）

HBuilderX 是 DCloud 的免费 IDE，其"云打包"在 DCloud 服务器上完成编译，本机**不需要安装任何安卓环境**（个人使用免费，需 DCloud 账号实名）。

### 步骤（约 10 分钟）

1. 下载安装 **HBuilderX**（标准版即可）：https://www.dcloud.io/hbuilderx.html
2. 打开 HBuilderX → 文件 → 新建 → 项目 → 选择 **"5+App(A)"** 类型（或 Wap2App），项目名 `wannianli`，**不选模板、创建空项目**
3. 把本项目 `wanlianli` 目录（即部署包解压内容）中的全部文件复制进新建项目的根目录（覆盖同名文件即可，`manifest.json` 用项目自动生成的，不要覆盖）
4. 双击打开 `manifest.json` → 基础配置：
   - 应用名称：万年历
   - AppID：点"重新获取"（需登录 DCloud 账号，免费注册实名）
   - 应用入口页面：index.html
5. 菜单 **发行 → 原生App-云打包**：
   - 安卓包名：`com.jasmintse.wannianli`
   - 证书：选"使用公共测试证书"（个人自用足够）
   - 勾选"打正式包"可去广告标识，测试包亦可
   - 点击打包，等待 3-10 分钟，云端产出 APK 下载链接
6. 下载 APK 传到手机安装（设置中允许安装未知来源应用）

### 注意

- 云打包免费额度：每日数次，个人使用绰绰有余
- 打出的 APK 已内置 WebView 加载本地页面，**完全离线可用**
- 应用更新：改完网页文件后重新云打包即可

## 方案 B：本地构建（Capacitor + Android Studio）

适合后续想频繁自己打包、不介意装环境的情况。需要：JDK 17 + Android Studio（含 SDK，约 3-5GB）。

```bat
:: 1. 安装 Node.js 后，在项目目录执行：
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init 万年历 com.jasmintse.wannianli --web-dir=wanlianli
npx cap add android

:: 2. 打开 Android Studio 打开 android\ 目录，Build → Build APK
::    或命令行：cd android && gradlew assembleDebug
::    产物：android\app\build\outputs\apk\debug\app-debug.apk
```

## 两条路径对比

| | 方案 A 云打包 | 方案 B 本地构建 |
|---|---|---|
| 本机环境要求 | 仅 HBuilderX | JDK17 + Android Studio（数 GB） |
| 出包时间 | 3-10 分钟/次 | 首次配置半天，之后分钟级 |
| 费用 | 免费（实名后） | 免费 |
| 适合 | 个人使用、偶尔更新 | 频繁迭代开发 |
