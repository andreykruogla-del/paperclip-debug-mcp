# X Video Rendering (Remotion)

This project includes a short X explainer composition:

- Composition id: `XExplainer`
- Entry: `video/index.ts`
- Output target: `out/x-explainer.mp4`

## Local preview

```bash
npm run video:studio
```

## Local render

Cross-platform command:

```bash
npm run video:render
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
4. Download the artifact named `x-explainer-mp4`.
