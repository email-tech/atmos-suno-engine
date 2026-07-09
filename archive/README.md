# Unified Suno Style + Lyric Engine

This is a local, folder-contained web app for building a Suno style prompt first, then generating Suno-ready lyrics with Claude.

## How to Open

Open `index.html` in a modern browser from this folder:

```txt
unified-suno-lyric-engine/index.html
```

No install, build step, login, database, Node, React, Vite, or backend server is required.

## Claude API Key

Enter your Claude API key in the Claude Settings panel.

The key is used only in your browser. If you enable "Remember API key on this PC", it is stored in this browser's `localStorage`. Do not enable that option on a shared computer.

The app files do not contain a hardcoded API key.

## Optional Local Proxy

If direct browser calls fail, use the included local proxy:

```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."
node claude-local-proxy.mjs
```

Then set **Connection mode** in the app to **Local proxy at 127.0.0.1:8787**.

On Windows, you can also double-click `start-claude-proxy.bat`, paste the key when prompted, and leave that window open.

If your browser blocks JavaScript modules or local requests from a double-clicked HTML file, double-click `start-local-app.bat`. It will choose an available local port and open the app automatically. The usual URL is:

```txt
http://127.0.0.1:8765/index.html
```

If port `8765` is already busy, the launcher will try `8766`, `8767`, and so on.

This app defaults to `claude-opus-4-1-20250805` because it was verified with the supplied key during local troubleshooting. If you change models and see a 404 model error, that model is not available to the current API key/workspace.

## CORS Warning

Direct browser calls to Claude may be blocked depending on Anthropic's current CORS policy. This app is designed for local PC use with a frontend-stored API key, as requested. If browser calls fail, the next upgrade path is a tiny local proxy server.

## Workflow

1. Build the Style Prompt in Step 1.
2. Configure the song concept, structure, and optional language layer.
3. Enter your Claude API key and test the connection if desired.
4. Click **Generate Lyrics with Claude**.
5. Review the validation result.
6. Copy **Suno Style Prompt**, **Suno Lyrics**, and **Negative Prompt** separately.

The app asks Claude for theme brief, lyrics, metatags, and validation in one pass. If validation fails below 80 or returns `passed: false`, it sends one automatic repair request.

## Interface Notes

The interface uses GitHub Primer-inspired product patterns: a focused split layout, pill workflow navigation, compact panels, choice chips for major decisions, collapsed fine-tuning sections for lower-level controls, and tabbed outputs to reduce visual noise.

## File Structure

```txt
unified-suno-lyric-engine/
  index.html
  css/
    tokens.css
    layout.css
    components.css
  js/
    app.bundle.js
    app.js
    state.js
    data-style-engines.js
    data-lyric-controls.js
    prompt-style-builder.js
    prompt-lyric-builder.js
    claude-client.js
    validation.js
    storage.js
    ui.js
  docs/
    README.md
    source-migration.md
```

`index.html` loads `js/app.bundle.js` so the app can run from a plain local file path. The other JavaScript files are the organized source modules used to maintain the app.

See `docs/source-migration.md` for notes on what was migrated from the two original HTML apps.

## Local Storage

The app may store:

- Claude API key, only when "Remember API key on this PC" is enabled
- Last selected controls
- Last successful output
- Saved setup data

Use **Export JSON** to back up your setup. Keep exported files somewhere private if they include creative notes.

## If Claude Calls Fail

Check:

- API key is present and valid
- Model name is available to your Anthropic account
- Browser is online
- Browser or Anthropic CORS policy is not blocking direct API calls

If CORS blocks the call, keep this frontend and add a small local proxy as the next upgrade path.
