import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { nineRouter } from "./server/nineRouter";

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// Ensure workspace and memory directories exist
const WORKSPACE_DIR = path.join(process.cwd(), "workspace");
const SKILLS_DIR = path.join(process.cwd(), "hermes-skills");
const TODO_FILE = path.join(process.cwd(), "workspace", "todo.json");
const CRON_FILE = path.join(process.cwd(), "workspace", "cronjobs.json");
const MEMORY_FILE = path.join(process.cwd(), "memory.json");
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}
if (!fs.existsSync(SKILLS_DIR)) {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
}
if (!fs.existsSync(TODO_FILE)) {
  fs.writeFileSync(TODO_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(CRON_FILE)) {
  fs.writeFileSync(CRON_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(MEMORY_FILE)) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify({ facts: [], preferences: {} }, null, 2));
}

// Background scheduler for Hermes-grade Cron jobs
setInterval(async () => {
  try {
    if (!fs.existsSync(CRON_FILE)) return;
    const raw = await fsPromises.readFile(CRON_FILE, "utf-8");
    const jobs = JSON.parse(raw);
    const now = Date.now();
    let updated = false;
    for (const job of jobs) {
      if (job.status !== "active") continue;
      const intervalMs = (job.intervalMinutes || 60) * 60 * 1000;
      if (!job.lastRunAt || (now - new Date(job.lastRunAt).getTime() >= intervalMs)) {
        job.lastRunAt = new Date().toISOString();
        job.runCount = (job.runCount || 0) + 1;
        updated = true;
        console.log(`[Violet AI Cron Engine] Executing scheduled job #${job.id}: ${job.title} -> ${job.task}`);
      }
    }
    if (updated) {
      await fsPromises.writeFile(CRON_FILE, JSON.stringify(jobs, null, 2));
    }
  } catch (err: any) {
    console.warn("[Violet AI Cron Engine] Background error:", err.message);
  }
}, 30000);

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Hermes Skills List endpoint
  app.get("/api/skills", async (req, res) => {
    try {
      const skills: { category: string; name: string; path: string; description: string }[] = [];
      if (fs.existsSync(SKILLS_DIR)) {
        async function scanDir(dir: string, category = "") {
          const entries = await fsPromises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const skillFile = path.join(fullPath, "SKILL.md");
              if (fs.existsSync(skillFile)) {
                let desc = "Procedural skill documentation";
                try {
                  const content = await fsPromises.readFile(skillFile, "utf-8");
                  const descMatch = content.match(/description:\s*([^\n\r]+)/i);
                  if (descMatch) desc = descMatch[1].trim().replace(/^['"]|['"]$/g, '');
                } catch {}
                skills.push({
                  category: category || "general",
                  name: entry.name,
                  path: path.relative(SKILLS_DIR, skillFile),
                  description: desc
                });
              } else {
                await scanDir(fullPath, category ? `${category}/${entry.name}` : entry.name);
              }
            }
          }
        }
        await scanDir(SKILLS_DIR);
      }
      res.json({ skills, total: skills.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Hermes Todos endpoint
  app.get("/api/todos", async (req, res) => {
    try {
      if (!fs.existsSync(TODO_FILE)) return res.json({ todos: [] });
      const raw = await fsPromises.readFile(TODO_FILE, "utf-8");
      res.json({ todos: JSON.parse(raw) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Hermes Cronjobs endpoint
  app.get("/api/cronjobs", async (req, res) => {
    try {
      if (!fs.existsSync(CRON_FILE)) return res.json({ cronjobs: [] });
      const raw = await fsPromises.readFile(CRON_FILE, "utf-8");
      res.json({ cronjobs: JSON.parse(raw) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // List all files in workspace
  app.get("/api/workspace/files", async (req, res) => {
    try {
      const fileNames = await fsPromises.readdir(WORKSPACE_DIR);
      const fileList = await Promise.all(
        fileNames.map(async (name) => {
          const stats = await fsPromises.stat(path.join(WORKSPACE_DIR, name));
          return {
            name,
            size: stats.size,
            updatedAt: stats.mtime
          };
        })
      );
      res.json({ files: fileList });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Download a file from workspace
  app.get("/api/workspace/files/:filename", async (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(WORKSPACE_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      res.download(filePath, filename);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete a file from workspace
  app.delete("/api/workspace/files/:filename", async (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(WORKSPACE_DIR, filename);
      if (fs.existsSync(filePath)) {
        await fsPromises.unlink(filePath);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 9Router AI Gateway & Token Saver API Endpoints
  app.get("/api/9router/state", (req, res) => {
    res.json(nineRouter.getState());
  });

  app.post("/api/9router/rtk/toggle", (req, res) => {
    const { enabled } = req.body;
    const rtk = nineRouter.toggleRtk(enabled);
    res.json({ rtkEnabled: rtk });
  });

  app.post("/api/9router/gateway/toggle", (req, res) => {
    const { enabled } = req.body;
    const gway = nineRouter.toggleGateway(enabled);
    res.json({ gatewayEnabled: gway });
  });

  app.post("/api/9router/ping", async (req, res) => {
    const { providerId } = req.body;
    const result = await nineRouter.pingProvider(providerId);
    res.json(result);
  });

  app.post("/api/9router/provider", (req, res) => {
    const { providerId, apiKey, baseUrl, enabled } = req.body;
    const updated = nineRouter.updateProvider(providerId, { apiKey, baseUrl, enabled, status: apiKey ? 'configured' : 'unconfigured' });
    res.json(updated);
  });

  app.post("/api/9router/provider/custom", (req, res) => {
    const { id, name, category, description, baseUrl, apiKey, enabled, models } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: "Provider ID and name are required" });
    }
    const provider = {
      id,
      name,
      category: category || "commercial",
      description: description || "Custom user-added AI provider",
      baseUrl,
      apiKey,
      enabled: enabled ?? true,
      status: (apiKey ? "configured" : "unconfigured") as "active" | "configured" | "unconfigured" | "error",
      models: models || [{ id: `${id}-default`, name: `${name} Default Model`, isDefault: true }]
    };
    const updated = nineRouter.upsertProvider(provider);
    res.json(updated);
  });

  app.delete("/api/9router/provider/:id", (req, res) => {
    const providerId = req.params.id;
    nineRouter.deleteProvider(providerId);
    res.json({ success: true });
  });

  app.post("/api/9router/provider/:id/model", (req, res) => {
    const providerId = req.params.id;
    const { id, name } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: "Model ID and name are required" });
    }
    const updated = nineRouter.addModelToProvider(providerId, { id, name });
    res.json(updated);
  });

  app.delete("/api/9router/provider/:id/model/:modelId", (req, res) => {
    const providerId = req.params.id;
    const modelId = req.params.modelId;
    const updated = nineRouter.deleteModelFromProvider(providerId, modelId);
    res.json(updated);
  });

  app.post("/api/9router/active", (req, res) => {
    const { providerId, modelId, comboId } = req.body;
    nineRouter.setActiveSelection(providerId, modelId, comboId);
    res.json({ success: true, activeProviderId: providerId, activeModelId: modelId, activeComboId: comboId });
  });

  app.post("/api/9router/combo", (req, res) => {
    const { id, name, description, models } = req.body;
    if (!id || !name || !models || !Array.isArray(models)) {
      return res.status(400).json({ error: "Invalid combo parameters" });
    }
    nineRouter.addOrUpdateCombo({ id, name, description, models });
    res.json(nineRouter.getState());
  });

  app.post("/api/9router/provider/:id/toggle", (req, res) => {
    const providerId = req.params.id;
    const { enabled } = req.body;
    const updated = nineRouter.toggleProvider(providerId, enabled);
    res.json(updated);
  });

  app.post("/api/9router/provider/:id/model/:modelId/toggle", (req, res) => {
    const providerId = req.params.id;
    const modelId = req.params.modelId;
    const { enabled } = req.body;
    const updated = nineRouter.toggleModel(providerId, modelId, enabled);
    res.json(updated);
  });

  app.post("/api/9router/combo/:id/toggle", (req, res) => {
    const comboId = req.params.id;
    const { enabled } = req.body;
    const updated = nineRouter.toggleCombo(comboId, enabled);
    res.json(updated);
  });

  app.post("/api/9router/combo/deactivate", (req, res) => {
    const updated = nineRouter.deactivateCombo();
    res.json(updated);
  });

  app.delete("/api/9router/combo/:id", (req, res) => {
    const comboId = req.params.id;
    nineRouter.deleteCombo(comboId);
    res.json(nineRouter.getState());
  });

  // Universal OpenAI-compatible Gateway API for IDEs and CLI tools (Cursor, Claude Code, Cline, etc.)
  app.post("/v1/chat/completions", async (req, res) => {
    try {
      const { messages, model, temperature, stream } = req.body;
      const result = await nineRouter.executeWithFallback({
        messages: messages || [],
        preferredModel: model,
        temperature: temperature ?? 0.7
      });

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const chunk = {
          id: "chatcmpl-" + Date.now(),
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: model || result.modelUsed,
          choices: [{ index: 0, delta: { content: result.text }, finish_reason: "stop" }]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      res.json({
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model || result.modelUsed,
        choices: [{
          index: 0,
          message: { role: "assistant", content: result.text },
          finish_reason: "stop"
        }],
        usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 }
      });
    } catch (e: any) {
      console.error("[9Router Gateway Error]:", e);
      res.status(500).json({ error: { message: e.message || "Gateway error", type: "server_error" } });
    }
  });

  app.get("/v1/models", (req, res) => {
    const state = nineRouter.getState();
    const modelsList: any[] = [];
    Object.values(state.providers).forEach(p => {
      p.models.forEach(m => {
        modelsList.push({
          id: `${p.id}/${m.id}`,
          object: "model",
          owned_by: p.name
        });
        modelsList.push({
          id: m.id,
          object: "model",
          owned_by: p.name
        });
      });
    });
    state.combos.forEach(c => {
      modelsList.push({
        id: `combo/${c.id}`,
        object: "model",
        owned_by: "9Router Combo"
      });
    });
    res.json({ object: "list", data: modelsList });
  });

  // Live Web Search Engine (Detik, Kompas, Google-indexed sites, news, & Wikipedia fallback)
  async function searchWebLive(query: string): Promise<string> {
    try {
      const html = await new Promise<string>((resolve, reject) => {
        execFile("curl", [
          "-s",
          "--max-time", "6",
          "-d", `q=${query}`,
          "https://html.duckduckgo.com/html/",
          "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        ], (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout || "");
        });
      });

      if (html) {
        const blocks = html.match(/<div class="result results_links[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g) || [];
        if (blocks.length > 0) {
          const results: string[] = [];
          for (let i = 0; i < Math.min(5, blocks.length); i++) {
            const block = blocks[i];
            const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
            const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
            if (titleMatch) {
              const rawHref = titleMatch[1];
              let realUrl = rawHref;
              const uddgMatch = rawHref.match(/uddg=([^&]+)/);
              if (uddgMatch) {
                realUrl = decodeURIComponent(uddgMatch[1]);
              }
              const title = titleMatch[2].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim();
              const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim() : '';
              results.push(`[${i + 1}] ${title}\nLink: ${realUrl}\nRingkasan: ${snippet}\n`);
            }
          }
          if (results.length > 0) {
            return results.join('\n');
          }
        }
      }
    } catch (err: any) {
      console.warn("[Live Web Search] Error:", err.message);
    }

    // Fallback to Indonesian & English Wikipedia
    try {
      const idUrl = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
      const resId = await fetch(idUrl, { headers: { "User-Agent": "VioletAI/1.0" } });
      let results: any[] = [];
      if (resId.ok) {
        const dataId = await resId.json();
        results = dataId.query?.search || [];
      }
      if (results.length === 0) {
        const enUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const resEn = await fetch(enUrl, { headers: { "User-Agent": "VioletAI/1.0" } });
        if (resEn.ok) {
          const dataEn = await resEn.json();
          results = dataEn.query?.search || [];
        }
      }
      if (results.length > 0) {
        const lines = results.slice(0, 5).map((item: any, index: number) => {
          const cleanSnippet = item.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"');
          const link = `https://id.wikipedia.org/wiki/${encodeURIComponent(item.title)}`;
          return `[${index + 1}] ${item.title}\nLink: ${link}\nRingkasan: ${cleanSnippet}\n`;
        });
        return lines.join('\n');
      }
    } catch (e: any) {
      console.warn("[Wikipedia Search Fallback] Error:", e.message);
    }

    return "Tidak ada artikel atau berita langsung yang cocok dengan kata kunci tersebut.";
  }


  app.post("/api/run-shell", (req, res) => {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: "No command provided" });
    }
    
    import("child_process").then(({ exec }) => {
    exec(command, { timeout: 15000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      res.json({
        stdout: stdout || "",
        stderr: stderr || "",
        error: error ? error.message : null
      });
    });
  }).catch(err => res.status(500).json({error: err.message}));
  });

  app.post("/api/chat"
, async (req, res) => {
    try {
      const { command, history, provider, model, customApiKey, systemInstruction, imageAttachment } = req.body;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const routerState = nineRouter.getState();
      
      // If customApiKey was provided in request, update the active or target provider
      if (customApiKey && typeof customApiKey === 'string' && customApiKey.trim()) {
        const targetKeyProvider = provider || routerState.activeProviderId || 'gemini';
        if (routerState.providers[targetKeyProvider]) {
          nineRouter.updateProvider(targetKeyProvider, { apiKey: customApiKey.trim() });
        }
      }

      const messagesForRouter = [
        ...(history || []).map((m: any) => ({
          role: m.role,
          content: m.text
        })),
        { role: 'user', content: command }
      ];

      const targetProvider = provider || routerState.activeProviderId || 'gemini';
      const targetModel = model || routerState.activeModelId || 'gemini-3.7-flash';

      const result = await nineRouter.executeWithFallback({
        messages: messagesForRouter,
        preferredProvider: targetProvider,
        preferredModel: targetModel,
        comboId: routerState.activeComboId || undefined,
        system: systemInstruction,
        temperature: 0.7
      });

      // Stream SSE result format expected by readSSEStream
      res.write(`data: ${JSON.stringify({
        type: "result",
        text: result.text,
        activeModel: `${result.providerUsed}/${result.modelUsed}`,
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed,
        fallbackOccurred: result.fallbackOccurred
      })}\n\n`);

      // Legacy fallback format
      res.write(`data: ${JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: result.text }]
          }
        }]
      })}\n\n`);

      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (e: any) {
      console.error("[Chat Error]:", e);
      res.write(`data: ${JSON.stringify({ type: "error", error: e.message || "Terjadi kesalahan pada server AI." })}\n\n`);
      return res.end();
    }
  });



  app.post("/api/test-connection", async (req, res) => {
    try {
      const { model, apiKey: customApiKey } = req.body;
      const cleanCustomKey = typeof customApiKey === 'string' ? customApiKey.trim().replace(/^["']|["']$/g, '') : '';
      const apiKeyToUse = cleanCustomKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        return res.status(400).json({ success: false, error: "API Key belum dimasukkan. Silakan isi di kolom API Key." });
      }
      
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
      const targetModel = model || "gemini-pro-latest";
      const candidates = [
        targetModel,
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-pro-latest"
      ];
      const uniqueModels = Array.from(new Set(candidates)).filter(m => m !== "gemini-1.5-flash");
      
      let activeModel = null;
      let success = false;
      let lastErrorMsg = "";

      for (const currentModel of uniqueModels) {
         try {
            await ai.models.generateContent({
                model: currentModel,
                contents: "Ping"
            });
            activeModel = currentModel;
            success = true;
            break;
         } catch (err: any) {
            lastErrorMsg = err.message || "Unknown error";
            const errMsg = lastErrorMsg;
            const isUnauth = errMsg.includes("401") || errMsg.includes("UNAUTHENTICATED") || String(err.status || "").includes("401");
            if (isUnauth) {
                return res.status(401).json({ success: false, error: "API Key tidak valid atau kadaluarsa." });
            }
         }
      }

      if (success) {
          res.json({ success: true, activeModel });
      } else {
          res.status(500).json({ success: false, error: `Semua model cadangan gagal. Info: ${lastErrorMsg}` });
      }
    } catch (error: any) {
      console.error("Test Connection Error:", error);
      res.status(500).json({ success: false, error: error.message || "Gagal menguji koneksi." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
