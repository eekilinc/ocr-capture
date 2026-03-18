# OCR Capture (Tauri v2 + React + TypeScript)

Desktop OCR tool for Windows, macOS, and Linux.

## What it does

- Captures the current screen as an image.
- Lets you draw a rectangle to pick the OCR region.
- Extracts text with Tesseract (`tur+eng`).
- Shows result text and lets you copy it.

## Tech stack

- Tauri v2 (Rust backend commands)
- React + TypeScript (Vite)
- `screenshots` crate for screen capture
- Tesseract CLI for OCR engine

## Prerequisites

1. Node.js 20+
2. Rust toolchain (stable)
3. Tauri OS prerequisites: <https://tauri.app/start/prerequisites/>
4. Tesseract CLI in PATH

### Tesseract notes

- Install language packs for Turkish and English.
- Quick test:

```bash
tesseract --version
```

## Run locally

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Project structure

- `src/components`: UI sections (header, capture canvas, result panel, toast)
- `src/hooks`: custom hooks (`useTheme`)
- `src/lib`: helpers (`image` crop utilities)
- `src-tauri/src/commands`: Rust commands (`capture`, `ocr`)

## Cross-platform notes

- macOS: app may need Screen Recording permission.
- Windows: capture uses physical pixels. UI selection is scaled to captured image size for DPI accuracy.
- Linux: Wayland sessions may restrict direct capture. X11 is usually more reliable.

## Known limitations

- Current capture command grabs the first detected monitor.
- OCR depends on `tesseract` executable being installed and available in PATH.
- Linux Wayland behavior can vary by compositor and portal setup.

## Suggested next steps

- Add global hotkey for instant capture.
- Store OCR history in local database.
- Add per-language presets and auto language detection.
- Add export options (`.txt`, `.md`).
