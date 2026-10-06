# Local Ollama Web AI Studio

A modern ChatGPT-style local web interface for Windows running 100% locally with **Ollama**.

![Local AI Interface](http://localhost:3000)

## Features

- 🤖 **Dynamic Model Selector**: Automatically fetches installed Ollama models (`qwen2.5:latest`, `llama3.2:3b`, `qwen2.5:3b`, etc.) via `GET /api/tags`.
- ⚡ **Real-Time NDJSON Streaming**: Instant word-by-word streaming AI responses via Ollama `POST /api/chat`.
- ⏹️ **Stop Generation**: Cancel response generation mid-stream anytime with the Stop button or `Esc` key.
- 💬 **Conversation Management**: Multiple persistent chats with auto-titling, inline renaming, individual chat deletion (`🗑️`), and search history filtering.
- ✨ **Cute Processing Animation**: Animated AI mascot companion with pulsing glowing effects while generating thoughts.
- 📝 **Markdown & Code Support**: Full markdown rendering with syntax highlighting (`highlight.js`) and one-click **"Copy Code"** buttons.
- ⚙️ **Custom System Prompts & Temperature**: Customize persona instructions and temperature per chat.
- 🚀 **Windows One-Click Launcher**: Double-click `start-ai.bat` to launch instantly without PowerShell execution policy errors.

## Architecture

```text
Browser (http://localhost:3000)
   ↓
Node.js / Express Backend (/api/chat)
   ↓
Local Ollama API (http://127.0.0.1:11434)
   ↓
Local AI Models (Qwen 2.5, Llama 3.2, etc.)
```

Data storage is 100% offline and local in `chats.json`.

## Quick Start on Windows

### Method 1: Double-Click Launcher (Recommended)
Simply double-click **`start-ai.bat`** in Windows File Explorer. It bypasses execution policy restrictions automatically.

### Method 2: PowerShell
Open PowerShell in the project directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-ai.ps1
```

If you encounter the `File start-ai.ps1 cannot be loaded` error:

```powershell
Unblock-File .\start-ai.ps1
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
.\start-ai.ps1
```

### Method 3: Standard NPM
```powershell
npm install
npm start
```

Then open your browser at: **`http://localhost:3000`**

## Recommended Ollama Models

Install models in terminal using Ollama:

```powershell
ollama pull qwen2.5:latest
ollama pull llama3.2:3b
ollama pull qwen2.5:3b
```

## Keyboard Shortcuts

- `Ctrl` + `N` : New Chat
- `Enter` : Send Message
- `Shift` + `Enter` : New Line
- `Esc` : Stop Generation
- `Ctrl` + `K` : Focus Search / Input

## Modular Design for Future Features

The architecture is built cleanly to support future extensions:
- Dark/Light mode toggles
- Side-by-side model comparison (Qwen vs Llama)
- File/PDF upload & local document RAG search
- Vision-capable multimodal models

## Release Notes

See [RELEASE.md](RELEASE.md) for version 1.0.0 release notes and feature breakdown.
