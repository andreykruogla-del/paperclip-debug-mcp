# X Video Rendering (Remotion)

This project includes media compositions for X, LinkedIn, and GitHub:

- Composition id: `XExplainer`
- Composition id: `TerminalShowcase`
- Composition id: `TerminalLoop`
- Entry: `video/index.ts`
- Output targets:
  - `out/x-explainer.mp4`
  - `out/terminal-showcase.mp4`
  - `out/terminal-loop.mp4`
  - `out/terminal-loop.gif` (from loop mp4 + ffmpeg)

## Local preview

```bash
npm run video:studio
```

## Local render

Cross-platform command:

```bash
npm run video:render
```

Terminal-first variant:

```bash
npm run video:render:terminal
```

Short loop source:

```bash
npm run video:render:loop
```

Convert loop source to GIF:

```bash
npm run video:make:gif
```

Windows-specific fallback that points to installed Chrome:

```bash
npm run video:render:win
```

## CI render (recommended on Windows ARM64)

If local render is blocked by architecture limits, use GitHub Actions:

1. Push your branch with `.github/workflows/render-video.yml`.
2. Open **Actions** -> **Render X Video**.
3. Click **Run workflow**.
4. Download the artifact named `paperclip-debug-media`.
