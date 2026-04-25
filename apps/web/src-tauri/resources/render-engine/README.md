Bundled render engine

This directory is packaged into the Tauri app bundle. Desktop PPTX preview uses
these binaries directly and no longer downloads LibreOffice on first open.

Current target

- Platform: macOS Apple Silicon
- Directory: `apps/web/src-tauri/resources/render-engine/darwin-arm64/`

Required layout

```text
apps/web/src-tauri/resources/render-engine/
  darwin-arm64/
    LibreOffice.app
    poppler/
      bin/
        pdftoppm
```

Required binaries

- `darwin-arm64/LibreOffice.app/Contents/MacOS/soffice`
- `darwin-arm64/poppler/bin/pdftoppm`

How to obtain LibreOffice

1. Open the official LibreOffice download page:
   `https://www.libreoffice.org/download/download-libreoffice/`
2. Download the macOS Apple Silicon build.
3. Mount the downloaded `.dmg`.
4. Copy `LibreOffice.app` into:
   `apps/web/src-tauri/resources/render-engine/darwin-arm64/`

Result:

```text
apps/web/src-tauri/resources/render-engine/darwin-arm64/LibreOffice.app
```

How to obtain pdftoppm

`pdftoppm` comes from Poppler.

Option A: copy from Homebrew Poppler

1. Install Poppler locally if needed:
   `brew install poppler`
2. Create the target directory:
   `mkdir -p apps/web/src-tauri/resources/render-engine/darwin-arm64/poppler/bin`
3. Copy the binary:
   `cp /opt/homebrew/bin/pdftoppm apps/web/src-tauri/resources/render-engine/darwin-arm64/poppler/bin/`

Option B: copy from another Poppler build you already trust

1. Find a working `pdftoppm` binary.
2. Put it here:
   `apps/web/src-tauri/resources/render-engine/darwin-arm64/poppler/bin/pdftoppm`

Verify the files

Run these checks:

```bash
test -f apps/web/src-tauri/resources/render-engine/darwin-arm64/LibreOffice.app/Contents/MacOS/soffice && echo "soffice ok"
test -f apps/web/src-tauri/resources/render-engine/darwin-arm64/poppler/bin/pdftoppm && echo "pdftoppm ok"
```

How to test in the app

1. Start desktop dev:
   `pnpm --filter web tauri:dev`
2. Open a `.pptx` in the desktop app.
3. Check logs for:
   `Using bundled render engine`

What is committed

- This folder has a `.gitignore` that ignores the large binaries by default.
- `README.md` and `.gitignore` stay tracked.
- The real LibreOffice and Poppler files are meant for local testing unless you
  explicitly decide to distribute them in your release pipeline.

Notes

- Bundling LibreOffice will increase the app size significantly.
- The old render-engine manifest and on-demand download flow were removed.
- Legacy `~/.alloomi/render-engines/office/installed.json` is still read as a
  fallback, but the intended path is the bundled resource directory.
