// Application State
let chats = [];
let currentChat = null;
let models = [];
let generating = false;
let abortController = null;
let userHasScrolledUp = false;

// DOM Helper
const $ = id => document.getElementById(id);

// DOM Elements
const messagesContainer = $("messagesContainer");
const emptyState = $("emptyState");
const promptInput = $("promptInput");
const sendBtn = $("sendBtn");
const stopGenBtn = $("stopGenBtn");
const modelSelect = $("modelSelect");
const modelInfoBadge = $("modelInfoBadge");
const aiProcessingState = $("aiProcessingState");
const chatList = $("chatList");
const chatTitle = $("chatTitle");
const chatSearchInput = $("chatSearchInput");
const sidebar = $("sidebar");
const charCounter = $("charCounter");

// Configure Marked & Highlight.js
if (window.marked) {
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: function(code, lang) {
      if (window.hljs) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (e) {}
        }
        return hljs.highlightAuto(code).value;
      }
      return code;
    }
  });
}

// API Helper
async function api(url, options = {}) {
  const r = await fetch(url, options);
  if (!r.ok) {
    let errorMsg = `HTTP ${r.status}`;
    try {
      const data = await r.json();
      errorMsg = data.error || data.details || errorMsg;
    } catch {
      const text = await r.text();
      errorMsg = text || errorMsg;
    }
    throw new Error(errorMsg);
  }
  return r;
}

// Toast Notifications
function showToast(message, isError = false) {
  const container = $("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Model Helper
function getValidModel(requestedModel) {
  if (requestedModel && requestedModel !== "undefined" && requestedModel !== "null") {
    return requestedModel;
  }
  if (modelSelect.value && modelSelect.value !== "undefined" && modelSelect.value !== "null") {
    return modelSelect.value;
  }
  if (models.length > 0) {
    const first = models[0];
    return typeof first === "string" ? first : (first.name || first.id || "qwen2.5:latest");
  }
  return "qwen2.5:latest";
}

// Load Available Models from Backend
async function loadModels() {
  try {
    const data = await (await api("/api/models")).json();
    const rawModels = data.models || data.tags || [];

    models = rawModels.map(m => {
      if (typeof m === "string") {
        return { id: m, name: m, displayName: m, sizeFormatted: "", parameterSize: "" };
      }
      return {
        id: m.id || m.name,
        name: m.name || m.id,
        displayName: m.displayName || m.name || m.id,
        sizeFormatted: m.sizeFormatted || "",
        parameterSize: m.parameterSize || ""
      };
    });

    modelSelect.innerHTML = "";
    if (models.length === 0) {
      const opt = document.createElement("option");
      opt.value = "qwen2.5:latest";
      opt.textContent = "qwen2.5:latest (Default)";
      modelSelect.appendChild(opt);
      $("statusDot").classList.remove("online");
      $("statusText").textContent = "No models in Ollama";
      return;
    }

    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.textContent = `${m.displayName}${m.sizeFormatted ? ' (' + m.sizeFormatted + ')' : ''}`;
      opt.dataset.param = m.parameterSize || "";
      modelSelect.appendChild(opt);
    }

    // Default preference order
    const preferred = ["qwen2.5:latest", "llama3.2:3b", "qwen2.5:3b"];
    const foundPref = preferred.find(p => models.some(m => m.name === p));
    if (foundPref) {
      modelSelect.value = foundPref;
    } else if (models.length > 0) {
      modelSelect.value = models[0].name;
    }

    updateModelBadge();

    $("statusDot").classList.add("online");
    $("statusText").textContent = `Ollama online (${models.length} models)`;
  } catch (e) {
    console.error("Failed to load models:", e);
    $("statusDot").classList.remove("online");
    $("statusText").textContent = "Ollama offline";
    showToast("Cannot connect to local Ollama API. Make sure 'ollama serve' is running.", true);
  }
}

function updateModelBadge() {
  const selectedTag = modelSelect.value;
  const match = models.find(m => m.name === selectedTag);
  if (match && match.parameterSize) {
    modelInfoBadge.textContent = match.parameterSize;
    modelInfoBadge.style.display = "inline-block";
  } else {
    modelInfoBadge.style.display = "none";
  }
}

// Load Chat Conversations History
async function loadChats() {
  try {
    chats = await (await api("/api/chats")).json();
    renderChatList();

    if (chats.length > 0) {
      openChat(chats[0].id);
    } else {
      await createChat();
    }
  } catch (e) {
    showToast("Error loading chat history: " + e.message, true);
  }
}

function renderChatList() {
  chatList.innerHTML = "";
  const filterQuery = (chatSearchInput.value || "").toLowerCase().trim();

  const filteredChats = chats.filter(c => {
    if (!filterQuery) return true;
    const titleMatch = (c.title || "").toLowerCase().includes(filterQuery);
    const contentMatch = (c.messages || []).some(m => (m.content || "").toLowerCase().includes(filterQuery));
    return titleMatch || contentMatch;
  });

  if (filteredChats.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.style.padding = "12px 10px";
    emptyMsg.style.fontSize = "12px";
    emptyMsg.style.color = "var(--text-subtle)";
    emptyMsg.style.textAlign = "center";
    emptyMsg.textContent = filterQuery ? "No matching chats found" : "No chats yet";
    chatList.appendChild(emptyMsg);
    return;
  }

  for (const chat of filteredChats) {
    const item = document.createElement("div");
    item.className = `chat-item ${currentChat?.id === chat.id ? "active" : ""}`;
    
    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-item-title";
    titleSpan.textContent = chat.title || "New Chat";
    titleSpan.title = chat.title || "New Chat";

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "chat-item-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-chat-btn";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete Chat";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    };

    actionsDiv.appendChild(deleteBtn);
    item.appendChild(titleSpan);
    item.appendChild(actionsDiv);

    item.onclick = () => openChat(chat.id);
    chatList.appendChild(item);
  }
}

async function createChat() {
  const model = getValidModel(modelSelect.value);
  try {
    const chat = await (await api("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, title: "New Chat" })
    })).json();

    chats.unshift(chat);
    openChat(chat.id);
    renderChatList();
  } catch (e) {
    showToast("Failed to create chat: " + e.message, true);
  }
}

function openChat(id) {
  currentChat = chats.find(c => c.id === id);
  if (!currentChat) return;

  const validModel = getValidModel(currentChat.model);
  currentChat.model = validModel;
  modelSelect.value = validModel;
  updateModelBadge();

  chatTitle.textContent = currentChat.title || "New Chat";
  $("systemPromptInput").value = currentChat.systemPrompt || "";
  if (typeof currentChat.temperature === "number") {
    $("temperatureInput").value = currentChat.temperature;
    $("tempValue").textContent = currentChat.temperature;
  }

  renderChatList();
  renderMessages();
}

async function deleteChat(id) {
  if (!confirm("Are you sure you want to delete this conversation?")) return;

  try {
    await api(`/api/chats/${id}`, { method: "DELETE" });
    chats = chats.filter(c => c.id !== id);

    if (currentChat?.id === id) {
      if (chats.length > 0) {
        openChat(chats[0].id);
      } else {
        await createChat();
      }
    } else {
      renderChatList();
    }
    showToast("Chat deleted");
  } catch (e) {
    showToast("Failed to delete chat: " + e.message, true);
  }
}

async function clearAllChats() {
  if (!confirm("Delete all conversation history? This action cannot be undone.")) return;

  try {
    await api("/api/chats", { method: "DELETE" });
    chats = [];
    await createChat();
    showToast("All chats cleared");
  } catch (e) {
    showToast("Failed to clear chats: " + e.message, true);
  }
}

async function saveCurrentChat() {
  if (!currentChat) return;

  try {
    const updated = await (await api(`/api/chats/${currentChat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: currentChat.title,
        model: currentChat.model,
        systemPrompt: currentChat.systemPrompt,
        temperature: currentChat.temperature,
        messages: currentChat.messages
      })
    })).json();

    currentChat = updated;
    chats = chats.map(c => c.id === updated.id ? updated : c);
    renderChatList();
  } catch (e) {
    console.error("Save chat error:", e);
  }
}

// Messages Rendering & Formatting
function renderMessages() {
  messagesContainer.innerHTML = "";

  if (!currentChat || !currentChat.messages.length) {
    messagesContainer.appendChild(emptyState);
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  for (const msg of currentChat.messages) {
    appendMessageDOM(msg.role, msg.content, msg.modelUsed || currentChat.model);
  }
  scrollToBottom();
}

function appendMessageDOM(role, content = "", modelName = "") {
  emptyState.style.display = "none";

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "👤" : "🤖";

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "message-content-wrapper";

  const header = document.createElement("div");
  header.className = "message-header";

  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = role === "user" ? "You" : "Local AI";

  header.appendChild(author);

  if (role === "assistant" && modelName) {
    const tag = document.createElement("span");
    tag.className = "message-model-tag";
    const match = models.find(m => m.name === modelName);
    tag.textContent = match ? match.displayName : modelName;
    header.appendChild(tag);
  }

  const body = document.createElement("div");
  body.className = "message-body";
  formatAndInjectContent(body, content);

  contentWrapper.appendChild(header);
  contentWrapper.appendChild(body);

  row.appendChild(avatar);
  row.appendChild(contentWrapper);

  messagesContainer.appendChild(row);
  return body;
}

function formatAndInjectContent(containerEl, rawText) {
  if (window.marked) {
    containerEl.innerHTML = marked.parse(rawText);
  } else {
    containerEl.textContent = rawText;
  }
  enhanceCodeBlocks(containerEl);
}

function enhanceCodeBlocks(containerEl) {
  const preElements = containerEl.querySelectorAll("pre");
  preElements.forEach(pre => {
    if (pre.parentElement.classList.contains("code-block-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const codeEl = pre.querySelector("code");
    let lang = "code";
    if (codeEl) {
      const match = codeEl.className.match(/language-(\w+)/);
      if (match) lang = match[1];
    }

    const header = document.createElement("div");
    header.className = "code-header";

    const langSpan = document.createElement("span");
    langSpan.textContent = lang.toUpperCase();

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-code-btn";
    copyBtn.innerHTML = "📋 Copy code";
    copyBtn.onclick = () => {
      const textToCopy = codeEl ? codeEl.innerText : pre.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.innerHTML = "✓ Copied!";
        setTimeout(() => copyBtn.innerHTML = "📋 Copy code", 2000);
      });
    };

    header.appendChild(langSpan);
    header.appendChild(copyBtn);

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    if (window.hljs && codeEl) {
      hljs.highlightElement(codeEl);
    }
  });
}

function scrollToBottom() {
  if (!userHasScrolledUp) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

messagesContainer.addEventListener("scroll", () => {
  const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 80;
  userHasScrolledUp = !isAtBottom;
});

function makeTitle(text) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > 38 ? cleaned.slice(0, 38) + "..." : cleaned;
}

// Send Message & Stream AI Response
async function sendMessage(text) {
  if (generating || !text.trim() || !currentChat) return;

  const model = getValidModel(modelSelect.value || currentChat.model);
  modelSelect.value = model;
  currentChat.model = model;

  const userMessage = { role: "user", content: text.trim() };
  currentChat.messages.push(userMessage);

  if (currentChat.title === "New Chat") {
    currentChat.title = makeTitle(text);
    chatTitle.textContent = currentChat.title;
  }

  renderMessages();

  // Show processing UI and create assistant bubble
  const assistantBodyEl = appendMessageDOM("assistant", "", model);
  userHasScrolledUp = false;
  scrollToBottom();

  generating = true;
  sendBtn.disabled = true;
  promptInput.disabled = true;
  aiProcessingState.classList.remove("hidden");

  abortController = new AbortController();

  let answerText = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        chatId: currentChat.id,
        model,
        messages: currentChat.messages,
        systemPrompt: currentChat.systemPrompt || "",
        options: {
          temperature: currentChat.temperature || 0.7
        }
      })
    });

    if (!response.ok) {
      let errText = "Ollama chat request failed";
      try {
        const errObj = await response.json();
        errText = errObj.error || errObj.details || errText;
      } catch {
        errText = await response.text();
      }
      throw new Error(errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let residual = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (residual + chunk).split("\n");
      residual = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.error) throw new Error(obj.error);

          if (obj.message?.content) {
            answerText += obj.message.content;
            formatAndInjectContent(assistantBodyEl, answerText);
            scrollToBottom();
          }
        } catch (err) {
          if (err.message && !err.message.includes("JSON")) throw err;
        }
      }
    }

    if (residual.trim()) {
      try {
        const obj = JSON.parse(residual);
        if (obj.message?.content) {
          answerText += obj.message.content;
          formatAndInjectContent(assistantBodyEl, answerText);
          scrollToBottom();
        }
      } catch {}
    }

    currentChat.messages.push({
      role: "assistant",
      content: answerText,
      modelUsed: model
    });
    await saveCurrentChat();

  } catch (e) {
    if (e.name === "AbortError") {
      answerText += "\n\n*(Generation stopped by user)*";
      formatAndInjectContent(assistantBodyEl, answerText);
      currentChat.messages.push({
        role: "assistant",
        content: answerText,
        modelUsed: model
      });
      await saveCurrentChat();
      showToast("Generation stopped");
    } else {
      assistantBodyEl.innerHTML = `<div style="color: var(--accent-rose);">⚠️ Error: ${e.message}</div>`;
      showToast("Error generating response: " + e.message, true);
    }
  } finally {
    generating = false;
    abortController = null;
    sendBtn.disabled = false;
    promptInput.disabled = false;
    aiProcessingState.classList.add("hidden");
    promptInput.focus();
  }
}

function stopGeneration() {
  if (abortController) {
    abortController.abort();
  }
}

// Event Listeners Initialization
function initEventListeners() {
  $("newChatBtn").onclick = createChat;
  $("clearAllBtn").onclick = clearAllChats;
  $("refreshModelsBtn").onclick = async () => {
    await loadModels();
    showToast("Ollama models refreshed");
  };

  modelSelect.onchange = async () => {
    updateModelBadge();
    if (currentChat) {
      currentChat.model = modelSelect.value;
      await saveCurrentChat();
    }
  };

  stopGenBtn.onclick = stopGeneration;

  // Composer Form
  $("composerForm").onsubmit = async (e) => {
    e.preventDefault();
    const text = promptInput.value;
    promptInput.value = "";
    promptInput.style.height = "auto";
    charCounter.textContent = "0 chars";
    await sendMessage(text);
  };

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("composerForm").requestSubmit();
    } else if (e.key === "Escape" && generating) {
      stopGeneration();
    }
  });

  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + "px";
    charCounter.textContent = `${promptInput.value.length} chars`;
  });

  // Chat title inline editing / rename
  $("renameChatBtn").onclick = () => {
    chatTitle.contentEditable = "true";
    chatTitle.focus();
    const range = document.createRange();
    range.selectNodeContents(chatTitle);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  chatTitle.addEventListener("blur", async () => {
    chatTitle.contentEditable = "false";
    const newTitle = chatTitle.textContent.trim() || "New Chat";
    chatTitle.textContent = newTitle;
    if (currentChat && currentChat.title !== newTitle) {
      currentChat.title = newTitle;
      await saveCurrentChat();
    }
  });

  chatTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      chatTitle.blur();
    }
  });

  // Sidebar search input
  chatSearchInput.addEventListener("input", renderChatList);

  // Sidebar toggle
  $("toggleSidebarBtn").onclick = () => sidebar.classList.toggle("collapsed");
  $("closeSidebarBtn").onclick = () => sidebar.classList.add("collapsed");

  // Prompt suggestions cards
  document.querySelectorAll(".suggestion-card").forEach(card => {
    card.onclick = () => {
      const promptText = card.dataset.prompt;
      if (promptText) {
        promptInput.value = promptText;
        promptInput.focus();
        promptInput.dispatchEvent(new Event("input"));
        $("composerForm").requestSubmit();
      }
    };
  });

  // Settings Modal
  const settingsModal = $("settingsModal");
  $("settingsModalBtn").onclick = () => settingsModal.classList.remove("hidden");
  
  $("saveSettingsBtn").onclick = async () => {
    if (currentChat) {
      currentChat.systemPrompt = $("systemPromptInput").value.trim();
      currentChat.temperature = parseFloat($("temperatureInput").value);
      await saveCurrentChat();
    }
    settingsModal.classList.add("hidden");
    showToast("Settings saved for current chat");
  };

  $("temperatureInput").oninput = (e) => {
    $("tempValue").textContent = e.target.value;
  };

  // Help Modal
  const helpModal = $("helpModal");
  $("helpModalBtn").onclick = () => helpModal.classList.remove("hidden");

  // Close modals on close btn or overlay click
  document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.onclick = () => {
      settingsModal.classList.add("hidden");
      helpModal.classList.add("hidden");
    };
  });

  window.onclick = (e) => {
    if (e.target === settingsModal) settingsModal.classList.add("hidden");
    if (e.target === helpModal) helpModal.classList.add("hidden");
  };

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      createChat();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      promptInput.focus();
    }
  });
}

// Initialization Entry Point
(async function init() {
  initEventListeners();
  await loadModels();
  await loadChats();
})();