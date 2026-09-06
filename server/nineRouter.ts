import fs from "fs";
import path from "path";
import axios from "axios";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const CONFIG_FILE = path.join(process.cwd(), "workspace", "9router-config.json");

export interface ModelConfig {
  id: string;
  name: string;
  contextWindow?: number;
  isDefault?: boolean;
  enabled?: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  category: "commercial" | "inexpensive" | "free" | "local";
  description: string;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  models: ModelConfig[];
  status: "active" | "configured" | "unconfigured" | "error";
  latencyMs?: number;
  lastChecked?: string;
}

export interface ComboConfig {
  id: string;
  name: string;
  description: string;
  models: string[]; // e.g. ["anthropic/claude-3-7-sonnet-20250219", "gemini/gemini-2.5-flash", "groq/llama-3.3-70b-versatile"]
  enabled?: boolean;
  isDefault?: boolean;
}

export interface NineRouterState {
  gatewayEnabled: boolean;
  rtkEnabled: boolean;
  activeProviderId: string;
  activeModelId: string;
  activeComboId: string;
  providers: Record<string, ProviderConfig>;
  combos: ComboConfig[];
  stats: {
    totalRequests: number;
    tokensProcessed: number;
    tokensSaved: number;
    fallbacksTriggered: number;
    activeProviderName: string;
  };
}

export const DEFAULT_PROVIDERS: Record<string, ProviderConfig> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    category: "commercial",
    description: "Official Google Gemini models (Gemini 3.7 Flash, 3.8 Flash, 3.5, Pro, etc.)",
    enabled: true,
    status: "configured",
    models: [
      { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", isDefault: true },
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite" },
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
      { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
      { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
      { id: "gemini-pro-latest", name: "Gemini Pro Latest" },
      { id: "gemini-flash-latest", name: "Gemini Flash Latest" },
      { id: "gemini-flash-lite-latest", name: "Gemini Flash-Lite Latest" }
    ]
  }
};

export const DEFAULT_COMBOS: ComboConfig[] = [
  {
    id: "combo-gemini-smart",
    name: "Gemini Smart Auto-Fallback",
    description: "Tier 1: Gemini 3.7 Flash → Tier 2: Gemini 3.8 Flash → Tier 3: Gemini Flash Latest",
    models: [
      "gemini/gemini-3.7-flash",
      "gemini/gemini-3.8-flash",
      "gemini/gemini-flash-latest"
    ],
    isDefault: true
  },
  {
    id: "combo-gemini-reasoning",
    name: "Gemini Deep Reasoning Cascade",
    description: "Tier 1: Gemini 3.1 Pro Preview → Tier 2: Gemini 3.7 Flash → Tier 3: Gemini Pro Latest",
    models: [
      "gemini/gemini-3.1-pro-preview",
      "gemini/gemini-3.7-flash",
      "gemini/gemini-pro-latest"
    ]
  },
  {
    id: "combo-gemini-lite",
    name: "Gemini Ultra-Fast Lite Cascade",
    description: "Tier 1: Gemini 3.5 Flash Lite → Tier 2: Gemini 3.1 Flash Lite → Tier 3: Gemini Flash-Lite Latest",
    models: [
      "gemini/gemini-3.5-flash-lite",
      "gemini/gemini-3.1-flash-lite",
      "gemini/gemini-flash-lite-latest"
    ]
  }
];

class NineRouterEngine {
  private state: NineRouterState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): NineRouterState {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        
        const existingProviders = parsed.providers || {};
        const geminiSaved = existingProviders.gemini || {};
        const savedGeminiKey = geminiSaved.apiKey;
        const geminiModels = (geminiSaved.models && geminiSaved.models.length > 0)
          ? geminiSaved.models
          : DEFAULT_PROVIDERS.gemini.models;

        const mergedProviders: Record<string, ProviderConfig> = {
          ...existingProviders,
          gemini: {
            ...DEFAULT_PROVIDERS.gemini,
            ...geminiSaved,
            models: geminiModels,
            apiKey: savedGeminiKey || undefined,
            status: savedGeminiKey ? "configured" : (process.env.GEMINI_API_KEY ? "configured" : "unconfigured")
          }
        };

        const combos = Array.isArray(parsed.combos) && parsed.combos.length > 0 ? parsed.combos : DEFAULT_COMBOS;

        return {
          gatewayEnabled: parsed.gatewayEnabled ?? true,
          rtkEnabled: parsed.rtkEnabled ?? true,
          activeProviderId: parsed.activeProviderId || "gemini",
          activeModelId: parsed.activeModelId || "gemini-3.7-flash",
          activeComboId: parsed.activeComboId || "",
          providers: mergedProviders,
          combos,
          stats: {
            totalRequests: parsed.stats?.totalRequests || 0,
            tokensProcessed: parsed.stats?.tokensProcessed || 0,
            tokensSaved: parsed.stats?.tokensSaved || 0,
            fallbacksTriggered: parsed.stats?.fallbacksTriggered || 0,
            activeProviderName: parsed.stats?.activeProviderName || "Google Gemini"
          }
        };
      }
    } catch (e: any) {
      console.warn("[9Router] Error loading state, using defaults:", e.message);
    }

    const initial: NineRouterState = {
      gatewayEnabled: true,
      rtkEnabled: true,
      activeProviderId: "gemini",
      activeModelId: "gemini-3.7-flash",
      activeComboId: "",
      providers: DEFAULT_PROVIDERS,
      combos: DEFAULT_COMBOS,
      stats: {
        totalRequests: 0,
        tokensProcessed: 0,
        tokensSaved: 0,
        fallbacksTriggered: 0,
        activeProviderName: "Google Gemini"
      }
    };
    this.saveState(initial);
    return initial;
  }

  private saveState(state?: NineRouterState) {
    try {
      const s = state || this.state;
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(s, null, 2), "utf-8");
    } catch (e: any) {
      console.error("[9Router] Error saving state:", e.message);
    }
  }

  public getState(): NineRouterState {
    return this.state;
  }

  public updateProvider(providerId: string, updates: Partial<ProviderConfig>) {
    if (this.state.providers[providerId]) {
      this.state.providers[providerId] = {
        ...this.state.providers[providerId],
        ...updates
      };
      this.saveState();
    }
    return this.state.providers[providerId];
  }

  public upsertProvider(provider: ProviderConfig) {
    this.state.providers[provider.id] = provider;
    this.saveState();
    return provider;
  }

  public deleteProvider(providerId: string) {
    if (providerId === "gemini") {
      return; // Do not delete primary Gemini provider
    }
    if (this.state.providers[providerId]) {
      delete this.state.providers[providerId];
      if (this.state.activeProviderId === providerId) {
        this.state.activeProviderId = "gemini";
        this.state.activeModelId = "gemini-3.7-flash";
        this.state.stats.activeProviderName = "Google Gemini";
      }
      this.saveState();
    }
  }

  public addModelToProvider(providerId: string, model: { id: string; name: string }) {
    const prov = this.state.providers[providerId];
    if (prov) {
      if (!prov.models.some(m => m.id === model.id)) {
        prov.models.push(model);
        this.saveState();
      }
    }
    return prov;
  }

  public deleteModelFromProvider(providerId: string, modelId: string) {
    const prov = this.state.providers[providerId];
    if (prov) {
      prov.models = prov.models.filter(m => m.id !== modelId);
      this.saveState();
    }
    return prov;
  }

  public toggleGateway(enabled?: boolean): boolean {
    this.state.gatewayEnabled = enabled !== undefined ? enabled : !this.state.gatewayEnabled;
    this.saveState();
    return this.state.gatewayEnabled;
  }

  public toggleRtk(enabled?: boolean): boolean {
    this.state.rtkEnabled = enabled !== undefined ? enabled : !this.state.rtkEnabled;
    this.saveState();
    return this.state.rtkEnabled;
  }

  public toggleProvider(providerId: string, enabled?: boolean) {
    const prov = this.state.providers[providerId];
    if (prov) {
      prov.enabled = enabled !== undefined ? enabled : !prov.enabled;
      this.saveState();
    }
    return prov;
  }

  public toggleModel(providerId: string, modelId: string, enabled?: boolean) {
    const prov = this.state.providers[providerId];
    if (prov) {
      const model = prov.models.find(m => m.id === modelId);
      if (model) {
        model.enabled = enabled !== undefined ? enabled : model.enabled === false ? true : false;
        this.saveState();
      }
    }
    return prov;
  }

  public toggleCombo(comboId: string, enabled?: boolean) {
    const combo = this.state.combos.find(c => c.id === comboId);
    if (combo) {
      combo.enabled = enabled !== undefined ? enabled : combo.enabled === false ? true : false;
      if (combo.enabled === false && this.state.activeComboId === comboId) {
        this.state.activeComboId = "";
      }
      this.saveState();
    }
    return combo;
  }

  public deactivateCombo() {
    this.state.activeComboId = "";
    this.saveState();
    return this.state;
  }

  public setActiveSelection(providerId: string, modelId: string, comboId?: string) {
    this.state.activeProviderId = providerId;
    this.state.activeModelId = modelId;
    this.state.activeComboId = comboId || "";
    const prov = this.state.providers[providerId];
    if (prov) {
      this.state.stats.activeProviderName = prov.name;
    }
    this.saveState();
  }

  public addOrUpdateCombo(combo: ComboConfig) {
    const idx = this.state.combos.findIndex(c => c.id === combo.id);
    if (idx >= 0) {
      this.state.combos[idx] = combo;
    } else {
      this.state.combos.push(combo);
    }
    this.saveState();
  }

  public deleteCombo(comboId: string) {
    this.state.combos = this.state.combos.filter(c => c.id !== comboId);
    if (this.state.activeComboId === comboId) {
      this.state.activeComboId = "";
    }
    this.saveState();
  }

  /**
   * RTK Token Saver: Compress tool output and long prompts by 20-40%
   */
  public compressRtk(text: string): { compressed: string; savedTokens: number; originalChars: number } {
    if (!this.state.rtkEnabled || !text || text.length < 50) {
      return { compressed: text, savedTokens: 0, originalChars: text ? text.length : 0 };
    }

    const origLength = text.length;
    let out = text;

    // 1. Collapse multiple empty lines into a single newline
    out = out.replace(/\n\s*\n\s*\n+/g, "\n\n");

    // 2. Collapse runs of spaces (e.g. indentation) while preserving code readability
    out = out.replace(/ {4,}/g, "  ");

    // 3. Compact large JSON blobs inside outputs
    out = out.replace(/{\s*\n\s*("[^"]+"):\s*/g, '{$1:');

    // 4. Truncate repetitive stack traces or repeated log errors
    const lines = out.split("\n");
    if (lines.length > 200) {
      const head = lines.slice(0, 100);
      const tail = lines.slice(-50);
      const omitted = lines.length - 150;
      out = [...head, `\n... [RTK Saver: ${omitted} repetitive log lines compressed] ...\n`, ...tail].join("\n");
    }

    const newLength = out.length;
    // Approximation: 4 chars ≈ 1 token
    const savedChars = Math.max(0, origLength - newLength);
    const savedTokens = Math.round(savedChars / 4);

    this.state.stats.tokensSaved += savedTokens;
    this.state.stats.tokensProcessed += Math.round(origLength / 4);
    this.saveState();

    return { compressed: out, savedTokens, originalChars: origLength };
  }

  /**
   * Ping a provider to test latency & validity
   */
  public async pingProvider(providerId: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const prov = this.state.providers[providerId];
    if (!prov) return { success: false, latencyMs: 0, error: "Provider not found" };

    const start = Date.now();
    try {
      if (providerId === "gemini") {
        const key = prov.apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("No Gemini API Key set");
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: "ping" }] }]
        });
      } else if (prov.baseUrl) {
        const key = prov.apiKey || (providerId === "openai" ? process.env.OPENAI_API_KEY : process.env.OPENROUTER_API_KEY);
        await axios.get(`${prov.baseUrl}/models`, {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          timeout: 4000
        });
      }
      const latencyMs = Date.now() - start;
      prov.latencyMs = latencyMs;
      prov.status = "active";
      prov.lastChecked = new Date().toISOString();
      this.saveState();
      return { success: true, latencyMs };
    } catch (e: any) {
      const latencyMs = Date.now() - start;
      prov.latencyMs = latencyMs;
      prov.status = "error";
      prov.lastChecked = new Date().toISOString();
      this.saveState();
      return { success: false, latencyMs, error: e.message || "Connection failed" };
    }
  }

  /**
   * 3-Tier Fallback Invocation Engine:
   * Executes prompt or chat completions across a tiered model chain
   */
  public async executeWithFallback(params: {
    messages: { role: string; content: string }[];
    preferredProvider?: string;
    preferredModel?: string;
    comboId?: string;
    system?: string;
    temperature?: number;
  }): Promise<{ text: string; providerUsed: string; modelUsed: string; fallbackOccurred: boolean }> {
    // 1. Check Master AI Gateway Switch
    if (this.state.gatewayEnabled === false) {
      throw new Error("AI Gateway saat ini sedang DINONAKTIFKAN (OFF). Silakan aktifkan kembali AI Gateway di 9Router Manager (ikon ⚡) untuk mulai mengobrol.");
    }

    this.state.stats.totalRequests++;

    let candidates: { providerId: string; modelId: string }[] = [];

    // Check if an explicit combo is selected (or active in state)
    const effectiveComboId = params.comboId !== undefined ? params.comboId : this.state.activeComboId;
    const combo = effectiveComboId ? this.state.combos.find(c => c.id === effectiveComboId) : null;

    if (combo && combo.enabled !== false && combo.models && combo.models.length > 0) {
      candidates = combo.models.map(m => {
        const parts = m.split("/");
        if (parts.length > 1) {
          return { providerId: parts[0], modelId: parts.slice(1).join("/") };
        }
        return { providerId: "gemini", modelId: m };
      });
    } else {
      // Single model mode: prioritizes requested/active provider and model
      const activeP = params.preferredProvider || this.state.activeProviderId || "gemini";
      const activeM = params.preferredModel || this.state.activeModelId || "gemini-3.7-flash";

      candidates = [
        { providerId: activeP, modelId: activeM }
      ];

      // Fallback tiers - ONLY add if Gemini is actually enabled
      const geminiProv = this.state.providers.gemini;
      if (geminiProv && geminiProv.enabled !== false) {
        if (activeP !== "gemini") {
          const m1 = geminiProv.models.find(m => m.id === "gemini-3.7-flash");
          if (m1?.enabled !== false) {
            candidates.push({ providerId: "gemini", modelId: "gemini-3.7-flash" });
          }
        } else {
          if (activeM !== "gemini-3.7-flash") {
            const m1 = geminiProv.models.find(m => m.id === "gemini-3.7-flash");
            if (m1?.enabled !== false) {
              candidates.push({ providerId: "gemini", modelId: "gemini-3.7-flash" });
            }
          }
          if (activeM !== "gemini-pro-latest") {
            const m2 = geminiProv.models.find(m => m.id === "gemini-pro-latest");
            if (m2?.enabled !== false) {
              candidates.push({ providerId: "gemini", modelId: "gemini-pro-latest" });
            }
          }
        }
      }
    }

    // STRICT VALIDATION: Filter out any candidates where provider or model is disabled
    const validCandidates = candidates.filter(cand => {
      const prov = this.state.providers[cand.providerId];
      if (!prov || prov.enabled === false) return false;
      const modelConf = prov.models.find(m => m.id === cand.modelId);
      if (modelConf && modelConf.enabled === false) return false;
      return true;
    });

    if (validCandidates.length === 0) {
      const targetProv = this.state.providers[params.preferredProvider || this.state.activeProviderId || "gemini"];
      const targetProvName = targetProv?.name || params.preferredProvider || "Provider AI";
      throw new Error(`Provider "${targetProvName}" atau model yang dipilih sedang DINONAKTIFKAN. Silakan aktifkan provider/model tersebut di menu 9Router Manager (ikon ⚡) atau pilih model lain.`);
    }

    let primaryError: Error | null = null;
    let lastError: Error | null = null;
    let fallbackCount = 0;

    for (const cand of validCandidates) {
      try {
        console.log(`[9Router Engine] Executing tier candidate: ${cand.providerId}/${cand.modelId}`);
        const result = await this.callProvider(cand.providerId, cand.modelId, params.messages, params.system, params.temperature);
        if (fallbackCount > 0) {
          this.state.stats.fallbacksTriggered++;
          this.saveState();
        }
        return {
          text: result,
          providerUsed: cand.providerId,
          modelUsed: cand.modelId,
          fallbackOccurred: fallbackCount > 0
        };
      } catch (err: any) {
        if (!primaryError) primaryError = err;
        lastError = err;
        fallbackCount++;
        console.warn(`[9Router Fallback] Tier failed on ${cand.providerId}/${cand.modelId}: ${err.message}. Routing to next tier...`);
      }
    }

    const errMessage = primaryError?.message || lastError?.message || "Semua tier model yang aktif tidak merespons.";
    throw new Error(`[9Router Error]: ${errMessage}`);
  }

  private async callProvider(
    providerId: string,
    modelId: string,
    messages: { role: string; content: string }[],
    system?: string,
    temperature = 0.7
  ): Promise<string> {
    const prov = this.state.providers[providerId];
    if (prov && prov.enabled === false) {
      throw new Error(`Provider "${prov.name}" sedang dinonaktifkan.`);
    }
    const modelConf = prov?.models.find(m => m.id === modelId);
    if (modelConf && modelConf.enabled === false) {
      throw new Error(`Model "${modelConf.name || modelId}" pada provider "${prov?.name || providerId}" sedang dinonaktifkan.`);
    }
    
    // Resolve API key priority: Custom configured in 9Router UI -> System Environment Variable
    let apiKey = prov?.apiKey?.trim();
    if (!apiKey) {
      if (providerId === "gemini") apiKey = process.env.GEMINI_API_KEY;
      else if (providerId === "openai") apiKey = process.env.OPENAI_API_KEY;
      else if (providerId === "openrouter") apiKey = process.env.OPENROUTER_API_KEY;
      else if (providerId === "groq") apiKey = process.env.GROQ_API_KEY;
      else if (providerId === "anthropic") apiKey = process.env.ANTHROPIC_API_KEY;
      else if (providerId === "deepseek") apiKey = process.env.DEEPSEEK_API_KEY;
      else if (providerId === "mistral") apiKey = process.env.MISTRAL_API_KEY;
      else if (providerId === "cohere") apiKey = process.env.COHERE_API_KEY;
      else if (providerId === "perplexity") apiKey = process.env.PERPLEXITY_API_KEY;
      else apiKey = process.env[`${providerId.toUpperCase()}_API_KEY`];
    }

    // Compress messages if RTK is enabled
    const processedMessages = messages.map(m => ({
      role: m.role,
      content: this.state.rtkEnabled ? this.compressRtk(m.content).compressed : m.content
    }));

    if (providerId === "gemini") {
      if (!apiKey) throw new Error("Gemini API key is not configured");
      const ai = new GoogleGenAI({ apiKey });
      const contents = processedMessages.map(m => ({
        role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : m.role,
        parts: [{ text: m.content }]
      }));
      const res = await ai.models.generateContent({
        model: modelId || "gemini-3.7-flash",
        contents,
        config: {
          systemInstruction: system,
          temperature
        }
      });
      return res.text || "";
    } else if (providerId === "anthropic") {
      if (!apiKey) throw new Error("API key untuk Anthropic Claude belum dikonfigurasi di 9Router.");
      const anthropic = new Anthropic({ apiKey });
      const claudeMessages = processedMessages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
      const res = await anthropic.messages.create({
        model: modelId || "claude-3-7-sonnet-20250219",
        max_tokens: 4096,
        system: system || undefined,
        messages: claudeMessages,
        temperature
      });
      const firstBlock = res.content[0];
      return firstBlock && "text" in firstBlock ? firstBlock.text : "";
    } else {
      // Standard OpenAI-compatible format (OpenRouter, OpenAI, Groq, DeepSeek, Ollama, etc.)
      if (!apiKey && providerId !== "ollama" && providerId !== "opencode_free") {
        throw new Error(`API key untuk ${prov?.name || providerId} belum diisi. Silakan masukkan API key di 9Router Manager (ikon ⚡).`);
      }

      const client = new OpenAI({
        apiKey: apiKey || "dummy-key",
        baseURL: prov?.baseUrl || (providerId === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1")
      });

      const openaiMessages: any[] = [];
      if (system) {
        openaiMessages.push({ role: "system", content: system });
      }
      openaiMessages.push(...processedMessages);

      const completion = await client.chat.completions.create({
        model: modelId,
        messages: openaiMessages,
        temperature
      });

      return completion.choices[0]?.message?.content || "";
    }
  }
}

export const nineRouter = new NineRouterEngine();
