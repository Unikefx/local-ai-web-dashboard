# Release Notes - v1.0.0

## 🚀 Local Ollama Web AI Dashboard v1.0.0

We are excited to release **v1.0.0** of the Local Ollama Web AI Dashboard — a ChatGPT-style local web interface for Windows running 100% on your PC with Ollama.

---

### ✨ Key Features in v1.0.0

- 🤖 **Dynamic Model Selection**: Automatically fetches all locally installed Ollama models (`qwen2.5:latest`, `llama3.2:3b`, `qwen2.5:3b`, etc.) via `GET /api/tags`.
- ⚡ **Real-Time NDJSON Response Streaming**: Instant word-by-word streaming AI responses proxied through Node.js Express to local Ollama.
- ⏹️ **Stop Generation Control**: Instantly interrupt or stop AI generation mid-stream using the Stop button or `Esc` key.
- ✨ **Cute AI Processing Companion**: Animated visual robot mascot `(•̀ᴗ•́)و ✨` with sparkling effects and typing wave dots during processing.
- 📝 **Markdown & Code Highlighting**: Full Markdown rendering with `marked`, syntax highlighting with `highlight.js`, and **"Copy Code"** buttons.
- 💬 **Conversation History & Storage**:
  - Persistent local storage in `chats.json`.
  - Delete individual conversations (`🗑️`).
  - Inline title editing / chat renaming (`✏️`).
  - Sidebar search filter for past chats.
  - Model switching per conversation.
- ⚙️ **Custom System Prompts & Parameters**: Define system instructions and control temperature (creativity) per chat.
- 🚀 **Windows One-Click Launcher**: Includes `start-ai.bat` and `start-ai.ps1` for instant double-click launching without PowerShell execution policy errors.

---

### 📦 Installation & Usage

1. Clone or download the repository:
   ```powershell
   git clone https://github.com/Unikefx/local-ai-web-dashboard.git
   cd local-ai-web-dashboard
   ```
2. Double-click `start-ai.bat` to launch!
3. Open browser at `http://localhost:3000`.

---

### 🛡️ Privacy & Security
- 100% Local Inference — zero telemetry, zero cloud APIs, zero external databases.
- All conversation data stays on your local machine.
