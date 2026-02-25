# Contributing to TalkyTexty

Thanks for your interest in contributing! This guide covers how to get set up and submit changes.

## Getting started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Rust | 1.80+ |
| Node.js | 20+ |
| pnpm | 9+ |
| cmake | any |

**macOS:** `xcode-select --install && brew install cmake`

**Windows:** Visual Studio Build Tools with C++ workload

**Linux:** `sudo apt install libasound2-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev cmake`

### Setup

```bash
git clone https://github.com/codewithtim/talkytexty.git
cd talkytexty
pnpm install
pnpm tauri dev
```

The first build compiles whisper.cpp from source and takes several minutes. Subsequent builds are incremental.

## Making changes

1. Create a branch from `main`
2. Make your changes
3. Run the quality gates before submitting

### Quality gates

```bash
# Rust
cd src-tauri
cargo test
cargo clippy -- -D warnings
cargo fmt --check

# Frontend
cd ..
pnpm test
pnpm lint
pnpm format:check
npx tsc --noEmit
```

Or run everything at once:

```bash
cd src-tauri && cargo test && cargo clippy -- -D warnings && cargo fmt --check && cd .. && \
  pnpm test && pnpm lint && pnpm format:check && npx tsc --noEmit
```

## Code style

- **Rust**: Follow standard Rust conventions. `cargo fmt` and `cargo clippy` are enforced.
- **TypeScript/React**: Follow existing patterns in the codebase. ESLint and Prettier are configured.
- Keep changes focused — one concern per PR.
- Don't add comments, docstrings, or type annotations to code you didn't change.

## Project structure

```
src/                  # React frontend (TypeScript, Tailwind CSS)
src-tauri/            # Rust backend (Tauri v2)
  src/
    lib.rs            # App entry, tray, hotkey handler
    audio/            # Microphone capture and resampling
    transcription/    # Whisper engine and model registry
    injection/        # Text injection (keyboard, clipboard)
    preferences/      # User preferences persistence
    commands/         # Tauri IPC command handlers
  tests/              # Rust test suites (unit, contract, integration)
```

## Submitting a PR

1. Push your branch and open a pull request against `main`
2. Describe what changed and why
3. Ensure all quality gates pass
4. Keep PRs small and reviewable when possible
