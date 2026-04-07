# Bubble Listening Player

A React + Vite single-page app for manually staging chat-style listening content, recording the chat canvas to WebM, and exporting SRT/JSON timing data.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## GitHub Pages Deployment

This project is ready for GitHub Pages deployment through GitHub Actions. The workflow lives at `.github/workflows/deploy.yml` and runs automatically when changes are pushed to `main`.

This repository is configured for the custom domain `chatcue.dacnote.com`, so Vite uses `base: '/'`. The `public/CNAME` file is copied into `dist/` during builds so GitHub Pages keeps the custom domain setting.

In the GitHub repository settings, go to **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**, then push to `main`.
