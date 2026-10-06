const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const HISTORY_FILE = path.join(__dirname, "chats.json");

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/marked", express.static(path.join(__dirname, "node_modules/marked/lib")));
app.use("/vendor/highlight", express.static(path.join(__dirname, "node_modules/@highlightjs/cdn-assets")));

function loadChats() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error reading chats.json:", err.message);
    return [];
  }
}

function saveChats(chats) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(chats, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing chats.json:", err.message);
  }
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function getPrettyName(tag) {
  const map = {
    "qwen2.5:latest": "Qwen 2.5 Latest",
    "qwen2.5": "Qwen 2.5",
    "llama3.2:3b": "Llama 3.2 3B",
    "llama3.2": "Llama 3.2",
    "qwen2.5:3b": "Qwen 2.5 3B",
    "qwen2.5:7b": "Qwen 2.5 7B",
    "llama3:latest": "Llama 3 Latest",
    "mistral:latest": "Mistral Latest",
    "deepseek-r1:latest": "DeepSeek R1 Latest",
    "gemma2:latest": "Gemma 2 Latest"
  };
  if (map[tag]) return map[tag];
  return tag.replace(/:latest$/, "").replace(/:/, " ").toUpperCase();
}

app.get("/api/models", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error(`Ollama returned status ${r.status}`);
    const data = await r.json();

    const modelsList = (data.models || []).map(m => ({
      id: m.name,
      name: m.name,
      displayName: getPrettyName(m.name),
      sizeFormatted: formatBytes(m.size),
      parameterSize: m.details?.parameter_size || "",
      family: m.details?.family || "",
      quantization: m.details?.quantization_level || ""
    }));

    res.json({ models: modelsList, tags: (data.models || []).map(m => m.name) });
  } catch (e) {
    res.status(503).json({
      error: "Cannot connect to Ollama. Make sure Ollama is running.",
      details: e.message,
      ollamaUrl: OLLAMA_URL
    });
  }
});

app.get("/api/chats", (_req, res) => {
  const chats = loadChats();
  res.json(chats);
});

app.get("/api/chats/:id", (req, res) => {
  const chats = loadChats();
  const chat = chats.find(c => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json(chat);
});

app.post("/api/chats", (req, res) => {
  const chats = loadChats();
  const now = new Date().toISOString();
  let model = req.body.model;
  if (!model || model === "undefined" || model === "null") {
    model = "qwen2.5:latest";
  }

  const chat = {
    id: Date.now().toString(),
    title: req.body.title || "New Chat",
    model: model,
    systemPrompt: req.body.systemPrompt || "",
    temperature: typeof req.body.temperature === "number" ? req.body.temperature : 0.7,
    messages: Array.isArray(req.body.messages) ? req.body.messages : [],
    createdAt: now,
    updatedAt: now
  };
  chats.unshift(chat);
  saveChats(chats);
  res.json(chat);
});

app.put("/api/chats/:id", (req, res) => {
  const chats = loadChats();
  const chat = chats.find(c => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  if (typeof req.body.title === "string") chat.title = req.body.title;
  if (typeof req.body.model === "string" && req.body.model !== "undefined" && req.body.model !== "null") {
    chat.model = req.body.model;
  }
  if (typeof req.body.systemPrompt === "string") chat.systemPrompt = req.body.systemPrompt;
  if (typeof req.body.temperature === "number") chat.temperature = req.body.temperature;
  if (Array.isArray(req.body.messages)) chat.messages = req.body.messages;
  chat.updatedAt = new Date().toISOString();

  saveChats(chats);
  res.json(chat);
});

app.delete("/api/chats/:id", (req, res) => {
  let chats = loadChats();
  const initialLen = chats.length;
  chats = chats.filter(c => c.id !== req.params.id);
  saveChats(chats);
  res.json({ ok: true, deleted: chats.length < initialLen });
});

app.delete("/api/chats", (_req, res) => {
  saveChats([]);
  res.json({ ok: true, message: "All chats cleared" });
});

app.post("/api/chat", async (req, res) => {
  let { chatId, model, messages, options, systemPrompt } = req.body;

  if (!model || model === "undefined" || model === "null") {
    model = "qwen2.5:latest";
  }

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const payloadMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    payloadMessages.push({ role: "system", content: systemPrompt.trim() });
  }
  for (const m of messages) {
    payloadMessages.push({ role: m.role, content: m.content });
  }

  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: payloadMessages,
        stream: true,
        options: options || {}
      })
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      return res.status(ollamaResponse.status).json({
        error: `Ollama API Error (${ollamaResponse.status})`,
        details: errorText
      });
    }

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = ollamaResponse.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";
    let residual = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (residual + chunk).split("\n");
      residual = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.message?.content) {
            assistantText += obj.message.content;
          }
          res.write(JSON.stringify(obj) + "\n");
        } catch {
          // ignore malformed line
        }
      }
    }

    if (residual.trim()) {
      try {
        const obj = JSON.parse(residual);
        if (obj.message?.content) {
          assistantText += obj.message.content;
        }
        res.write(JSON.stringify(obj) + "\n");
      } catch {}
    }

    res.end();

    if (chatId && assistantText) {
      const chats = loadChats();
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        const hasAssistant = chat.messages.length > 0 && 
          chat.messages[chat.messages.length - 1].role === "assistant";
        
        if (!hasAssistant) {
          chat.messages.push({ role: "assistant", content: assistantText, modelUsed: model });
        } else {
          chat.messages[chat.messages.length - 1].content = assistantText;
          chat.messages[chat.messages.length - 1].modelUsed = model;
        }
        chat.model = model;
        chat.updatedAt = new Date().toISOString();
        saveChats(chats);
      }
    }
  } catch (e) {
    if (!res.headersSent) {
      res.status(503).json({
        error: "Cannot connect to Ollama local service.",
        details: e.message
      });
    } else {
      res.write(JSON.stringify({ error: e.message }) + "\n");
      res.end();
    }
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Local AI Web Interface running at: http://localhost:${PORT}`);
  console.log(`Connected to local Ollama API at: ${OLLAMA_URL}`);
});