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

For GitHub project pages, Vite needs a repository subpath such as `/<repo-name>/`. The current `vite.config.js` reads `GITHUB_REPOSITORY` during the GitHub Actions build and automatically sets the correct `base` path. Local development keeps `base` as `/`.

In the GitHub repository settings, go to **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**, then push to `main`.
