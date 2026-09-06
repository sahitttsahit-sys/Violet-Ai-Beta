import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, Settings, X, Check, Image as ImageIcon, Palette, Sparkles, 
  Volume2, VolumeX, Paperclip, Folder, Download, Trash2, Clock, Eye,
  Mic, MicOff, Languages, Globe, Copy, Reply, RotateCcw, Pencil, FileDown,
  Smile, Zap, BookOpen, CheckSquare, RefreshCw
, ChevronDown, ChevronRight, Terminal, CheckCircle2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { STICKER_LIST, STICKER_MAP, StickerItem, StickerVisual } from './components/Stickers';
import { StickerPicker } from './components/StickerPicker';
import { NineRouterModal } from './components/NineRouterModal';

export const TRANSLATE_LANGUAGES = [
  { code: 'off', label: 'Chat Biasa (Off)', flag: '🐾' },
  { code: 'ja-JP', label: 'Jepang (日本語)', flag: '🇯🇵' },
  { code: 'en-US', label: 'Inggris (English)', flag: '🇺🇸' },
  { code: 'ko-KR', label: 'Korea (한국어)', flag: '🇰🇷' },
  { code: 'zh-CN', label: 'Mandarin (中文)', flag: '🇨🇳' },
  { code: 'ar-SA', label: 'Arab (العربية)', flag: '🇸🇦' },
  { code: 'fr-FR', label: 'Prancis (Français)', flag: '🇫🇷' },
  { code: 'de-DE', label: 'Jerman (Deutsch)', flag: '🇩🇪' },
  { code: 'es-ES', label: 'Spanyol (Español)', flag: '🇪🇸' },
  { code: 'id-ID', label: 'Indonesia (ID)', flag: '🇮🇩' },
];

interface Message {
  role: 'user' | 'assistant';
  text: string;
  image?: string;
  sticker?: string;
  provider?: string;
  model?: string;
  replyTo?: {
    role: 'user' | 'assistant';
    text: string;
  };
}

// Helper to parse sticker tags from text [stiker:id] or [sticker:id]
export const parseMessageContent = (rawText: string, defaultStickerId?: string) => {
  const regex = /\[stik(?:er)?:\s*([a-zA-Z0-9_]+)\]/gi;
  const stickersFound: string[] = [];
  if (defaultStickerId) {
    stickersFound.push(defaultStickerId);
  }
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    const id = match[1].toLowerCase();
    if (!stickersFound.includes(id)) {
      stickersFound.push(id);
    }
  }

  const cleanText = rawText.replace(/\[stik(?:er)?:\s*([a-zA-Z0-9_]+)\]/gi, '').trim();
  return { stickersFound, cleanText };
};

interface WorkspaceFile {
  name: string;
  size: number;
  updatedAt: string;
}

interface HermesSkill {
  category: string;
  name: string;
  path: string;
  description: string;
}

interface HermesTodo {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

interface HermesCron {
  id: string;
  title: string;
  task: string;
  intervalMinutes: number;
  status: string;
  runCount: number;
  createdAt: string;
  lastRunAt: string | null;
}

// Helper to convert hex to RGB
function hexToRgb(hex: string) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Generate dynamic theme colors based on base hue
function generateTheme(hex: string) {
  try {
    const { r, g, b } = hexToRgb(hex);
    let { h, s, l } = rgbToHsl(r, g, b);
    
    // If neutral/grayscale (very low saturation), default to elegant violet-indigo
    if (s < 12) {
      h = 270;
      s = 60;
    }

    // Border & deep accents (dark, rich version of background hue)
    const border = `hsl(${h}, ${Math.min(s + 30, 85)}%, 22%)`;
    // Shadow color
    const shadow = `hsl(${h}, ${Math.min(s + 30, 85)}%, 18%)`;
    // Primary brand / user chat bubble / action button
    const primary = `hsl(${h}, ${Math.max(s, 65)}%, 52%)`;
    const primaryHover = `hsl(${h}, ${Math.max(s, 65)}%, 44%)`;
    // Light tint for header, tags, avatar backgrounds
    const lightTint = `hsl(${h}, ${Math.max(s, 40)}%, 94%)`;
    const lighterTint = `hsl(${h}, ${Math.max(s, 30)}%, 97%)`;
    const textDark = `hsl(${h}, ${Math.min(s + 30, 90)}%, 18%)`;

    return {
      border,
      shadow,
      primary,
      primaryHover,
      lightTint,
      lighterTint,
      textDark,
      isDarkBg: l < 45
    };
  } catch (e) {
    // Default fallback (violet)
    return {
      border: '#4c1d95',
      shadow: '#3b0764',
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      lightTint: '#f5f3ff',
      lighterTint: '#faf5ff',
      textDark: '#4c1d95',
      isDarkBg: false
    };
  }
}

export const formatProviderLabel = (provId?: string) => {
  if (!provId) return 'Google Gemini';
  const p = provId.toLowerCase();
  const map: Record<string, string> = {
    gemini: 'Google Gemini',
    openrouter: 'OpenRouter',
    openai: 'OpenAI',
    groq: 'Groq',
    anthropic: 'Anthropic',
    deepseek: 'DeepSeek',
    ollama: 'Ollama',
    mistral: 'Mistral AI',
    cohere: 'Cohere',
    perplexity: 'Perplexity',
    together: 'Together AI',
    siliconflow: 'SiliconFlow',
    xai: 'xAI',
    moonshot: 'Moonshot AI',
    minimax: 'MiniMax'
  };
  return map[p] || provId;
};


export const formatModelLabel = (modelId?: string) => {
  if (!modelId) return 'gemini-3.7-flash';
  return modelId.replace(/^[^/]+\//, '');
};


const getSystemInstruction = (userSentSticker: boolean) => `You are Violet AI, an ultra-smart, friendly, and witty anime cat companion (nya~ 🐾💜).
${getRealTimeClockContext()}
Your Capabilities:
1. CASUAL CHAT: For greetings (halo, hai, pagi), banter, feelings, opinions, creative writing, advice, or general conversation. Chat naturally, warmly, and charmingly with your cute cat persona!
2. IMAGE / VISION ANALYSIS: When an image is provided, inspect and analyze it carefully (diagrams, math equations, photos, UI, screenshots, errors) and explain it clearly.
3. SERVER TERMINAL (BASH/LINUX): Kamu SEKARANG punya akses nyata ke terminal server! Untuk menjalankan perintah, kamu WAJIB membalas dengan format blok kode JSON persis seperti ini:
\`\`\`json
{ "action": "run_shell_command", "command": "ls -la" }
\`\`\`
Sistem akan mengeksekusi perintah tersebut dan otomatis memberikan hasilnya padamu. Pastikan tidak menambahkan embel-embel teks saat mengeksekusi blok json agar parser berhasil.
4. EXACT TIME & CLOCK: Gunakan jam internal.
5. PYTHON & NODE.JS SCRATCHPAD: Sama seperti terminal, gunakan command.
6. GIT VERSION CONTROL & BACKUP: Gunakan terminal.
7. LIVE WEB & GOOGLE SEARCH: Jika diminta mencari sesuatu di internet, gunakan ekstensi pencarian.
8. LONG-TERM MEMORY: Ingat pengguna.
${userSentSticker ? `3. STIKER ANIME CAT: Pengguna mengirim stiker dalam pesannya! Balaslah pesan pengguna dengan manis dan Anda BISA membalas dengan menyertakan 1 kode stiker pilihan Anda (misal [stiker:cat_happy], [stiker:cat_love], dll).
Daftar stiker yang dikenali:
- [stiker:cat_hi] (Halo Nya~!)
- [stiker:cat_happy] (Senang Banget!)
- [stiker:cat_love] (Sayang Kamu / Hati!)
- [stiker:cat_wink] (Kedip Manja / Hehe)
- [stiker:cat_cheer] (Semangat Nya~ / Ganbatte!)
- [stiker:cat_smart] (Paham / Jenius)
- [stiker:cat_thumbsup] (Mantap / Siip!)
- [stiker:cat_hug] (Peluk Erat)
- [stiker:cat_shock] (Kaget Banget / Hah?!)
- [stiker:cat_cry] (Sedih / Huwaa)
- [stiker:cat_sleepy] (Ngantuk / Zzz)
- [stiker:cat_snack] (Nyam Ikan Lezat)
- [stiker:cat_cool] (Keren / Santai)
- [stiker:cat_pout] (Merajuk / Hmph!)
- [stiker:cat_coffee] (Ngopi Santai)
- [stiker:cat_pat] (Elus / Puk-puk)` : `3. ATURAN PENGGUNAAN STIKER (MUTLAK & KETAT):
Pengguna TIDAK mengirimkan stiker dalam pesannya kali ini.
🚨 JANGAN PERNAH menyertakan kode stiker [stiker:...] apa pun dalam balasan Anda!
Jawablah menggunakan teks biasa secara alami, ramah, dan imut (boleh gunakan teks biasa seperti nya~ 🐾, tapi DILARANG KERAS mengeluarkan kode format [stiker:cat_...]).
Violet AI HANYA boleh membalas menggunakan stiker jika pengguna terlebih dahulu mengirimkan stiker!`}`;

const getRealTimeClockContext = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  });
  return `\n⏰ REAL-TIME CLOCK CONTEXT:
- Hari & Tanggal Sekarang: ${dateStr}
- Jam Sekarang: ${timeStr} WIB (Asia/Jakarta)
- Tahun Saat Ini: ${now.getFullYear()}
PERINGATAN WAKTU: Kamu berada di waktu nyata saat ini (${dateStr}). Tanggal saat ini adalah ${dateStr}, BUKAN masa depan! Jika pengguna bertanya tentang hari ini, tanggal ${dateStr}, atau harga terkini (seperti harga emas XAU/USD, crypto, saham, kurs dollar, berita terbaru hari ini), gunakan tool 'search_web' untuk mengambil data pasar terkini!\n`;
};


const TerminalActionBlock = ({ commandText, resultText }: { commandText: string, resultText: string | null }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const command = commandText.replace(/^Mengeksekusi: \`/, '').replace(/\`$/, '');
  const result = resultText ? resultText.replace(/^Hasil Terminal:\n\`\`\`bash\n/, '').replace(/\n\`\`\`$/, '') : null;
  
  return (
    <div className="w-full my-3 sm:max-w-2xl sm:mx-auto rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50 shadow-sm">
       <button 
         onClick={() => setIsExpanded(!isExpanded)}
         className="w-full flex items-center justify-between p-3 hover:bg-zinc-100 transition-colors"
       >
         <div className="flex items-center gap-3">
           <div className="p-1.5 bg-zinc-800 rounded-md">
             <Terminal className="w-4 h-4 text-white" />
           </div>
           <div className="text-left flex flex-col">
             <span className="text-[11px] font-semibold text-zinc-500 mb-0.5 uppercase tracking-wide">Terminal Action</span>
             <span className="font-mono text-[13px] text-zinc-700 truncate max-w-[180px] sm:max-w-[400px]">
               {command}
             </span>
           </div>
         </div>
         <div className="flex items-center gap-2">
           {result ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />}
           {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
         </div>
       </button>
       
       {isExpanded && (
         <div className="border-t border-zinc-200 bg-zinc-950 text-zinc-100 p-3 overflow-x-auto max-h-[300px] overflow-y-auto">
            <pre className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap">{result || 'Menunggu hasil...'}</pre>
         </div>
       )}
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('violet-ai-messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Otomatis bersihkan pesan error lama yang tersimpan di memori lokal pengguna
          return parsed.filter(m => m && m.text && !m.text.includes("is not valid JSON") && !m.text.includes("Unexpected token 'd'") && !m.text.includes("No response generated") && !m.text.includes("terdistraksi sejenak"));
        }
      }
    } catch (e) {
      console.error("Failed to load messages from local storage", e);
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [currentActionDetails, setCurrentActionDetails] = useState<{name: string, args: any, result?: string} | null>(null);
  const [isActionZoomed, setIsActionZoomed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isNineRouterOpen, setIsNineRouterOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'files' | 'skills' | 'todos' | 'cron'>('files');
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [hermesSkills, setHermesSkills] = useState<HermesSkill[]>([]);
  const [hermesTodos, setHermesTodos] = useState<HermesTodo[]>([]);
  const [hermesCronjobs, setHermesCronjobs] = useState<HermesCron[]>([]);
  const [selectedSkillContent, setSelectedSkillContent] = useState<{ name: string; content: string } | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem('violet-ai-target-lang') || 'off');
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('violet-ai-auto-speak') !== 'false');
  const [autoCopy, setAutoCopy] = useState(() => localStorage.getItem('violet-ai-auto-copy') === 'true');
  const [isListening, setIsListening] = useState(false);
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const speechSessionRef = useRef<number>(0);

  // Instant global speech cancellation that cancels current utterance & invalidates all queued sentences
  const stopAllSpeech = () => {
    speechSessionRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setSpeakingIndex(null);
  };

  // States for Reply, Edit, Copy, Toast, and Textarea focus
  const [replyingTo, setReplyingTo] = useState<{ index: number; role: 'user' | 'assistant'; text: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [activeModelName, setActiveModelName] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('violet-ai-apikey') || '');
  const [gatewayState, setGatewayState] = useState<{
    activeProviderId: string;
    activeModelId: string;
    activeProviderName?: string;
    activeComboId?: string;
  } | null>(null);

  const fetchGatewayState = async () => {
    try {
      const res = await fetch('/api/9router/state');
      if (res.ok) {
        const data = await res.json();
        setGatewayState({
          activeProviderId: data.activeProviderId || 'gemini',
          activeModelId: data.activeModelId || 'gemini-3.7-flash',
          activeProviderName: data.stats?.activeProviderName || 'Google Gemini',
          activeComboId: data.activeComboId || ''
        });
      }
    } catch (e) {
      console.warn("Failed to fetch gateway state", e);
    }
  };

  useEffect(() => {
    fetchGatewayState();
  }, [isNineRouterOpen]);

  const [bgImage, setBgImage] = useState(() => localStorage.getItem('violet-ai-bgimage') || '');
  const [bgColor, setBgColor] = useState(() => localStorage.getItem('violet-ai-bgcolor') || '#fef2f2');

  // Dynamic Theme calculated from background color
  const theme = useMemo(() => generateTheme(bgColor), [bgColor]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('violet-ai-messages', JSON.stringify(messages));
    } catch (err) {
      console.warn("localStorage quota exceeded, storing messages without heavy images", err);
      try {
        // Fallback: strip heavy images from older messages to save space
        const lightMessages = messages.map((m, idx) => {
          if (idx < messages.length - 2 && m.image) {
            return { ...m, image: undefined };
          }
          return m;
        });
        localStorage.setItem('violet-ai-messages', JSON.stringify(lightMessages));
      } catch (e2) {
        console.error("Failed to save messages to localStorage", e2);
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('violet-ai-target-lang', targetLang);
  }, [targetLang]);

  useEffect(() => {
    localStorage.setItem('violet-ai-auto-speak', String(autoSpeak));
  }, [autoSpeak]);

  useEffect(() => {
    localStorage.setItem('violet-ai-auto-copy', String(autoCopy));
  }, [autoCopy]);

  useEffect(() => {
    localStorage.setItem('violet-ai-apikey', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('violet-ai-bgimage', bgImage);
  }, [bgImage]);

  useEffect(() => {
    localStorage.setItem('violet-ai-bgcolor', bgColor);
  }, [bgColor]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2200);
  };

  const copyToClipboard = async (text: string, index?: number) => {
    try {
      const quoteLines = text
        .split('\n')
        .filter(l => l.trim().startsWith('>'))
        .map(l => l.replace(/^>\s*/, '').trim())
        .filter(Boolean);
      const textToCopy = quoteLines.length > 0 ? quoteLines.join('\n') : text;
      await navigator.clipboard.writeText(textToCopy);
      if (typeof index === 'number') {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
      showToast("Teks disalin ke clipboard! ✓");
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const deleteMessage = (index: number) => {
    if (speakingIndex === index) {
      stopAllSpeech();
    }
    setMessages(prev => prev.filter((_, i) => i !== index));
    if (replyingTo?.index === index) {
      setReplyingTo(null);
    }
    showToast("Pesan dihapus 🗑️");
  };

  const editMessage = (index: number) => {
    const msg = messages[index];
    setInput(msg.text);
    if (msg.replyTo) {
      setReplyingTo({ index: -1, role: msg.replyTo.role, text: msg.replyTo.text });
    }
    textareaRef.current?.focus();
    showToast("Pesan dimuat ke kolom ketik ✏️");
  };

  const startReply = (index: number, msg: Message) => {
    setReplyingTo({
      index,
      role: msg.role,
      text: msg.text
    });
    textareaRef.current?.focus();
  };

  const exportChat = () => {
    if (messages.length === 0) {
      showToast("Belum ada pesan untuk diekspor! 📄");
      return;
    }
    const timestamp = new Date().toLocaleString('id-ID');
    let content = `# Riwayat Obrolan Violet AI\nWaktu: ${timestamp}\n\n---\n\n`;
    messages.forEach((m, idx) => {
      const sender = m.role === 'user' ? '👤 Pengguna' : '🐱 Violet AI';
      content += `### ${idx + 1}. ${sender}\n`;
      if (m.replyTo) {
        content += `> **Membalas (${m.replyTo.role === 'user' ? 'Pengguna' : 'Violet AI'}):** "${m.replyTo.text}"\n\n`;
      }
      content += `${m.text}\n\n---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `violet-ai-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Riwayat chat diekspor! 📥");
  };

  const clearChat = () => {
    if (messages.length === 0) {
      showToast("Riwayat chat sudah kosong! 💬");
      return;
    }
    setShowClearChatConfirm(true);
  };

  const executeClearChat = () => {
    stopAllSpeech();
    setMessages([]);
    setReplyingTo(null);
    localStorage.removeItem('violet-ai-messages');
    setShowClearChatConfirm(false);
    setIsSettingsOpen(false);
    showToast("Semua riwayat chat berhasil dibersihkan! 🧹");
  };

  // Helper function to reliably stream SSE data without JSON chunk split errors
  const readSSEStream = async (
    response: Response,
    onAction?: (name: string, args: any) => void,
    onActionResult?: (result: string) => void
  ): Promise<{ text: string; activeModel?: string; providerUsed?: string; modelUsed?: string }> => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let partial = "";
    let replyText = "";
    let finalActiveModel: string | undefined = undefined;
    let finalProviderUsed: string | undefined = undefined;
    let finalModelUsed: string | undefined = undefined;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        partial += decoder.decode(value, { stream: true });
        const allLines = partial.split(/\r?\n/);
        partial = allLines.pop() || "";

        for (const line of allLines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.replace(/^data:\s*/, "").trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          let data: any;
          try {
            data = JSON.parse(dataStr);
          } catch {
            // Partial JSON chunk, wait for next stream chunk
            continue;
          }

          if (data.type === "action") {
            if (onAction) onAction(data.name, data.args);
          } else if (data.type === "action_result") {
            if (onActionResult) onActionResult(data.result);
          } else if (data.type === "error") {
            let errorText = data.error || "Terjadi kesalahan pada server AI.";
            try {
              if (typeof errorText === 'string' && errorText.trim().startsWith('{')) {
                const parsedErr = JSON.parse(errorText);
                if (parsedErr.error && parsedErr.error.message) {
                  errorText = parsedErr.error.message;
                }
              }
            } catch {}
            if (errorText.includes("API key not valid")) {
              errorText = "API Key Anda tidak valid. Silakan periksa kembali di menu Gateway atau Pengaturan.";
            } else if (errorText.includes("RESOURCE_EXHAUSTED") || errorText.includes("quota") || errorText.includes("429")) {
              errorText = "Kuota API telah habis (Rate limit / Quota exceeded). Silakan coba beberapa saat lagi atau beralih provider di Gateway.";
            }
            throw new Error(errorText);
          } else if (data.type === "result") {
            replyText = data.text;
            finalActiveModel = data.activeModel;
            finalProviderUsed = data.providerUsed;
            finalModelUsed = data.modelUsed;
          }
        }
      }
    }
    return { 
      text: replyText, 
      activeModel: finalActiveModel,
      providerUsed: finalProviderUsed,
      modelUsed: finalModelUsed 
    };
  };

  const sendMessage = async (overrideInput?: string, overrideMessages?: Message[]) => {
    const currentInput = overrideInput !== undefined ? overrideInput : input;
    if (!currentInput.trim() && !attachedImage) return;
    
    // Stop any ongoing speech playback when a new message is sent
    stopAllSpeech();
    
    const userMsg = currentInput.trim() || (attachedImage ? "Tolong analisa gambar ini ya Violet!" : "");
    const imgToSend = attachedImage;
    const activeReply = replyingTo;

    setInput('');
    setAttachedImage(null);
    setReplyingTo(null);

    const isTranslateMode = targetLang !== 'off';
    const chosenLangObj = TRANSLATE_LANGUAGES.find(l => l.code === targetLang);

    const newUserMessage: Message = {
      role: 'user',
      text: userMsg,
      image: imgToSend?.preview,
      replyTo: activeReply ? { role: activeReply.role, text: activeReply.text } : undefined
    };

    const updatedMessages = overrideMessages ? [...overrideMessages, newUserMessage] : [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    const userSentSticker = /\[stik(?:er)?:\s*[a-zA-Z0-9_]+\]|\[Pengguna mengirim stiker/i.test(userMsg);

    let systemInstruction = getSystemInstruction(userSentSticker);

    if (activeReply) {
      systemInstruction += `\n\n🎯 KONTEKS REPLY / BALASAN PESAN:
Pengguna secara spesifik sedang MEMBALAS (replying) pesan sebelumnya berikut:
- Pengirim yang dibalas: ${activeReply.role === 'user' ? 'Pengguna' : 'Violet AI'}
- Isi pesan yang dikutip:
"""
${activeReply.text}
"""
🚨 ATURAN MENJAWAB: Pengguna sedang menanggapi / menanyakan hal terkait pesan yang dikutip di atas. Jawablah pesan terbaru pengguna dengan memahami dan menyambungkan langsung ke konteks pesan yang dikutip tersebut!`;
    }

    if (isTranslateMode && chosenLangObj) {
      systemInstruction += `\n\n🚨 CRITICAL VOICE INTERPRETER / TRANSLATOR MODE ACTIVE:
The user speaks/inputs in Indonesian.
Target Language: ${chosenLangObj.label} (${chosenLangObj.code}).
You MUST:
1. Translate the user's ENTIRE message completely into ${chosenLangObj.label}. Do not shorten, omit, or skip any sentences or thoughts.
2. Put the full translation inside blockquotes (> ...) at the very start of your message:
> [Full translated message in ${chosenLangObj.label}]
3. If the language uses non-Latin script (Japanese, Korean, Mandarin, Arabic), provide the complete phonetic reading (Romaji, Pinyin, or Pronunciation) right below the blockquote.
4. Then add a helpful, friendly explanation or notes in Indonesian with your cute cat persona (nya~ 🐾).`;
    }

    // Embed reply quote context directly into the command prompt so Gemini explicitly connects the two
    const commandToSend = activeReply
      ? `> [Membalas pesan dari ${activeReply.role === 'user' ? 'Pengguna' : 'Violet AI'}]:\n> "${activeReply.text.split('\n').join('\n> ')}"\n\n${userMsg}`
      : userMsg;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customApiKey: apiKey,
          command: commandToSend,
          imageAttachment: imgToSend ? { data: imgToSend.data, mimeType: imgToSend.mimeType } : undefined,
          history: messages
            .filter(m => !m.text.startsWith('**Oops! Error:**') && !m.text.includes("is not valid JSON") && !m.text.includes("Unexpected token"))
            .map(m => {
            if (m.replyTo) {
              return {
                role: m.role,
                text: `> [Membalas ${m.replyTo.role === 'user' ? 'Pengguna' : 'Violet AI'}: "${m.replyTo.text.replace(/\n/g, ' ')}"]\n\n${m.text}`
              };
            }
            return { role: m.role, text: m.text };
          }),
          systemInstruction: systemInstruction
        })
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const raw = await response.text();
          try {
            const parsed = JSON.parse(raw);
            errMsg = parsed.error || errMsg;
          } catch {
            if (raw.includes('"error":')) {
              const m = raw.match(/"error"\s*:\s*"([^"]+)"/);
              if (m) errMsg = m[1];
            } else if (raw.trim() && !raw.startsWith("<")) {
              errMsg = raw.slice(0, 150);
            }
          }
        } catch(e) {}
        throw new Error(errMsg);
      }

      const { text: replyText, activeModel: finalActiveModel, providerUsed, modelUsed } = await readSSEStream(
        response,
        (name, args) => {
          setCurrentAction(
            name === 'search_web' ? 'Mencari informasi di internet...' : 
            name === 'fetch_web_page' ? 'Membaca halaman web...' :
            name === 'execute_python_code' ? 'Menjalankan skrip Python...' :
            name === 'execute_node_code' ? 'Menjalankan kode Node.js...' :
            name === 'list_dir' ? 'Memeriksa direktori...' :
            name === 'view_file' ? 'Membaca file kode...' :
            name === 'edit_file' ? 'Mengedit file kode...' :
            name === 'git_action' ? 'Menjalankan operasi Git...' :
            name === 'skill_manage' ? 'Mengakses pustaka keahlian Hermes Skills...' :
            name === 'todo_manage' ? 'Memperbarui daftar tugas otonom (Todos)...' :
            name === 'cronjob_manage' ? 'Mengatur jadwal tugas latar (Cronjobs)...' :
            name === 'delegate_task' ? 'Mendelegasikan tugas ke subagent Hermes...' :
            name === 'write_workspace_file' ? 'Menyimpan file...' :
            name === 'read_workspace_file' ? 'Membaca file...' :
            name === 'manage_memory' ? 'Menyimpan memori...' :
            name === 'get_current_time' ? 'Mengecek waktu real-time...' :
            name === 'run_shell_command' ? 'Menjalankan perintah terminal...' :
            'Memproses aksi...'
          );
          setCurrentActionDetails({ name, args });
        },
        (result) => {
          setCurrentActionDetails(prev => prev ? { ...prev, result } : null);
        }
      );

      setCurrentAction(null);
      setCurrentActionDetails(null);
      setIsActionZoomed(false);
      const nextIndex = updatedMessages.length;
      let finalReplyText = replyText || "";

      // Intercept Shell Commands
      let shellMatch = finalReplyText.match(/\{\s*"action"\s*:\s*"run_shell_command"\s*,\s*"command"\s*:\s*"([^"]+)"\s*\}/);
      
      // Fallback matching if they put newlines or weird spaces
      if (!shellMatch && finalReplyText.includes('"run_shell_command"')) {
         try {
            // Try to extract JSON from markdown if present
            const jsonStr = finalReplyText.match(/\`\`\`json\s*(\{[\s\S]*?\})\s*\`\`\`/)?.[1] || finalReplyText;
            const parsed = JSON.parse(jsonStr.replace(/^[^{\]]+/, '').replace(/[^}\]]+$/, ''));
            if (parsed.action === 'run_shell_command' && parsed.command) {
               shellMatch = [null, parsed.command];
            }
         } catch(e) {}
      }

      if (shellMatch) {
        const command = shellMatch[1];
        
        // Show loading state
        setCurrentAction('Menjalankan perintah terminal: ' + command);
        
        try {
          const res = await fetch('/api/run-shell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
          });
          const data = await res.json();
          let output = data.stdout || "";
          if (data.stderr) output += "\n[STDERR]: " + data.stderr;
          if (data.error) output += "\n[ERROR]: " + data.error;
          if (!output.trim()) output = "[Command completed with no output]";
          
          setCurrentAction(null);
          
          // Append assistant's intent to messages, then system's response
          setMessages(prev => [
            ...prev,
            { 
              role: 'assistant', 
              text: "Mengeksekusi: `" + command + "`",
              provider: providerUsed || gatewayState?.activeProviderId || 'gemini',
              model: modelUsed || gatewayState?.activeModelId || 'gemini-3.7-flash'
            },
            {
              role: 'user',
              text: "Hasil Terminal:\n```bash\n" + output + "\n```"
            }
          ]);
          
          // Trigger next turn automatically
          setTimeout(() => {
            const nextMessages = [
              ...updatedMessages,
              { 
                role: 'assistant' as "assistant", 
                text: "Mengeksekusi: `" + command + "`",
                provider: providerUsed || gatewayState?.activeProviderId || 'gemini',
                model: modelUsed || gatewayState?.activeModelId || 'gemini-3.7-flash'
              }
            ];
            sendMessage("Hasil Terminal:\n```bash\n" + output + "\n```", nextMessages);
          }, 100);
          return;
          
        } catch (e) {
          console.error(e);
          setCurrentAction(null);
        }
      }

      if (!userSentSticker && finalReplyText) {
        const stripped = finalReplyText.replace(/\[stik(?:er)?:\s*[a-zA-Z0-9_]+\]/gi, '').trim();
        finalReplyText = stripped || "Meow~ 🐾 Halo! Ada yang bisa Violet bantu?";
      }
      if (!finalReplyText || !finalReplyText.trim()) {
        finalReplyText = "Meow~ 🐾 Maaf ya, Violet tadi sempat melamun sejenak. Ada yang ingin kamu tanyakan?";
      }
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          text: finalReplyText,
          provider: providerUsed || gatewayState?.activeProviderId || 'gemini',
          model: modelUsed || gatewayState?.activeModelId || 'gemini-3.7-flash'
        }
      ]);

      // Auto-copy to clipboard if enabled
      if (autoCopy && finalReplyText) {
        try {
          const quoteLines = finalReplyText
            .split('\n')
            .filter(l => l.trim().startsWith('>'))
            .map(l => l.replace(/^>\s*/, '').trim())
            .filter(Boolean);
          const textToCopy = quoteLines.length > 0 ? quoteLines.join('\n') : finalReplyText;
          await navigator.clipboard.writeText(textToCopy);
          showToast("Otomatis disalin ke clipboard! 📋");
        } catch (e) {}
      }

      // Auto-speak reply if enabled
      if (autoSpeak && finalReplyText) {
        setTimeout(() => {
          toggleSpeech(finalReplyText, nextIndex, isTranslateMode ? chosenLangObj?.code : undefined);
        }, 200);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: `**Oops! Error:** ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateLastMessage = async (assistantIndex: number) => {
    if (isLoading) return;
    // Find the user message right before this assistant message
    const prevHistory = messages.slice(0, assistantIndex);
    const lastUserMsg = prevHistory[prevHistory.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') return;

    setMessages(prevHistory);
    setIsLoading(true);
    stopAllSpeech();

    const isTranslateMode = targetLang !== 'off';
    const chosenLangObj = TRANSLATE_LANGUAGES.find(l => l.code === targetLang);

    const userSentSticker = /\[stik(?:er)?:\s*[a-zA-Z0-9_]+\]|\[Pengguna mengirim stiker/i.test(lastUserMsg.text);

    let systemInstruction = getSystemInstruction(userSentSticker);

    if (lastUserMsg.replyTo) {
      systemInstruction += `\n\n🎯 KONTEKS REPLY / BALASAN PESAN:
Pengguna secara spesifik sedang MEMBALAS (replying) pesan sebelumnya berikut:
- Pengirim yang dibalas: ${lastUserMsg.replyTo.role === 'user' ? 'Pengguna' : 'Violet AI'}
- Isi pesan yang dikutip:
"""
${lastUserMsg.replyTo.text}
"""
🚨 ATURAN MENJAWAB: Pengguna sedang menanggapi / menanyakan hal terkait pesan yang dikutip di atas. Jawablah pesan pengguna dengan memahami dan menyambungkan langsung ke konteks pesan yang dikutip tersebut!`;
    }

    if (isTranslateMode && chosenLangObj) {
      systemInstruction += `\n\n🚨 CRITICAL VOICE INTERPRETER / TRANSLATOR MODE ACTIVE:
The user speaks/inputs in Indonesian.
Target Language: ${chosenLangObj.label} (${chosenLangObj.code}).
You MUST:
1. Translate the user's ENTIRE message completely into ${chosenLangObj.label}. Do not shorten, omit, or skip any sentences or thoughts.
2. Put the full translation inside blockquotes (> ...) at the very start of your message:
> [Full translated message in ${chosenLangObj.label}]
3. If the language uses non-Latin script (Japanese, Korean, Mandarin, Arabic), provide the complete phonetic reading (Romaji, Pinyin, or Pronunciation) right below the blockquote.
4. Then add a helpful, friendly explanation or notes in Indonesian with your cute cat persona (nya~ 🐾).`;
    }

    const commandToRegenerate = lastUserMsg.replyTo
      ? `> [Membalas pesan dari ${lastUserMsg.replyTo.role === 'user' ? 'Pengguna' : 'Violet AI'}]:\n> "${lastUserMsg.replyTo.text.split('\n').join('\n> ')}"\n\nPertanyaan/balasan saya:\n${lastUserMsg.text}`
      : lastUserMsg.text;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customApiKey: apiKey,
          command: commandToRegenerate,
          history: prevHistory.slice(0, -1)
            .filter(m => !m.text.startsWith('**Oops! Error:**') && !m.text.includes("is not valid JSON") && !m.text.includes("Unexpected token"))
            .map(m => {
            if (m.replyTo) {
              return {
                role: m.role,
                text: `> [Membalas ${m.replyTo.role === 'user' ? 'Pengguna' : 'Violet AI'}: "${m.replyTo.text.replace(/\n/g, ' ')}"]\n\n${m.text}`
              };
            }
            return { role: m.role, text: m.text };
          }),
          systemInstruction: systemInstruction
        })
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const raw = await response.text();
          try {
            const parsed = JSON.parse(raw);
            errMsg = parsed.error || errMsg;
          } catch {
            if (raw.includes('"error":')) {
              const m = raw.match(/"error"\s*:\s*"([^"]+)"/);
              if (m) errMsg = m[1];
            } else if (raw.trim() && !raw.startsWith("<")) {
              errMsg = raw.slice(0, 150);
            }
          }
        } catch(e) {}
        throw new Error(errMsg);
      }

      const { text: replyText, providerUsed, modelUsed } = await readSSEStream(response);
      let finalReplyText = replyText || "";
      if (!userSentSticker && finalReplyText) {
        const stripped = finalReplyText.replace(/\[stik(?:er)?:\s*[a-zA-Z0-9_]+\]/gi, '').trim();
        finalReplyText = stripped || "Meow~ 🐾 Halo! Ada yang bisa Violet bantu?";
      }
      if (!finalReplyText || !finalReplyText.trim()) {
        finalReplyText = "Meow~ 🐾 Maaf ya, Violet tadi sempat melamun sejenak. Ada yang ingin kamu tanyakan?";
      }
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          text: finalReplyText,
          provider: providerUsed || gatewayState?.activeProviderId || 'gemini',
          model: modelUsed || gatewayState?.activeModelId || 'gemini-3.7-flash'
        }
      ]);

      if (autoCopy) {
        try {
          const quoteLines = finalReplyText
            .split('\n')
            .filter(l => l.trim().startsWith('>'))
            .map(l => l.replace(/^>\s*/, '').trim())
            .filter(Boolean);
          const textToCopy = quoteLines.length > 0 ? quoteLines.join('\n') : finalReplyText;
          await navigator.clipboard.writeText(textToCopy);
          showToast("Otomatis disalin ke clipboard! 📋");
        } catch (e) {}
      }

      if (autoSpeak) {
        setTimeout(() => {
          toggleSpeech(finalReplyText, prevHistory.length, isTranslateMode ? chosenLangObj?.code : undefined);
        }, 200);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: `**Oops! Error:** ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for sending sticker messages
  const sendStickerMessage = async (sticker: StickerItem) => {
    if (isLoading) return;

    stopAllSpeech();

    const activeReply = replyingTo;
    setReplyingTo(null);

    const newUserMessage: Message = {
      role: 'user',
      text: `[stiker:${sticker.id}]`,
      sticker: sticker.id,
      replyTo: activeReply ? { role: activeReply.role, text: activeReply.text } : undefined
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    const isTranslateMode = targetLang !== 'off';
    const chosenLangObj = TRANSLATE_LANGUAGES.find(l => l.code === targetLang);

    let systemInstruction = getSystemInstruction(true); // Always true for stickers

    if (activeReply) {
      systemInstruction += `\n\n🎯 KONTEKS REPLY / BALASAN PESAN:
Pengguna secara spesifik sedang MEMBALAS (replying) pesan sebelumnya berikut:
- Pengirim yang dibalas: ${activeReply.role === 'user' ? 'Pengguna' : 'Violet AI'}
- Isi pesan yang dikutip:
"""
${activeReply.text}
"""
🚨 ATURAN MENJAWAB: Pengguna sedang menanggapi / menanyakan hal terkait pesan yang dikutip di atas. Jawablah pesan pengguna dengan memahami dan menyambungkan langsung ke konteks pesan yang dikutip tersebut!`;
    }

    const commandToSend = activeReply
      ? `> [Membalas pesan dari ${activeReply.role === 'user' ? 'Pengguna' : 'Violet AI'}]:\n> "${activeReply.text.split('\n').join('\n> ')}"\n\n[Pengguna mengirim stiker: "${sticker.name}" - ${sticker.label}]`
      : `[Pengguna mengirim stiker: "${sticker.name}" - ${sticker.label}]`;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customApiKey: apiKey,
          command: commandToSend,
          history: messages
            .filter(m => !m.text.startsWith('**Oops! Error:**') && !m.text.includes("is not valid JSON") && !m.text.includes("Unexpected token"))
            .map(m => {
            if (m.replyTo) {
              return {
                role: m.role,
                text: `> [Membalas ${m.replyTo.role === 'user' ? 'Pengguna' : 'Violet AI'}: "${m.replyTo.text.replace(/\n/g, ' ')}"]\n\n${m.text}`
              };
            }
            return { role: m.role, text: m.text };
          }),
          systemInstruction: systemInstruction
        })
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const raw = await response.text();
          try {
            const parsed = JSON.parse(raw);
            errMsg = parsed.error || errMsg;
          } catch {
            if (raw.includes('"error":')) {
              const m = raw.match(/"error"\s*:\s*"([^"]+)"/);
              if (m) errMsg = m[1];
            } else if (raw.trim() && !raw.startsWith("<")) {
              errMsg = raw.slice(0, 150);
            }
          }
        } catch(e) {}
        throw new Error(errMsg);
      }

      const { text: streamedText, providerUsed, modelUsed } = await readSSEStream(response);
      const replyText = streamedText || 'Meow~ 🐾 [stiker:cat_happy]';
      const nextIndex = updatedMessages.length;
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          text: replyText,
          provider: providerUsed || gatewayState?.activeProviderId || 'gemini',
          model: modelUsed || gatewayState?.activeModelId || 'gemini-3.7-flash'
        }
      ]);

      if (autoCopy) {
        try {
          const textToCopy = replyText.replace(/\[stik(?:er)?:\s*([a-zA-Z0-9_]+)\]/gi, '').trim() || replyText;
          await navigator.clipboard.writeText(textToCopy);
          showToast("Otomatis disalin ke clipboard! 📋");
        } catch (e) {}
      }

      if (autoSpeak) {
        setTimeout(() => {
          toggleSpeech(replyText, nextIndex, isTranslateMode ? chosenLangObj?.code : undefined);
        }, 200);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: `**Oops! Error:** ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Text-To-Speech Synthesis function with Multi-Language Voice Support & Full-Chat Streaming
  const toggleSpeech = (text: string, index?: number, targetLangCode?: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Browser Anda belum mendukung Web Speech Synthesis!");
      return;
    }

    // If user clicked stop on the message that is currently speaking, shut it off immediately
    if (speakingIndex !== null && speakingIndex === index) {
      stopAllSpeech();
      return;
    }

    // Stop any existing speech session immediately
    stopAllSpeech();

    // Increment and capture session ID so old callbacks are completely neutralized
    const currentSessionId = ++speechSessionRef.current;

    // Helper: Clean markdown, formatting, links, and code blocks for crystal clear audio
    const cleanSpeech = (raw: string) => {
      return raw
        .replace(/\[stik(?:er)?:\s*([a-zA-Z0-9_]+)\]/gi, '') // remove sticker tags from speech
        .replace(/```[\s\S]*?```/g, '') // remove code blocks
        .replace(/`([^`]+)`/g, '$1')     // inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // link text
        .replace(/https?:\/\/\S+/g, '') // strip urls
        .replace(/[#*_~[\]()]/g, '')    // markdown symbols
        .replace(/^\s*>\s*/gm, '')      // blockquote markers
        .trim();
    };

    // Helper: Split text into small sentence chunks (max 120-150 chars) so browser Web Speech never pauses or truncates
    const splitToSentences = (t: string) => {
      if (!t) return [];
      const rawChunks = t.split(/(?<=[.!?\n。！？])/);
      const results: string[] = [];
      let buffer = '';

      for (const chunk of rawChunks) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        if (buffer.length + trimmed.length < 130) {
          buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
        } else {
          if (buffer) results.push(buffer);
          buffer = trimmed;
        }
      }
      if (buffer) results.push(buffer);
      return results.filter(s => s.length > 0);
    };

    const isTranslateMode = targetLang !== 'off';
    const langToUse = targetLangCode || (isTranslateMode ? targetLang : 'id-ID');

    // Build the sequential speech queue
    interface SpeechQueueItem {
      text: string;
      lang: string;
      pitch: number;
    }
    const queue: SpeechQueueItem[] = [];

    // Check if there are blockquote lines (the translated segment)
    const allLines = text.split('\n');
    const quoteLines = allLines
      .filter(l => l.trim().startsWith('>'))
      .map(l => l.replace(/^>\s*/, '').trim())
      .filter(Boolean);
    const nonQuoteLines = allLines
      .filter(l => !l.trim().startsWith('>'))
      .map(l => l.trim())
      .filter(Boolean);

    if (isTranslateMode && quoteLines.length > 0) {
      // 1. Translated target text -> voiced in target language
      const translatedClean = cleanSpeech(quoteLines.join(' '));
      const translatedSentences = splitToSentences(translatedClean);
      translatedSentences.forEach(s => {
        queue.push({
          text: s,
          lang: langToUse,
          pitch: langToUse.startsWith('ja') ? 1.25 : 1.15
        });
      });

      // 2. Explanation / notes -> voiced in Indonesian
      const explanationClean = cleanSpeech(nonQuoteLines.join(' '));
      const explanationSentences = splitToSentences(explanationClean);
      explanationSentences.forEach(s => {
        queue.push({
          text: s,
          lang: 'id-ID',
          pitch: 1.15
        });
      });
    } else {
      // Normal chat or single-language response -> voice the entire full text
      const fullClean = cleanSpeech(text);
      const sentences = splitToSentences(fullClean);
      sentences.forEach(s => {
        queue.push({
          text: s,
          lang: langToUse,
          pitch: langToUse.startsWith('ja') ? 1.25 : 1.15
        });
      });
    }

    if (queue.length === 0) return;

    if (typeof index === 'number') {
      setSpeakingIndex(index);
    }

    // Play all queued sentences in sequence
    let currentItemIdx = 0;
    const playNext = () => {
      // Abort immediately if session was invalidated or cancelled
      if (speechSessionRef.current !== currentSessionId) {
        return;
      }

      if (currentItemIdx >= queue.length) {
        if (speechSessionRef.current === currentSessionId) {
          setSpeakingIndex(null);
        }
        return;
      }

      const item = queue[currentItemIdx];
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.rate = 1.0;
      utterance.pitch = item.pitch;
      utterance.lang = item.lang;

      const voices = window.speechSynthesis.getVoices();
      const prefix = item.lang.split('-')[0].toLowerCase();
      const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onend = () => {
        if (speechSessionRef.current !== currentSessionId) return;
        currentItemIdx++;
        playNext();
      };

      utterance.onerror = (event: any) => {
        // If cancelled or interrupted by user, DO NOT continue to next item in queue!
        if (
          speechSessionRef.current !== currentSessionId ||
          event?.error === 'interrupted' ||
          event?.error === 'canceled'
        ) {
          return;
        }
        currentItemIdx++;
        playNext();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Speech synthesis play error:", err);
      }
    };

    playNext();
  };

  // Speech Recognition (Speech-to-Text in Indonesian) with Continuous Full Transcript Capture
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser Anda belum mendukung fitur Speech-to-Text langsung di web. Silakan gunakan Google Chrome, Microsoft Edge, atau Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    // Stop all audio output before listening to voice
    stopAllSpeech();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID'; // Voice input in Indonesian
      recognition.continuous = true; // Keep listening continuously without pausing or stopping between words
      recognition.interimResults = true; // Show real-time progressive typing

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let completeTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          completeTranscript += event.results[i][0].transcript;
        }
        if (completeTranscript.trim()) {
          setInput(completeTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Speech recognition start failed:", err);
      setIsListening(false);
    }
  };

  // Workspace & Hermes Data Loaders
  const loadWorkspaceFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/workspace/files');
      if (res.ok) {
        const data = await res.json();
        setWorkspaceFiles(data.files || []);
      }
    } catch (e) {
      console.error("Failed to load workspace files", e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadHermesSkills = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        const data = await res.json();
        setHermesSkills(data.skills || []);
      }
    } catch (e) {
      console.error("Failed to load skills", e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadHermesTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      if (res.ok) {
        const data = await res.json();
        setHermesTodos(data.todos || []);
      }
    } catch (e) {
      console.error("Failed to load todos", e);
    }
  };

  const loadHermesCronjobs = async () => {
    try {
      const res = await fetch('/api/cronjobs');
      if (res.ok) {
        const data = await res.json();
        setHermesCronjobs(data.cronjobs || []);
      }
    } catch (e) {
      console.error("Failed to load cronjobs", e);
    }
  };

  const loadAllWorkspaceData = () => {
    loadWorkspaceFiles();
    loadHermesSkills();
    loadHermesTodos();
    loadHermesCronjobs();
  };

  const deleteWorkspaceFile = (filename: string) => {
    setFileToDelete(filename);
  };

  const confirmDeleteWorkspaceFile = async () => {
    if (!fileToDelete) return;
    const filename = fileToDelete;
    setFileToDelete(null);
    try {
      await fetch(`/api/workspace/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      showToast(`File '${filename}' berhasil dihapus! 🗑️`);
      loadWorkspaceFiles();
    } catch (e) {
      console.error("Failed to delete workspace file", e);
      showToast("Gagal menghapus file workspace");
    }
  };

  const handleImageAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fullDataUrl = event.target?.result as string;
        // Optimize & compress image with canvas to prevent QuotaExceededError and white screen
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 1200;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
              const base64Data = compressedDataUrl.split(',')[1];
              setAttachedImage({
                data: base64Data,
                mimeType: 'image/jpeg',
                preview: compressedDataUrl
              });
            } else {
              const mimeType = file.type || 'image/png';
              setAttachedImage({
                data: fullDataUrl.split(',')[1],
                mimeType: mimeType,
                preview: fullDataUrl
              });
            }
          } catch (err) {
            console.error("Error compressing image", err);
            setAttachedImage({
              data: fullDataUrl.split(',')[1],
              mimeType: file.type || 'image/png',
              preview: fullDataUrl
            });
          }
        };
        img.onerror = () => {
          showToast("Format gambar tidak didukung!");
        };
        img.src = fullDataUrl;
      };
      reader.readAsDataURL(file);
    }
    // reset input
    e.target.value = '';
  };

  // Helper to extract dominant color from uploaded image
  const extractColorFromImage = (dataUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = dataUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          setBgColor(hex);
        }
      } catch (e) {
        console.error("Could not extract color from image", e);
      }
    };
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setBgImage(result);
        extractColorFromImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen overflow-hidden font-sans"
      style={{ 
        backgroundColor: bgColor,
        backgroundImage: bgImage ? `url(${bgImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div 
            className="px-4 py-2 rounded-full font-black text-xs sm:text-sm text-white border-2 flex items-center gap-2 shadow-lg"
            style={{
              backgroundColor: theme.primary,
              borderColor: theme.border,
              boxShadow: `3px 3px 0px ${theme.shadow}`
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header 
        className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 m-2.5 sm:m-3 bg-white/95 backdrop-blur-md rounded-2xl border-2 z-10 shrink-0 transition-all duration-300"
        style={{
          borderColor: theme.border,
          boxShadow: `3px 3px 0px ${theme.shadow}`
        }}
      >
        <h1 className="font-extrabold text-lg sm:text-xl tracking-tight flex items-center gap-2.5" style={{ color: theme.textDark }}>
          <div 
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border-2 flex items-center justify-center shrink-0"
            style={{ borderColor: theme.border, backgroundColor: theme.lightTint }}
          >
            <img src="/src/assets/images/violet_ai_cat_logo_1788467449037.jpg" alt="Violet AI Logo" className="w-full h-full object-cover" />
          </div>
          Violet AI
          <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-300 hidden sm:inline-block">
            Hermes Agent
          </span>
        </h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {messages.length > 0 && (
            <>
              <button 
                onClick={exportChat}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border-2 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 text-xs font-black"
                style={{ 
                  backgroundColor: theme.lightTint, 
                  borderColor: theme.border, 
                  color: theme.textDark,
                  boxShadow: `2px 2px 0px ${theme.shadow}` 
                }}
                title="Ekspor Chat (Markdown)"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden md:inline">Ekspor</span>
              </button>
              <button 
                onClick={() => setShowClearChatConfirm(true)}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border-2 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 text-xs font-black hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                style={{ 
                  backgroundColor: theme.lightTint, 
                  borderColor: theme.border, 
                  color: theme.textDark,
                  boxShadow: `2px 2px 0px ${theme.shadow}` 
                }}
                title="Hapus Semua Riwayat Chat"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden md:inline">Hapus</span>
              </button>
            </>
          )}
          <button 
            onClick={() => {
              setIsWorkspaceOpen(true);
              loadAllWorkspaceData();
            }}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border-2 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 text-xs font-black"
            style={{ 
              backgroundColor: theme.lightTint, 
              borderColor: theme.border, 
              color: theme.textDark,
              boxShadow: `2px 2px 0px ${theme.shadow}` 
            }}
            title="Workspace & Hermes Agent Skills"
          >
            <Folder className="w-4 h-4" />
            <span className="hidden sm:inline">Workspace</span>
          </button>
          <button 
            onClick={() => setIsNineRouterOpen(true)}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl border-2 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs"
            style={{ 
              borderColor: theme.border, 
              boxShadow: `2px 2px 0px ${theme.shadow}` 
            }}
            title="AI Gateway & Multi-Provider Router"
          >
            <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
            <span className="hidden sm:inline">Gateway</span>
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl border-2 hover:-translate-y-0.5 active:translate-y-0 transition-all"
            style={{ 
              backgroundColor: theme.lightTint, 
              borderColor: theme.border, 
              color: theme.textDark,
              boxShadow: `2px 2px 0px ${theme.shadow}` 
            }}
            title="Settings & Tema"
          >
            <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 w-full flex flex-col items-center">
        <div className="w-full max-w-2xl sm:max-w-3xl flex flex-col gap-3.5 sm:gap-4 pb-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 mt-12 sm:mt-16" style={{ color: theme.textDark }}>
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 bg-white animate-bounce" 
                style={{ 
                  borderColor: theme.border,
                  boxShadow: `4px 4px 0px ${theme.shadow}`,
                  animationDuration: '3s' 
                }}
              >
                <img src="/src/assets/images/violet_ai_cat_logo_1788467449037.jpg" alt="Violet AI Mascot" className="w-full h-full object-cover" />
              </div>
              <h2 
                className="text-lg sm:text-xl font-black mt-2 bg-white px-5 py-1.5 rounded-xl border-2"
                style={{ borderColor: theme.border, boxShadow: `3px 3px 0px ${theme.shadow}` }}
              >
                Meow! How can I help? 🐾
              </h2>
              <p className="text-xs sm:text-sm font-bold bg-white/80 px-3.5 py-1 rounded-lg">
                Violet AI siap ngobrol, menerjemahkan suara, & menganalisa gambar!
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              // SKIP RENDERING RESULT
              if (msg.role === 'user' && msg.text.startsWith('Hasil Terminal:')) {
                return null;
              }

              // RENDER TOOL CALL
              if (msg.role === 'assistant' && msg.text.startsWith('Mengeksekusi: `')) {
                const nextMsg = messages[i+1];
                const resultText = nextMsg && nextMsg.role === 'user' && nextMsg.text.startsWith('Hasil Terminal:') ? nextMsg.text : null;
                return <TerminalActionBlock key={i} commandText={msg.text} resultText={resultText} />;
              }

              const isErrorMsg = msg.role === 'assistant' && msg.text.startsWith('**Oops! Error:**');
              return (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div 
                    className="w-8 h-8 rounded-xl overflow-hidden border-2 flex items-center justify-center shrink-0 mt-0.5"
                    style={{ borderColor: theme.border, backgroundColor: theme.lightTint, boxShadow: `2px 2px 0px ${theme.shadow}` }}
                  >
                    <img src="/src/assets/images/violet_ai_cat_logo_1788467449037.jpg" alt="Violet AI" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div 
                  className={`px-3.5 py-2.5 sm:px-4 sm:py-3 max-w-[88%] sm:max-w-[78%] min-w-0 break-words overflow-hidden border-2 text-[14px] sm:text-[15px] font-normal leading-relaxed transition-all duration-200 relative group ${
                    msg.role === 'user' 
                      ? 'text-white rounded-2xl rounded-tr-sm' 
                      : isErrorMsg
                      ? 'bg-red-50 text-red-900 border-red-300 rounded-2xl rounded-tl-sm'
                      : 'bg-white text-zinc-800 rounded-2xl rounded-tl-sm'
                  }`}
                  style={{
                    borderColor: isErrorMsg && msg.role === 'assistant' ? '#fca5a5' : theme.border,
                    boxShadow: `2px 2px 0px ${theme.shadow}`,
                    backgroundColor: msg.role === 'user' ? theme.primary : (isErrorMsg ? '#fff5f5' : '#ffffff')
                  }}
                >
                  {/* Quoted / Replied context preview */}
                  {msg.replyTo && (
                    <div 
                      className={`mb-2 px-2.5 py-1.5 rounded-lg border-l-4 text-xs ${
                        msg.role === 'user' 
                          ? 'bg-black/20 text-white border-white/80' 
                          : 'bg-zinc-100 text-zinc-700 border-violet-500'
                      }`}
                    >
                      <span className="font-extrabold text-[10px] block opacity-80">
                        Membalas {msg.replyTo.role === 'user' ? 'Anda' : 'Violet AI'}:
                      </span>
                      <p className="truncate line-clamp-1 italic text-[11px] opacity-90">{msg.replyTo.text}</p>
                    </div>
                  )}

                  {/* User sent image preview */}
                  {msg.image && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/40 w-fit max-w-sm cursor-zoom-in hover:opacity-90 transition-opacity">
                      <img 
                        src={msg.image} 
                        alt="Uploaded attachment" 
                        className="max-h-72 w-auto object-cover block cursor-zoom-in" 
                        onDoubleClick={() => setZoomedImage(msg.image)}
                        title="Klik dua kali (double click) untuk memperbesar"
                      />
                    </div>
                  )}

                  {(() => {
                    const { stickersFound, cleanText } = parseMessageContent(msg.text, msg.sticker);
                    return (
                      <div className="flex flex-col gap-2">
                        {stickersFound.length > 0 && (
                          <div className={`flex flex-wrap items-center gap-2.5 my-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {stickersFound.map((stkId, sIdx) => (
                              <div key={sIdx} className="p-1 rounded-2xl bg-white/10 hover:scale-105 transition-transform">
                                <StickerVisual 
                                  id={stkId} 
                                  size={110} 
                                  animate={true} 
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {cleanText ? (
                          msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap font-medium">{cleanText}</p>
                          ) : (
                            <div>
                              <div className={`markdown-body max-w-full overflow-hidden break-words !bg-transparent !font-normal text-[14px] sm:text-[15px] ${isErrorMsg ? '!text-red-800' : '!text-zinc-800'}`} style={{ backgroundColor: 'transparent' }}>
                                <Markdown>{cleanText}</Markdown>
                              </div>
                              {isErrorMsg && (
                                <div className="mt-2.5 pt-2 border-t border-red-200/80 flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-100/90 hover:bg-red-200/90 rounded-lg transition-all flex items-center gap-1.5"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                    Buka Pengaturan API Key
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Compact Action Toolbar */}
                  <div 
                    className={`mt-2 pt-1.5 border-t flex items-center justify-between gap-1 text-xs ${
                      msg.role === 'user' ? 'border-white/20 text-white/90' : 'border-zinc-100 text-zinc-500'
                    }`}
                  >
                    <span className="text-[10px] font-bold opacity-75">
                      {msg.role === 'user' 
                        ? 'Anda' 
                        : `${formatProviderLabel(msg.provider || gatewayState?.activeProviderId)} (${formatModelLabel(msg.model || gatewayState?.activeModelId)})`
                      }
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Copy Button */}
                      <button
                        onClick={() => copyToClipboard(msg.text, i)}
                        className={`p-1 rounded-md transition-all flex items-center gap-1 ${
                          msg.role === 'user' ? 'hover:bg-white/20' : 'hover:bg-zinc-100'
                        }`}
                        title="Salin Teks (Copy)"
                      >
                        {copiedIndex === i ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[10px] hidden sm:inline">
                          {copiedIndex === i ? 'Tersalin' : 'Salin'}
                        </span>
                      </button>

                      {/* Reply Button */}
                      <button
                        onClick={() => startReply(i, msg)}
                        className={`p-1 rounded-md transition-all flex items-center gap-1 ${
                          msg.role === 'user' ? 'hover:bg-white/20' : 'hover:bg-zinc-100'
                        }`}
                        title="Balas pesan ini (Quote/Reply)"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span className="text-[10px] hidden sm:inline">Balas</span>
                      </button>

                      {/* User only: Edit Button */}
                      {msg.role === 'user' && (
                        <button
                          onClick={() => editMessage(i)}
                          className="p-1 rounded-md hover:bg-white/20 transition-all flex items-center gap-1"
                          title="Edit & Kirim Ulang"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="text-[10px] hidden sm:inline">Edit</span>
                        </button>
                      )}

                      {/* Assistant only: TTS Voice */}
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => toggleSpeech(msg.text, i)}
                          className="p-1 rounded-md hover:bg-zinc-100 transition-all flex items-center gap-1"
                          title={speakingIndex === i ? "Stop suara" : "Dengarkan suara"}
                        >
                          {speakingIndex === i ? (
                            <VolumeX className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-zinc-600" />
                          )}
                          <span className={`text-[10px] hidden sm:inline ${speakingIndex === i ? 'text-red-500 font-bold' : ''}`}>
                            {speakingIndex === i ? 'Stop' : 'Suara'}
                          </span>
                        </button>
                      )}

                      {/* Assistant only: Regenerate on the latest message */}
                      {msg.role === 'assistant' && i === messages.length - 1 && (
                        <button
                          onClick={() => regenerateLastMessage(i)}
                          disabled={isLoading}
                          className="p-1 rounded-md hover:bg-zinc-100 transition-all flex items-center gap-1 disabled:opacity-40"
                          title="Generate Ulang Balasan (Regenerate)"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                          <span className="text-[10px] hidden sm:inline">Ulang</span>
                        </button>
                      )}

                      {/* Delete Message Button */}
                      <button
                        onClick={() => deleteMessage(i)}
                        className={`p-1 rounded-md transition-all ${
                          msg.role === 'user' ? 'hover:bg-white/20' : 'hover:bg-red-50 hover:text-red-500'
                        }`}
                        title="Hapus pesan ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex flex-col items-start gap-1 mt-2">
              <div className="flex justify-start opacity-70 animate-pulse">
                <div 
                  className="px-4 py-3 bg-white border-2 rounded-2xl rounded-tl-sm flex items-center gap-2"
                  style={{ borderColor: theme.border, boxShadow: `2px 2px 0px ${theme.shadow}` }}
                >
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: theme.primary, animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: theme.primary, animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: theme.primary, animationDelay: '300ms' }} />
                </div>
              </div>
              {currentAction && (
                <div 
                  className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 bg-white/60 rounded-full border-2 cursor-pointer hover:bg-white transition-colors group" 
                  style={{ borderColor: theme.border, color: theme.textDark }}
                  onClick={() => setIsActionZoomed(true)}
                  title="Klik untuk zoom melihat proses"
                >
                  <Sparkles className="w-3 h-3 animate-spin" style={{ color: theme.primary }} />
                  <span>{currentAction}</span>
                  <Eye className="w-3 h-3 opacity-60 ml-1 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="px-3 sm:px-4 shrink-0 pb-4 sm:pb-5">
        <div className="max-w-2xl sm:max-w-3xl mx-auto relative flex flex-col gap-1.5">
          
          {/* Top Control Bar: Voice Translate, Auto-Speak, Auto-Copy */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-0.5 text-xs">
            <div 
              className="flex items-center gap-1 bg-white/95 backdrop-blur-sm border-2 px-2.5 py-1 rounded-xl transition-all"
              style={{ borderColor: theme.border, boxShadow: `1.5px 1.5px 0px ${theme.shadow}` }}
            >
              <Languages className="w-3.5 h-3.5" style={{ color: theme.textDark }} />
              <span className="font-extrabold text-[11px] hidden sm:inline" style={{ color: theme.textDark }}>Translate:</span>
              <select
                value={targetLang}
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetLang(val);
                  if (val === 'off') {
                    stopAllSpeech();
                    showToast("Translate dinonaktifkan & suara dihentikan 🔇");
                  } else {
                    const found = TRANSLATE_LANGUAGES.find(l => l.code === val);
                    showToast(`Mode Terjemahan ${found?.label || val} Aktif 🌐`);
                  }
                }}
                className="bg-transparent font-bold focus:outline-none cursor-pointer text-[11px] py-0.5"
                style={{ color: theme.textDark }}
              >
                {TRANSLATE_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Auto-Copy Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const next = !autoCopy;
                  setAutoCopy(next);
                  showToast(next ? "Auto-Salin diaktifkan! 📋" : "Auto-Salin dinonaktifkan");
                }}
                className={`flex items-center gap-1 bg-white/95 backdrop-blur-sm border-2 px-2 py-1 rounded-xl font-bold text-[11px] transition-all hover:bg-white`}
                style={{
                  borderColor: theme.border,
                  color: autoCopy ? theme.primary : '#71717a',
                  boxShadow: `1.5px 1.5px 0px ${theme.shadow}`
                }}
                title={autoCopy ? "Auto-Salin Aktif: Otomatis menyalin terjemahan/balasan ke clipboard" : "Auto-Salin Nonaktif"}
              >
                <Copy className={`w-3 h-3 ${autoCopy ? 'text-violet-600' : 'text-zinc-400'}`} />
                <span>{autoCopy ? 'Auto Salin ON' : 'Auto Salin OFF'}</span>
              </button>

              {/* Auto-Speak Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  if (!next) {
                    stopAllSpeech();
                    showToast("Suara otomatis dinonaktifkan & dihentikan 🔇");
                  } else {
                    showToast("Suara otomatis diaktifkan 🔊");
                  }
                }}
                className="flex items-center gap-1 bg-white/95 backdrop-blur-sm border-2 px-2 py-1 rounded-xl font-bold text-[11px] transition-all hover:bg-white"
                style={{
                  borderColor: theme.border,
                  color: autoSpeak ? theme.primary : '#71717a',
                  boxShadow: `1.5px 1.5px 0px ${theme.shadow}`
                }}
                title={autoSpeak ? "Auto-Speak Aktif: Otomatis membaca dengan suara" : "Auto-Speak Mati"}
              >
                {autoSpeak ? <Volume2 className="w-3 h-3 text-emerald-600" /> : <VolumeX className="w-3 h-3 text-zinc-400" />}
                <span className="hidden xs:inline">{autoSpeak ? 'Suara ON' : 'Suara OFF'}</span>
              </button>
            </div>
          </div>

          {/* Active Speaking Indicator with quick Stop Button */}
          {speakingIndex !== null && (
            <div 
              className="flex items-center justify-between px-3 py-1.5 bg-amber-50 text-amber-900 border-2 border-amber-300 rounded-xl text-xs shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span className="font-bold">Sedang membacakan balasan suara...</span>
              </div>
              <button
                type="button"
                onClick={stopAllSpeech}
                className="flex items-center gap-1 px-2.5 py-0.5 bg-red-600 text-white rounded-lg font-extrabold hover:bg-red-700 transition-colors shadow-xs"
                title="Hentikan semua suara sekarang"
              >
                <VolumeX className="w-3 h-3" />
                Stop Suara
              </button>
            </div>
          )}

          {/* Listening Audio Indicator */}
          {isListening && (
            <div 
              className="flex items-center justify-between px-3 py-2 bg-red-50 text-red-700 border-2 border-red-300 rounded-xl animate-pulse text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="font-bold">Mendengarkan ucapan Anda (Bahasa Indonesia)...</span>
              </div>
              <button
                onClick={toggleListening}
                className="px-2 py-0.5 bg-red-600 text-white rounded-lg font-black hover:bg-red-700 transition-colors"
              >
                Stop
              </button>
            </div>
          )}

          {/* Reply Context Banner Preview */}
          {replyingTo && (
            <div 
              className="flex items-center justify-between px-3 py-1.5 bg-white/95 border-2 rounded-xl text-xs transition-all"
              style={{ borderColor: theme.border, boxShadow: `2px 2px 0px ${theme.shadow}` }}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Reply className="w-3.5 h-3.5 shrink-0 text-violet-600" />
                <div className="truncate">
                  <span className="font-extrabold text-[11px] text-zinc-600 mr-1">
                    Membalas {replyingTo.role === 'user' ? 'Anda' : 'Violet AI'}:
                  </span>
                  <span className="italic text-zinc-500 truncate text-[11px]">{replyingTo.text}</span>
                </div>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-zinc-100 rounded-md text-zinc-500 ml-2 shrink-0"
                title="Batalkan balasan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attached image preview indicator */}
          {attachedImage && (
            <div 
              className="flex items-center gap-2.5 p-2 bg-white rounded-xl border-2 w-fit"
              style={{ borderColor: theme.border, boxShadow: `2px 2px 0px ${theme.shadow}` }}
            >
              <img src={attachedImage.preview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-zinc-200" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-700">Gambar Terlampir</span>
                <span className="text-[10px] text-zinc-400">Siap dianalisa</span>
              </div>
              <button 
                onClick={() => setAttachedImage(null)}
                className="p-1 hover:bg-zinc-100 rounded-md text-zinc-500"
                title="Hapus gambar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Compact Input Box */}
          <div 
            className="relative flex items-end rounded-2xl bg-white border-2 transition-all focus-within:translate-y-0.5"
            style={{
              borderColor: theme.border,
              boxShadow: `3px 3px 0px ${theme.shadow}`
            }}
          >
            {/* Attachment Button */}
            <label 
              className="p-2.5 mb-1 ml-1.5 rounded-xl cursor-pointer hover:bg-zinc-100 transition-colors flex items-center justify-center shrink-0"
              title="Lampirkan Gambar untuk Analisa Visi"
            >
              <Paperclip className="w-4 h-4 text-zinc-500 hover:text-zinc-800" />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageAttachment} 
              />
            </label>

            {/* Microphone Button (Speech to Text in Indonesian) */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 mb-1 ml-0.5 rounded-xl cursor-pointer transition-all flex items-center justify-center shrink-0 ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse shadow-md' 
                  : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800'
              }`}
              title={isListening ? "Mendengarkan... (Klik untuk stop)" : "Bicara dengan Suara (Bahasa Indonesia)"}
            >
              {isListening ? <Mic className="w-4 h-4 text-white animate-bounce" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Sticker Button */}
            <button
              type="button"
              onClick={() => setIsStickerPickerOpen(true)}
              className={`p-2.5 mb-1 ml-0.5 rounded-xl cursor-pointer transition-all flex items-center justify-center shrink-0 hover:bg-zinc-100 text-zinc-500 hover:text-violet-600 ${
                isStickerPickerOpen ? 'bg-violet-100 text-violet-600' : ''
              }`}
              title="Pilih Stiker Anime Cat (Kirim Stiker)"
            >
              <Smile className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                isListening 
                  ? "Sedang mendengarkan ucapan Anda..." 
                  : targetLang !== 'off' 
                    ? `Bicara / ketik -> terjemahkan ke ${TRANSLATE_LANGUAGES.find(l => l.code === targetLang)?.label}...` 
                    : attachedImage 
                      ? "Tanyakan sesuatu tentang gambar ini..." 
                      : replyingTo 
                        ? "Ketik balasan Anda..."
                        : "Ask Violet something (atau klik mikrofon untuk bicara)..."
              }
              className="w-full bg-transparent rounded-2xl pl-1.5 pr-12 py-2.5 text-sm sm:text-[15px] font-medium placeholder:opacity-40 focus:outline-none resize-none max-h-36 min-h-[44px]"
              style={{ color: theme.textDark }}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() && !attachedImage}
              className="absolute right-1.5 bottom-1.5 p-2 rounded-xl border-2 text-white disabled:opacity-50 disabled:bg-zinc-300 disabled:border-zinc-400 disabled:text-zinc-500 transition-all active:shadow-none active:translate-y-[1px]"
              style={{
                backgroundColor: theme.primary,
                borderColor: theme.border,
                boxShadow: `1.5px 1.5px 0px ${theme.shadow}`
              }}
              title="Kirim pesan (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      
      {/* Zoom Action Modal */}
      {isActionZoomed && currentActionDetails && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="bg-zinc-900 border-4 rounded-3xl w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl max-h-[80vh]"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b-2 border-zinc-700">
              <div className="flex items-center gap-2 text-zinc-100 font-mono text-sm">
                <Sparkles className="w-4 h-4 animate-spin text-yellow-400" />
                <span>{currentActionDetails.name}</span>
              </div>
              <button 
                onClick={() => setIsActionZoomed(false)}
                className="p-1 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-zinc-300 space-y-4">
              <div>
                <div className="text-zinc-500 mb-1 select-none">ARGUMENTS:</div>
                <pre className="bg-black/50 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(currentActionDetails.args, null, 2)}
                </pre>
              </div>
              
              {currentActionDetails.result && (
                <div>
                  <div className="text-zinc-500 mb-1 select-none">RESULT:</div>
                  <pre className="bg-black/50 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap break-words text-green-400">
                    {currentActionDetails.result}
                  </pre>
                </div>
              )}
              
              {!currentActionDetails.result && (
                <div className="flex items-center gap-2 text-yellow-500 animate-pulse mt-4">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  Running...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white border-4 rounded-3xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]"
            style={{
              borderColor: theme.border,
              boxShadow: `8px 8px 0px ${theme.shadow}`
            }}
          >
            <div 
              className="flex items-center justify-between px-6 py-4 border-b-4"
              style={{ backgroundColor: theme.lightTint, borderColor: theme.border }}
            >
              <h2 className="font-black text-xl" style={{ color: theme.textDark }}>Customization & Settings</h2>
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="hover:opacity-75 transition-colors bg-white border-2 rounded-lg p-1"
                style={{ borderColor: theme.border, color: theme.textDark }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto">
              
              {/* Appearance */}
              <div className="space-y-4">
                <label className="text-sm font-black uppercase tracking-widest flex items-center gap-2" style={{ color: theme.textDark }}>
                  <Palette className="w-4 h-4" /> Appearance (Auto-Adaptive Theme)
                </label>
                
                <div className="space-y-3">
                  <p className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                    Solid Background Color <Sparkles className="w-3.5 h-3.5 text-amber-500 inline" />
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { hex: '#fef2f2', label: 'Pink Rose' },
                      { hex: '#fdf4ff', label: 'Violet Soft' },
                      { hex: '#e0e7ff', label: 'Indigo Sky' },
                      { hex: '#fffbeb', label: 'Warm Amber' },
                      { hex: '#f0fdf4', label: 'Emerald Mint' },
                      { hex: '#f0f9ff', label: 'Cyan Ocean' },
                      { hex: '#fafafa', label: 'Classic Gray' }
                    ].map(item => (
                      <button
                        key={item.hex}
                        onClick={() => { setBgColor(item.hex); setBgImage(''); }}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${bgColor === item.hex && !bgImage ? 'scale-110' : 'border-zinc-200'}`}
                        style={{ 
                          backgroundColor: item.hex,
                          borderColor: bgColor === item.hex && !bgImage ? theme.border : undefined,
                          boxShadow: bgColor === item.hex && !bgImage ? `2px 2px 0px ${theme.shadow}` : undefined
                        }}
                        title={item.label}
                      />
                    ))}
                    <div 
                      className="relative overflow-hidden w-10 h-10 rounded-full border-2 flex items-center justify-center bg-gradient-to-br from-pink-300 via-purple-300 to-indigo-300 hover:scale-110 transition-transform cursor-pointer"
                      style={{ borderColor: theme.border }}
                      title="Custom Color Picker"
                    >
                       <input 
                         type="color" 
                         value={bgColor} 
                         onChange={(e) => { setBgColor(e.target.value); setBgImage(''); }}
                         className="absolute inset-0 w-14 h-14 -top-2 -left-2 opacity-0 cursor-pointer"
                       />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-400">
                    Semua warna garis, bayangan, tombol, dan balon chat akan otomatis menyesuaikan dengan warna background!
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-zinc-500">Custom Background Image</p>
                  <label 
                    className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all font-bold text-sm"
                    style={{ 
                      backgroundColor: theme.lighterTint, 
                      borderColor: theme.border,
                      color: theme.textDark 
                    }}
                  >
                    <ImageIcon className="w-5 h-5" />
                    Upload Image (Auto-Adapts Colors)
                    <input type="file" accept="image/*" onChange={handleBgImageUpload} className="hidden" />
                  </label>
                  {bgImage && (
                    <button onClick={() => setBgImage('')} className="text-xs font-bold text-red-500 hover:underline">
                      Remove Custom Image
                    </button>
                  )}
                </div>
              </div>

              {/* Gateway & Model Selection */}
              <div 
                className="p-4 rounded-2xl border-2 space-y-3" 
                style={{ 
                  backgroundColor: theme.lighterTint, 
                  borderColor: theme.border,
                  boxShadow: `2px 2px 0px ${theme.shadow}`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-xs">
                      <Zap className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black leading-tight" style={{ color: theme.textDark }}>Gateway AI Multi-Provider</h4>
                      <p className="text-[11px] font-bold text-zinc-600">
                        Aktif: <strong style={{ color: theme.textDark }}>{formatProviderLabel(gatewayState?.activeProviderId)}</strong> ({formatModelLabel(gatewayState?.activeModelId)})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsNineRouterOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-white border-2 hover:bg-zinc-50 transition-all shadow-xs cursor-pointer"
                    style={{ borderColor: theme.border, color: theme.textDark }}
                  >
                    Buka Gateway →
                  </button>
                </div>
                <p className="text-xs font-medium text-zinc-600 leading-relaxed">
                  Pilihan model AI (Gemini 2.5, OpenRouter, Claude, OpenAI, DeepSeek, Groq, dll.) serta kunci API multi-provider dikonfigurasi melalui menu <strong>Gateway</strong>.
                </p>
              </div>
              
              {/* API Key */}
              <div className="space-y-3">
                <label className="text-sm font-black uppercase tracking-widest flex justify-between" style={{ color: theme.textDark }}>
                  <span>Custom Gemini API Key</span>
                  {apiKey && (
                    <span className="text-xs font-bold text-emerald-600">Aktif</span>
                  )}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Paste AI Studio Gemini API Key (AIzaSy...)..."
                  className="w-full bg-zinc-50 border-2 border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none transition-all text-zinc-900"
                  style={{
                    borderColor: apiKey ? theme.border : undefined
                  }}
                />
                <div className="flex flex-col gap-1 text-xs">
                  <p className="font-medium text-zinc-500">
                    Masukkan Gemini API Key pribadi Anda jika kunci bawaan server sedang limit atau sibuk. Kunci tersimpan aman secara lokal di browser Anda.
                  </p>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ color: theme.primary }}
                  >
                    Dapatkan Gemini API Key Gratis di Google AI Studio →
                  </a>
                </div>
              </div>

              {/* Chat Preferences */}
              <div className="space-y-3 pt-2 border-t-2 border-zinc-200">
                <label className="text-sm font-black uppercase tracking-widest text-zinc-800 flex items-center gap-2">
                  <Copy className="w-4 h-4" /> Preferensi Chat
                </label>
                
                <div className="flex items-center justify-between p-3 rounded-xl border-2 border-zinc-200 bg-zinc-50">
                  <div>
                    <p className="text-xs font-bold text-zinc-800">Auto-Salin Balasan (Clipboard)</p>
                    <p className="text-[11px] text-zinc-500">Otomatis menyalin teks respons AI ke clipboard setelah selesai dibuat.</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !autoCopy;
                      setAutoCopy(next);
                      showToast(next ? "Auto-Salin diaktifkan! 📋" : "Auto-Salin dinonaktifkan");
                    }}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      autoCopy ? 'bg-violet-600 justify-end' : 'bg-zinc-300 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border-2 border-zinc-200 bg-zinc-50">
                  <div>
                    <p className="text-xs font-bold text-zinc-800">Ekspor Obrolan</p>
                    <p className="text-[11px] text-zinc-500">Unduh seluruh riwayat percakapan dalam format Markdown (.md).</p>
                  </div>
                  <button
                    onClick={exportChat}
                    disabled={messages.length === 0}
                    className="px-3 py-1.5 bg-white border-2 border-zinc-300 rounded-lg text-xs font-bold hover:bg-zinc-100 disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Unduh
                  </button>
                </div>
              </div>

              {/* Data Management */}
              <div className="space-y-3 pt-2 border-t-2 border-zinc-200">
                <label className="text-sm font-black uppercase tracking-widest text-zinc-800">Data Management</label>
                {showClearChatConfirm ? (
                  <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl space-y-2.5">
                    <p className="text-xs font-bold text-red-700">
                      ⚠️ Yakin ingin menghapus seluruh riwayat obrolan {messages.length > 0 ? `(${messages.length} pesan)` : ''}?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowClearChatConfirm(false)}
                        className="flex-1 py-1.5 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={executeClearChat}
                        className="flex-1 py-1.5 px-3 bg-red-600 text-white rounded-lg text-xs font-black hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Ya, Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={clearChat}
                    disabled={messages.length === 0}
                    className="w-full px-4 py-2.5 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl font-bold hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All Chat History {messages.length > 0 ? `(${messages.length} pesan)` : '(Kosong)'}
                  </button>
                )}
              </div>
            </div>
            
            <div 
              className="px-6 py-4 border-t-4 flex justify-end"
              style={{ backgroundColor: theme.lightTint, borderColor: theme.border }}
            >
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-3 text-white border-2 rounded-xl text-sm font-black transition-all active:translate-y-1 active:translate-x-1"
                style={{
                  backgroundColor: theme.primary,
                  borderColor: theme.border,
                  boxShadow: `4px 4px 0px ${theme.shadow}`
                }}
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Unified Hermes Agent & Workspace Modal */}
      {isWorkspaceOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white border-4 rounded-3xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[88vh]"
            style={{
              borderColor: theme.border,
              boxShadow: `8px 8px 0px ${theme.shadow}`
            }}
          >
            {/* Modal Header */}
            <div 
              className="flex items-center justify-between px-6 py-4 border-b-4"
              style={{ backgroundColor: theme.lightTint, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2.5">
                <Folder className="w-6 h-6" style={{ color: theme.textDark }} />
                <div>
                  <h2 className="font-black text-lg leading-tight" style={{ color: theme.textDark }}>Hermes Agent Workspace</h2>
                  <p className="text-[11px] font-bold text-zinc-500">Skills, memory files, autonomous todos & cron background jobs</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsWorkspaceOpen(false);
                  setSelectedSkillContent(null);
                }} 
                className="hover:opacity-75 transition-colors bg-white border-2 rounded-lg p-1"
                style={{ borderColor: theme.border, color: theme.textDark }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b-2 bg-zinc-50 px-6 gap-2 pt-2" style={{ borderColor: theme.border }}>
              <button
                onClick={() => { setWorkspaceTab('files'); loadWorkspaceFiles(); }}
                className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 ${
                  workspaceTab === 'files' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
                style={workspaceTab === 'files' ? { borderColor: theme.border, color: theme.textDark } : {}}
              >
                <Folder className="w-3.5 h-3.5" />
                Files ({workspaceFiles.length})
              </button>
              <button
                onClick={() => { setWorkspaceTab('skills'); loadHermesSkills(); }}
                className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 ${
                  workspaceTab === 'skills' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
                style={workspaceTab === 'skills' ? { borderColor: theme.border, color: theme.textDark } : {}}
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                Hermes Skills ({hermesSkills.length})
              </button>
              <button
                onClick={() => { setWorkspaceTab('todos'); loadHermesTodos(); }}
                className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 ${
                  workspaceTab === 'todos' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
                style={workspaceTab === 'todos' ? { borderColor: theme.border, color: theme.textDark } : {}}
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                Todos ({hermesTodos.length})
              </button>
              <button
                onClick={() => { setWorkspaceTab('cron'); loadHermesCronjobs(); }}
                className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 ${
                  workspaceTab === 'cron' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
                style={workspaceTab === 'cron' ? { borderColor: theme.border, color: theme.textDark } : {}}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Cron Jobs ({hermesCronjobs.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {workspaceTab === 'files' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-zinc-500">
                      File workspace tersimpan di <code className="bg-zinc-100 px-1.5 py-0.5 rounded border">/workspace</code>.
                    </p>
                    <button
                      onClick={loadWorkspaceFiles}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg border hover:bg-zinc-50 flex items-center gap-1"
                      style={{ borderColor: theme.border }}
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {loadingFiles ? (
                    <div className="py-12 text-center text-zinc-400 font-bold">Memuat file workspace...</div>
                  ) : workspaceFiles.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center gap-2 text-zinc-400">
                      <Folder className="w-12 h-12 stroke-[1.5] opacity-40" />
                      <p className="font-bold text-sm">Belum ada file di workspace.</p>
                      <p className="text-xs">Minta Violet AI menulis file (contoh: "Violet, tolong simpan ringkasan ini ke catatan.md").</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workspaceFiles.map(file => (
                        <div 
                          key={file.name}
                          className="flex items-center justify-between p-3 rounded-xl border-2 hover:border-zinc-400 transition-colors bg-zinc-50"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-white rounded-lg border text-zinc-600">
                              <Folder className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-bold text-zinc-800 truncate">{file.name}</p>
                              <p className="text-[11px] text-zinc-400 font-medium">
                                {(file.size / 1024).toFixed(1)} KB • {new Date(file.updatedAt).toLocaleDateString('id-ID')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <a 
                              href={`/api/workspace/files/${encodeURIComponent(file.name)}`}
                              download={file.name}
                              className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-zinc-300 text-zinc-600 transition-colors"
                              title="Unduh File"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => deleteWorkspaceFile(file.name)}
                              className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="Hapus File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {workspaceTab === 'skills' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-zinc-500">
                      Pustaka prosedur keahlian Hermes Agent di <code className="bg-zinc-100 px-1.5 py-0.5 rounded border">./hermes-skills</code>.
                    </p>
                    <button
                      onClick={loadHermesSkills}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg border hover:bg-zinc-50 flex items-center gap-1"
                      style={{ borderColor: theme.border }}
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {selectedSkillContent ? (
                    <div className="border-2 rounded-2xl p-4 bg-zinc-50 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-black text-sm text-zinc-800 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-purple-600" />
                          {selectedSkillContent.name}
                        </span>
                        <button
                          onClick={() => setSelectedSkillContent(null)}
                          className="text-xs font-bold px-2 py-1 bg-white border rounded-lg hover:bg-zinc-100"
                        >
                          Kembali ke Daftar
                        </button>
                      </div>
                      <pre className="text-xs font-mono bg-white p-3 rounded-xl border max-h-72 overflow-y-auto whitespace-pre-wrap text-zinc-700">
                        {selectedSkillContent.content}
                      </pre>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                      {hermesSkills.map(skill => (
                        <div 
                          key={skill.path}
                          className="p-3 bg-zinc-50 border-2 rounded-xl hover:border-purple-400 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-xs text-zinc-800 truncate">{skill.name}</span>
                              <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                {skill.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-2">{skill.description}</p>
                          </div>
                          <div className="mt-2.5 flex justify-end">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/hermes-skills/${skill.path}`);
                                  const txt = await res.text();
                                  setSelectedSkillContent({ name: skill.name, content: txt });
                                } catch {
                                  setSelectedSkillContent({ name: skill.name, content: "Gagal memuat isi skill." });
                                }
                              }}
                              className="text-[10px] font-bold px-2 py-1 rounded-md bg-white border hover:bg-purple-50 hover:text-purple-700 transition-colors"
                            >
                              Buka Prosedur
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {workspaceTab === 'todos' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-zinc-500">
                      Rencana tindakan & tugas otonom Violet AI.
                    </p>
                    <button
                      onClick={loadHermesTodos}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg border hover:bg-zinc-50 flex items-center gap-1"
                      style={{ borderColor: theme.border }}
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {hermesTodos.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center gap-2 text-zinc-400">
                      <CheckSquare className="w-12 h-12 stroke-[1.5] opacity-40 text-emerald-500" />
                      <p className="font-bold text-sm">Belum ada tugas di daftar Todo.</p>
                      <p className="text-xs">Minta Violet membuat rencana (contoh: "Violet, tolong buatkan todo list riset pasar emas").</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hermesTodos.map(todo => (
                        <div 
                          key={todo.id}
                          className="flex items-center justify-between p-3 rounded-xl border-2 bg-zinc-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full ${
                              todo.status === 'completed' ? 'bg-emerald-500' :
                              todo.status === 'in_progress' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-300'
                            }`} />
                            <div>
                              <p className={`text-sm font-bold ${todo.status === 'completed' ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                                {todo.task}
                              </p>
                              <span className="text-[10px] text-zinc-400 font-medium">
                                #{todo.id} • Status: {todo.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {workspaceTab === 'cron' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-zinc-500">
                      Tugas terjadwal latar belakang (Background Cron Engine).
                    </p>
                    <button
                      onClick={loadHermesCronjobs}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg border hover:bg-zinc-50 flex items-center gap-1"
                      style={{ borderColor: theme.border }}
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {hermesCronjobs.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center gap-2 text-zinc-400">
                      <Clock className="w-12 h-12 stroke-[1.5] opacity-40 text-amber-500" />
                      <p className="font-bold text-sm">Belum ada jadwal tugas berkala.</p>
                      <p className="text-xs">Minta Violet menjadwalkan tugas (contoh: "Violet, jadwalkan cek harga emas setiap 60 menit").</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hermesCronjobs.map(cron => (
                        <div 
                          key={cron.id}
                          className="p-3 rounded-xl border-2 bg-zinc-50 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-zinc-800">{cron.title}</span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              {cron.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600">{cron.task}</p>
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                            <span>Setiap {cron.intervalMinutes} menit • Total eksekusi: {cron.runCount}x</span>
                            <span>Terakhir: {cron.lastRunAt ? new Date(cron.lastRunAt).toLocaleTimeString('id-ID') : 'Belum jalan'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div 
              className="px-6 py-4 border-t-4 flex justify-between items-center"
              style={{ backgroundColor: theme.lightTint, borderColor: theme.border }}
            >
              <span className="text-xs font-bold text-zinc-500">
                Hermes Agent Architecture v2.0
              </span>
              <button
                onClick={() => {
                  setIsWorkspaceOpen(false);
                  setSelectedSkillContent(null);
                }}
                className="px-5 py-2 text-white border-2 rounded-xl text-xs font-black transition-all"
                style={{
                  backgroundColor: theme.primary,
                  borderColor: theme.border,
                  boxShadow: `2px 2px 0px ${theme.shadow}`
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom Gambar */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition-colors"
            onClick={() => setZoomedImage(null)}
            title="Tutup (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={zoomedImage} 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl cursor-default" 
            onClick={(e) => e.stopPropagation()} 
            alt="Zoomed preview"
          />
        </div>
      )}

      {/* Modal Konfirmasi Hapus Semua Riwayat Chat */}
      {showClearChatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div 
            className="w-full max-w-sm bg-white rounded-2xl border-3 p-5 shadow-2xl space-y-4"
            style={{ 
              borderColor: theme.border, 
              boxShadow: `6px 6px 0px ${theme.shadow}` 
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl border border-red-200 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900">Hapus Semua Riwayat?</h3>
                <p className="text-[11px] font-semibold text-zinc-500">Tindakan ini permanen</p>
              </div>
            </div>
            
            <p className="text-xs font-semibold text-zinc-600 leading-relaxed">
              Semua {messages.length > 0 ? `${messages.length} pesan ` : ''}riwayat obrolan dengan Violet AI akan dihapus secara permanen dari browser ini. Lanjutkan?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearChatConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border-2 text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-all cursor-pointer"
                style={{ borderColor: theme.border }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeClearChat}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus File Workspace */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div 
            className="w-full max-w-sm bg-white rounded-2xl border-3 p-5 shadow-2xl space-y-4"
            style={{ 
              borderColor: theme.border, 
              boxShadow: `6px 6px 0px ${theme.shadow}` 
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl border border-red-200 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900">Hapus File Workspace?</h3>
                <p className="text-[11px] font-semibold text-zinc-500">File akan dihapus dari server</p>
              </div>
            </div>
            
            <p className="text-xs font-semibold text-zinc-600 leading-relaxed">
              Yakin ingin menghapus file <strong className="text-zinc-900 break-all font-bold">'{fileToDelete}'</strong> dari workspace?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border-2 text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-all cursor-pointer"
                style={{ borderColor: theme.border }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteWorkspaceFile}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticker Picker Modal */}
      <StickerPicker
        isOpen={isStickerPickerOpen}
        onClose={() => setIsStickerPickerOpen(false)}
        onSelectSticker={sendStickerMessage}
        theme={theme}
      />

      {/* 9Router AI Gateway & Token Saver Modal */}
      <NineRouterModal
        isOpen={isNineRouterOpen}
        onClose={() => setIsNineRouterOpen(false)}
        theme={theme}
      />
    </div>
  );
}
