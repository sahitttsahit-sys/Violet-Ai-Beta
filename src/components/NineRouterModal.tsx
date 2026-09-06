import React, { useState, useEffect } from 'react';
import { 
  X, Check, Zap, Cpu, Layers, RefreshCw, Shield, 
  Terminal, Globe, Activity, ArrowRight, Copy, CheckCircle2,
  AlertCircle, Sparkles, Sliders, Key, Plus, Trash2, Edit3, Server,
  Power, ToggleLeft, ToggleRight
} from 'lucide-react';

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
  enabled?: boolean;
  models: ModelConfig[];
  status: "active" | "configured" | "unconfigured" | "error";
  latencyMs?: number;
  lastChecked?: string;
}

export interface ComboConfig {
  id: string;
  name: string;
  description: string;
  models: string[];
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

interface NineRouterModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: {
    primary: string;
    border: string;
    shadow: string;
    textDark: string;
    lightTint: string;
  };
  onSelectModelOrCombo?: (name: string) => void;
}

export const NineRouterModal: React.FC<NineRouterModalProps> = ({
  isOpen,
  onClose,
  theme,
  onSelectModelOrCombo
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'combos' | 'rtk' | 'cli' | 'stats'>('providers');
  const [routerState, setRouterState] = useState<NineRouterState | null>(null);
  const [loading, setLoading] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [editingProviderKey, setEditingProviderKey] = useState<{ id: string; key: string } | null>(null);
  
  // Custom Provider Form State
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [newProvId, setNewProvId] = useState('');
  const [newProvName, setNewProvName] = useState('');
  const [newProvBaseUrl, setNewProvBaseUrl] = useState('');
  const [newProvApiKey, setNewProvApiKey] = useState('');
  const [newProvCategory, setNewProvCategory] = useState<'commercial' | 'inexpensive' | 'free' | 'local'>('commercial');
  const [newProvModelId, setNewProvModelId] = useState('');
  const [newProvModelName, setNewProvModelName] = useState('');
  
  // Model creation input per provider
  const [newModelInput, setNewModelInput] = useState<Record<string, { id: string; name: string; showInput?: boolean }>>({});
  
  // Custom Combo Form State
  const [showAddComboModal, setShowAddComboModal] = useState(false);
  const [newComboName, setNewComboName] = useState('');
  const [newComboDesc, setNewComboDesc] = useState('');
  const [newComboTiers, setNewComboTiers] = useState<string[]>(['gemini/gemini-3.7-flash', 'gemini/gemini-3.8-flash', 'gemini/gemini-flash-latest']);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchState = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/9router/state');
      if (res.ok) {
        const data = await res.json();
        setRouterState(data);
      }
    } catch (e) {
      console.error('Failed to fetch 9Router state', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchState();
    }
  }, [isOpen]);

  const handleAddCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvName) return;
    const finalId = (newProvId.trim() || newProvName.toLowerCase().replace(/[^a-z0-9_]/g, '_')).trim();
    const modelId = newProvModelId.trim() || `${finalId}-default`;
    const modelName = newProvModelName.trim() || `${newProvName} Default Model`;
    
    try {
      const res = await fetch('/api/9router/provider/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: finalId,
          name: newProvName.trim(),
          category: newProvCategory,
          description: `Provider kustom ${newProvName.trim()}`,
          baseUrl: newProvBaseUrl.trim() || undefined,
          apiKey: newProvApiKey.trim() || undefined,
          enabled: true,
          models: [{ id: modelId, name: modelName, isDefault: true }]
        })
      });
      if (res.ok) {
        setShowAddProviderModal(false);
        setNewProvId('');
        setNewProvName('');
        setNewProvBaseUrl('');
        setNewProvApiKey('');
        setNewProvModelId('');
        setNewProvModelName('');
        fetchState();
      }
    } catch (e) {
      console.error('Error adding custom provider', e);
    }
  };

  const handleDeleteProvider = async (providerId: string, providerName: string) => {
    if (providerId === 'gemini') {
      alert('Provider Google Gemini utama tidak dapat dihapus.');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus provider "${providerName}" (${providerId})?`)) return;
    try {
      const res = await fetch(`/api/9router/provider/${providerId}`, { method: 'DELETE' });
      if (res.ok) fetchState();
    } catch (e) {
      console.error('Error deleting provider', e);
    }
  };

  const handleAddModel = async (providerId: string) => {
    const inp = newModelInput[providerId];
    if (!inp || !inp.id) return;
    try {
      const res = await fetch(`/api/9router/provider/${providerId}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inp.id.trim(), name: inp.name?.trim() || inp.id.trim() })
      });
      if (res.ok) {
        setNewModelInput({ ...newModelInput, [providerId]: { id: '', name: '', showInput: false } });
        fetchState();
      }
    } catch (e) {
      console.error('Error adding model', e);
    }
  };

  const handleDeleteModel = async (providerId: string, modelId: string, modelName: string) => {
    if (!confirm(`Hapus model "${modelName || modelId}" dari provider ini?`)) return;
    try {
      const res = await fetch(`/api/9router/provider/${providerId}/model/${modelId}`, { method: 'DELETE' });
      if (res.ok) fetchState();
    } catch (e) {
      console.error('Error deleting model', e);
    }
  };

  // Create / Edit Custom Combo
  const handleSaveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComboName) return;
    const cleanTiers = newComboTiers.filter(t => t.trim().length > 0);
    if (cleanTiers.length === 0) {
      alert('Pilih setidaknya 1 model untuk fallback cascade combo ini.');
      return;
    }
    const comboId = `combo-${newComboName.toLowerCase().replace(/[^a-z0-9_]/g, '-')}-${Date.now().toString().slice(-4)}`;
    const description = newComboDesc.trim() || cleanTiers.map((t, i) => `T${i+1}: ${t.split('/')[1] || t}`).join(' ➔ ');

    try {
      const res = await fetch('/api/9router/combo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: comboId,
          name: newComboName.trim(),
          description,
          models: cleanTiers
        })
      });
      if (res.ok) {
        setShowAddComboModal(false);
        setNewComboName('');
        setNewComboDesc('');
        fetchState();
      }
    } catch (e) {
      console.error('Error saving combo', e);
    }
  };

  const handleDeleteCombo = async (comboId: string, comboName: string) => {
    if (!confirm(`Hapus Fallback Combo "${comboName}"?`)) return;
    try {
      const res = await fetch(`/api/9router/combo/${comboId}`, { method: 'DELETE' });
      if (res.ok) fetchState();
    } catch (e) {
      console.error('Error deleting combo', e);
    }
  };

  const handleToggleGateway = async () => {
    try {
      const res = await fetch('/api/9router/gateway/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (routerState) {
          setRouterState({ ...routerState, gatewayEnabled: data.gatewayEnabled });
        }
      }
    } catch (e) {
      console.error('Error toggling Gateway', e);
    }
  };

  const handleToggleRtk = async () => {
    try {
      const res = await fetch('/api/9router/rtk/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (routerState) {
          setRouterState({ ...routerState, rtkEnabled: data.rtkEnabled });
        }
      }
    } catch (e) {
      console.error('Error toggling RTK', e);
    }
  };

  const handleToggleProvider = async (providerId: string, currentEnabled: boolean = true) => {
    try {
      const res = await fetch(`/api/9router/provider/${providerId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        fetchState();
      }
    } catch (e) {
      console.error('Error toggling provider', e);
    }
  };

  const handleToggleModel = async (providerId: string, modelId: string, currentEnabled: boolean = true) => {
    try {
      const res = await fetch(`/api/9router/provider/${providerId}/model/${modelId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        fetchState();
      }
    } catch (e) {
      console.error('Error toggling model', e);
    }
  };

  const handleToggleCombo = async (comboId: string, currentEnabled: boolean = true) => {
    try {
      const res = await fetch(`/api/9router/combo/${comboId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        fetchState();
      }
    } catch (e) {
      console.error('Error toggling combo', e);
    }
  };

  const handleDeactivateCombo = async () => {
    try {
      const res = await fetch('/api/9router/combo/deactivate', { method: 'POST' });
      if (res.ok) {
        fetchState();
        if (onSelectModelOrCombo && routerState) {
          onSelectModelOrCombo(`${routerState.activeProviderId}/${routerState.activeModelId}`);
        }
      }
    } catch (e) {
      console.error('Error deactivating combo', e);
    }
  };

  const handlePing = async (providerId: string) => {
    setPingingId(providerId);
    try {
      const res = await fetch('/api/9router/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      if (routerState && routerState.providers[providerId]) {
        setRouterState({
          ...routerState,
          providers: {
            ...routerState.providers,
            [providerId]: {
              ...routerState.providers[providerId],
              latencyMs: data.latencyMs,
              status: data.success ? 'active' : 'error'
            }
          }
        });
      }
    } catch (e) {
      console.error('Ping failed', e);
    } finally {
      setPingingId(null);
    }
  };

  const handleSaveKey = async (providerId: string, apiKey: string) => {
    try {
      const res = await fetch('/api/9router/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey: apiKey.trim(), enabled: true })
      });
      if (res.ok) {
        setEditingProviderKey(null);
        fetchState();
      }
    } catch (e) {
      console.error('Error saving provider key', e);
    }
  };

  const handleSetActive = async (providerId: string, modelId: string, comboId?: string) => {
    try {
      const res = await fetch('/api/9router/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, modelId, comboId })
      });
      if (res.ok) {
        fetchState();
        if (onSelectModelOrCombo) {
          onSelectModelOrCombo(comboId ? `Combo: ${comboId}` : `${providerId}/${modelId}`);
        }
      }
    } catch (e) {
      console.error('Error setting active route', e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get all registered models for combo builder dropdown
  const allAvailableModels: { fullId: string; label: string; providerName: string }[] = [];
  if (routerState) {
    Object.values(routerState.providers).forEach(prov => {
      prov.models.forEach(m => {
        allAvailableModels.push({
          fullId: `${prov.id}/${m.id}`,
          label: `${m.name || m.id} (${prov.name})`,
          providerName: prov.name
        });
      });
    });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white border-4 rounded-3xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh] shadow-2xl"
        style={{ borderColor: theme.border, boxShadow: `8px 8px 0px ${theme.shadow}` }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b-4 shrink-0"
          style={{ backgroundColor: theme.lightTint, borderColor: theme.border }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white font-black text-xl shadow-md border-2 border-zinc-900 shrink-0">
              <Zap className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg sm:text-xl leading-tight" style={{ color: theme.textDark }}>
                  AI Gateway Manager
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Universal Hub
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-zinc-500">
                Kustomisasi Provider & Model • Buat Fallback Combo • RTK Token Saver
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="hover:opacity-75 transition-colors bg-white border-2 rounded-xl p-1.5 shrink-0"
            style={{ borderColor: theme.border, color: theme.textDark }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b-2 bg-zinc-50 px-4 sm:px-6 gap-2 pt-2.5 overflow-x-auto shrink-0 scrollbar-thin" style={{ borderColor: theme.border }}>
          <button
            onClick={() => setActiveTab('providers')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'providers' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
            style={activeTab === 'providers' ? { borderColor: theme.border, color: theme.textDark } : {}}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            Provider & Model ({Object.keys(routerState?.providers || {}).length})
          </button>
          <button
            onClick={() => setActiveTab('combos')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'combos' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
            style={activeTab === 'combos' ? { borderColor: theme.border, color: theme.textDark } : {}}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            Fallback Cascade ({routerState?.combos?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('rtk')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'rtk' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
            style={activeTab === 'rtk' ? { borderColor: theme.border, color: theme.textDark } : {}}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            RTK Token Saver
            {routerState?.rtkEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('cli')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'cli' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
            style={activeTab === 'cli' ? { borderColor: theme.border, color: theme.textDark } : {}}
          >
            <Terminal className="w-3.5 h-3.5 text-purple-600" />
            CLI & Connect
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'stats' ? 'bg-white border-b-transparent translate-y-[2px]' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
            style={activeTab === 'stats' ? { borderColor: theme.border, color: theme.textDark } : {}}
          >
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Statistik & Kuota
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 min-h-0">
          {/* Active Route Summary Banner */}
          {routerState && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md border-2 border-zinc-950">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                    Mode AI yang Sedang Aktif:
                  </span>
                  <div className="font-bold text-sm text-zinc-100 flex items-center gap-1.5 flex-wrap">
                    {routerState.activeComboId ? (
                      <>
                        <span className="bg-amber-500 text-zinc-900 font-black px-2 py-0.5 rounded-lg text-xs">
                          Fallback Cascade
                        </span>
                        <span>{routerState.combos.find(c => c.id === routerState.activeComboId)?.name || routerState.activeComboId}</span>
                        <button
                          onClick={handleDeactivateCombo}
                          className="ml-2 px-2.5 py-0.5 text-[11px] font-bold bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg flex items-center gap-1 transition-colors border border-rose-400/40"
                          title="Nonaktifkan Fallback Cascade dan kembali ke model tunggal"
                        >
                          <Power className="w-3 h-3" /> Nonaktifkan Fallback
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="bg-indigo-500 text-white font-black px-2 py-0.5 rounded-lg text-xs uppercase">
                          {routerState.activeProviderId}
                        </span>
                        <span className="font-mono text-emerald-300">{routerState.activeModelId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {routerState.rtkEnabled && (
                  <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded-lg flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" /> RTK Aktif
                  </span>
                )}
                <span className="text-[11px] font-medium text-zinc-400">
                  Semua interaksi AI berjalan via Gateway ini
                </span>
              </div>
            </div>
          )}

          {loading && !routerState ? (
            <div className="py-16 text-center text-zinc-400 font-bold flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              Memuat konfigurasi Gateway...
            </div>
          ) : null}

          {/* TAB 1: PROVIDERS & MODELS */}
          {activeTab === 'providers' && routerState && (
            <div className="space-y-4">
              {/* Top Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
                <div>
                  <h3 className="font-black text-sm text-zinc-900">Daftar Provider & Model AI</h3>
                  <p className="text-xs text-zinc-500">
                    Gunakan model bawaan Google Gemini atau tambahkan provider Anda sendiri (OpenRouter, Groq, Ollama, DeepSeek, dsb).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddProviderModal(true)}
                    className="text-xs font-black px-3.5 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" /> Tambah Provider Kustom
                  </button>
                  <button
                    onClick={fetchState}
                    className="text-xs font-bold px-3 py-2 rounded-xl border bg-white hover:bg-zinc-50 flex items-center gap-1 shrink-0"
                    style={{ borderColor: theme.border }}
                    title="Segarkan data"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-600" />
                  </button>
                </div>
              </div>

              {/* Add Custom Provider Modal / Inline Form */}
              {showAddProviderModal && (
                <div className="p-4 sm:p-5 rounded-3xl border-2 border-indigo-300 bg-indigo-50/40 space-y-3.5 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-indigo-600" />
                      <h4 className="font-black text-sm text-indigo-950">Formulir Tambah Provider AI Kustom</h4>
                    </div>
                    <button
                      onClick={() => setShowAddProviderModal(false)}
                      className="text-zinc-400 hover:text-zinc-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleAddCustomProvider} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Nama Provider <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="contoh: OpenRouter / Groq / Ollama Local"
                          value={newProvName}
                          onChange={(e) => {
                            setNewProvName(e.target.value);
                            if (!newProvId) {
                              setNewProvId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                            }
                          }}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Provider ID (Slug Unik)
                        </label>
                        <input
                          type="text"
                          placeholder="contoh: openrouter / groq / ollama"
                          value={newProvId}
                          onChange={(e) => setNewProvId(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white font-mono outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Base URL Endpoint (OpenAI Compatible)
                        </label>
                        <input
                          type="text"
                          placeholder="https://openrouter.ai/api/v1 atau http://localhost:11434/v1"
                          value={newProvBaseUrl}
                          onChange={(e) => setNewProvBaseUrl(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white font-mono outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Kategori Provider
                        </label>
                        <select
                          value={newProvCategory}
                          onChange={(e: any) => setNewProvCategory(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white outline-none focus:border-indigo-500 font-semibold"
                        >
                          <option value="commercial">Commercial (OpenAI, Anthropic, xAI)</option>
                          <option value="inexpensive">Inexpensive (OpenRouter, Groq, DeepSeek)</option>
                          <option value="local">Local / Self-Hosted (Ollama, LM Studio, vLLM)</option>
                          <option value="free">Free Tier Provider</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          API Key (Opsional jika local)
                        </label>
                        <input
                          type="password"
                          placeholder="sk-or-... atau api-key"
                          value={newProvApiKey}
                          onChange={(e) => setNewProvApiKey(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white font-mono outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Model ID Awal
                        </label>
                        <input
                          type="text"
                          placeholder="contoh: anthropic/claude-3.7-sonnet"
                          value={newProvModelId}
                          onChange={(e) => setNewProvModelId(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white font-mono outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Nama Tampilan Model
                        </label>
                        <input
                          type="text"
                          placeholder="contoh: Claude 3.7 Sonnet"
                          value={newProvModelName}
                          onChange={(e) => setNewProvModelName(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddProviderModal(false)}
                        className="px-4 py-2 text-xs font-bold rounded-xl border bg-white hover:bg-zinc-100"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 text-xs font-black rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                      >
                        Simpan Provider
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Providers List */}
              <div className="space-y-4">
                {Object.values(routerState.providers).map((prov) => {
                  const isGemini = prov.id === 'gemini';
                  const isPinging = pingingId === prov.id;
                  const isEditing = editingProviderKey?.id === prov.id;
                  const isAddingModel = newModelInput[prov.id]?.showInput;

                  return (
                    <div 
                      key={prov.id}
                      className="p-4 sm:p-5 rounded-3xl border-2 bg-gradient-to-br from-zinc-50/50 via-white to-zinc-50/30 space-y-4 shadow-xs hover:border-zinc-300 transition-colors"
                      style={{ borderColor: theme.border }}
                    >
                      {/* Provider Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl font-black flex items-center justify-center text-lg shadow-md shrink-0 text-white ${
                            prov.enabled === false ? 'bg-zinc-400' : isGemini ? 'bg-indigo-600' : 'bg-zinc-800'
                          }`}>
                            {prov.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={`font-black text-base ${prov.enabled === false ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>
                                {prov.name}
                              </h3>
                              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-300">
                                {prov.category}
                              </span>
                              {prov.enabled === false ? (
                                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                  <Power className="w-2.5 h-2.5 text-rose-600" /> Nonaktif
                                </span>
                              ) : (
                                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${
                                  prov.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                  prov.status === 'configured' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                  prov.status === 'error' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                                  'bg-zinc-100 text-zinc-600 border-zinc-200'
                                }`}>
                                  {prov.status === 'configured' || prov.status === 'active' ? 'Terhubung' : prov.status === 'error' ? 'Error / Cek Key' : 'Belum Konek'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 font-medium">
                              {prov.description || (prov.baseUrl ? `Endpoint: ${prov.baseUrl}` : 'Provider AI')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Toggle Provider Enabled Switch */}
                          <button
                            onClick={() => handleToggleProvider(prov.id, prov.enabled !== false)}
                            className={`px-3 py-1.5 text-xs font-black rounded-xl border flex items-center gap-1.5 transition-colors shadow-2xs ${
                              prov.enabled !== false
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200'
                            }`}
                            title={prov.enabled !== false ? 'Klik untuk menonaktifkan provider ini' : 'Klik untuk mengaktifkan provider ini'}
                          >
                            <Power className={`w-3.5 h-3.5 ${prov.enabled !== false ? 'text-emerald-600' : 'text-zinc-400'}`} />
                            <span>{prov.enabled !== false ? 'Provider Aktif' : 'Nonaktif'}</span>
                          </button>

                          <button
                            onClick={() => handlePing(prov.id)}
                            disabled={isPinging || prov.enabled === false}
                            className="px-3 py-1.5 text-xs font-black rounded-xl border bg-white hover:bg-zinc-50 flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-2xs"
                            style={{ borderColor: theme.border }}
                          >
                            {isPinging ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <Activity className="w-3.5 h-3.5 text-emerald-600" />}
                            {isPinging ? 'Menguji...' : prov.latencyMs ? `Latensi: ${prov.latencyMs} ms` : 'Uji Latensi'}
                          </button>

                          {!isGemini && (
                            <button
                              onClick={() => handleDeleteProvider(prov.id, prov.name)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-1 transition-colors"
                              title="Hapus Provider ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Hapus</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Deactivation Banner if Provider is Disabled */}
                      {prov.enabled === false && (
                        <div className="px-3.5 py-2.5 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-900 text-xs font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            Provider ini sedang dinonaktifkan. Model di bawah tidak akan dieksekusi oleh Gateway.
                          </span>
                          <button
                            onClick={() => handleToggleProvider(prov.id, false)}
                            className="px-3 py-1 text-xs font-black bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-2xs shrink-0"
                          >
                            Aktifkan Provider
                          </button>
                        </div>
                      )}

                      {/* API Key Management */}
                      <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-zinc-800 flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-amber-500" /> Kunci Akses (API Key)
                          </span>
                          {!isEditing && (
                            <div className="flex items-center gap-2">
                              {prov.apiKey && (
                                <button
                                  onClick={() => handleSaveKey(prov.id, '')}
                                  className="text-[11px] font-bold text-rose-600 hover:underline"
                                >
                                  Hapus Kunci
                                </button>
                              )}
                              <button
                                onClick={() => setEditingProviderKey({ id: prov.id, key: prov.apiKey || '' })}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                {prov.apiKey ? 'Ubah Kunci' : '+ Pasang Kunci Kustom'}
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                placeholder={`Masukkan API Key untuk ${prov.name}...`}
                                value={editingProviderKey.key}
                                onChange={(e) => setEditingProviderKey({ id: prov.id, key: e.target.value })}
                                className="w-full text-xs px-3 py-2 border-2 rounded-xl bg-zinc-50 outline-none font-mono focus:bg-white focus:border-indigo-500"
                              />
                              <button
                                onClick={() => handleSaveKey(prov.id, editingProviderKey.key)}
                                className="px-3.5 py-2 text-xs font-black bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 shrink-0"
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => setEditingProviderKey(null)}
                                className="px-3 py-2 text-xs font-bold bg-zinc-200 text-zinc-700 rounded-xl shrink-0"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5 pt-0.5">
                            <span className="text-zinc-600 font-medium flex items-center gap-2">
                              Status:
                              {prov.apiKey ? (
                                <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-lg border border-zinc-200">
                                  ••••••••{prov.apiKey.slice(-4)} (Kustom Aktif)
                                </span>
                              ) : isGemini ? (
                                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                  Kunci Default Lingkungan Studio Aktif
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                  {prov.category === 'local' ? 'Lokal (Tanpa Key)' : 'Belum diisi API Key'}
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {prov.baseUrl ? `URL: ${prov.baseUrl}` : 'Official SDK'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Models List & Model Adder */}
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-zinc-600 tracking-wider">
                            Model {prov.name} ({prov.models?.length || 0}):
                          </span>
                          <button
                            onClick={() => setNewModelInput({
                              ...newModelInput,
                              [prov.id]: { id: '', name: '', showInput: !isAddingModel }
                            })}
                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            {isAddingModel ? 'Tutup Form' : 'Tambah Model Baru'}
                          </button>
                        </div>

                        {/* Add Model Form for this Provider */}
                        {isAddingModel && (
                          <div className="p-3 bg-white rounded-2xl border-2 border-indigo-200 space-y-2 shadow-sm">
                            <input
                              type="text"
                              placeholder="Model ID (contoh: deepseek-r1 / claude-3-7-sonnet / gemini-3.7-flash)"
                              value={newModelInput[prov.id]?.id || ''}
                              onChange={(e) => setNewModelInput({
                                ...newModelInput,
                                [prov.id]: { ...newModelInput[prov.id], id: e.target.value }
                              })}
                              className="w-full text-xs px-2.5 py-1.5 border rounded-xl bg-zinc-50 font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Nama Tampilan Model (opsional)"
                              value={newModelInput[prov.id]?.name || ''}
                              onChange={(e) => setNewModelInput({
                                ...newModelInput,
                                [prov.id]: { ...newModelInput[prov.id], name: e.target.value }
                              })}
                              className="w-full text-xs px-2.5 py-1.5 border rounded-xl bg-zinc-50"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleAddModel(prov.id)}
                                className="px-3.5 py-1.5 text-xs font-black bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                              >
                                Simpan Model
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                          {prov.models?.map((m) => {
                            const isModelActive = !routerState.activeComboId && routerState.activeProviderId === prov.id && routerState.activeModelId === m.id;
                            const isModelEnabled = m.enabled !== false;
                            const isProviderEnabled = prov.enabled !== false;

                            return (
                              <div
                                key={m.id}
                                className={`p-3 rounded-2xl border-2 transition-all flex flex-col justify-between gap-2 ${
                                  isModelActive 
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/20' 
                                    : !isModelEnabled || !isProviderEnabled
                                    ? 'bg-zinc-100/70 border-zinc-200 opacity-75'
                                    : 'bg-white border-zinc-200 hover:border-zinc-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                                        isModelActive 
                                          ? 'bg-white animate-pulse' 
                                          : !isModelEnabled || !isProviderEnabled
                                          ? 'bg-zinc-400'
                                          : 'bg-emerald-500'
                                      }`} />
                                      <h5 className={`font-black text-xs truncate ${
                                        isModelActive 
                                          ? 'text-white' 
                                          : !isModelEnabled || !isProviderEnabled
                                          ? 'text-zinc-500 line-through'
                                          : 'text-zinc-900'
                                      }`} title={m.name || m.id}>
                                        {m.name || m.id}
                                      </h5>
                                    </div>
                                    <span className={`font-mono text-[10px] block mt-0.5 truncate ${
                                      isModelActive ? 'text-emerald-100' : 'text-zinc-400'
                                    }`}>
                                      {m.id}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {m.isDefault && (
                                      <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${isModelActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                                        Default
                                      </span>
                                    )}

                                    {/* Toggle Model Enabled */}
                                    <button
                                      onClick={() => handleToggleModel(prov.id, m.id, isModelEnabled)}
                                      className={`p-1 rounded-lg transition-colors ${
                                        isModelActive
                                          ? 'text-white/80 hover:text-white'
                                          : isModelEnabled
                                          ? 'text-emerald-600 hover:bg-emerald-50'
                                          : 'text-zinc-400 hover:text-zinc-700'
                                      }`}
                                      title={isModelEnabled ? 'Nonaktifkan model ini' : 'Aktifkan model ini'}
                                    >
                                      {isModelEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                    </button>

                                    <button
                                      onClick={() => handleDeleteModel(prov.id, m.id, m.name || m.id)}
                                      className={`p-1 rounded-lg hover:opacity-80 transition-opacity ${isModelActive ? 'text-white/80 hover:text-white' : 'text-zinc-400 hover:text-rose-600'}`}
                                      title="Hapus Model"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <div>
                                    {!isModelEnabled && (
                                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                        Nonaktif
                                      </span>
                                    )}
                                  </div>

                                  <div>
                                    {isModelActive ? (
                                      <span className="text-[10px] uppercase font-black tracking-wider bg-white/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                        <Check className="w-3 h-3 text-white" /> Aktif Digunakan
                                      </span>
                                    ) : !isProviderEnabled ? (
                                      <button
                                        onClick={() => handleToggleProvider(prov.id, false)}
                                        className="text-xs font-bold px-2.5 py-1 rounded-xl bg-zinc-200 text-zinc-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                                      >
                                        Aktifkan Provider
                                      </button>
                                    ) : !isModelEnabled ? (
                                      <button
                                        onClick={() => {
                                          handleToggleModel(prov.id, m.id, false);
                                          handleSetActive(prov.id, m.id);
                                        }}
                                        className="text-xs font-bold px-2.5 py-1 rounded-xl bg-zinc-200 text-zinc-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                                      >
                                        Aktifkan & Pilih
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleSetActive(prov.id, m.id)}
                                        className="text-xs font-black px-3 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors shadow-2xs"
                                      >
                                        Pilih Model
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: FALLBACK CASCADE COMBOS */}
          {activeTab === 'combos' && routerState && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/60 border-2 border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <p className="font-black text-sm">Smart Fallback Cascades (Tiered Multi-Model)</p>
                    <p>
                      Saat model Tier 1 mengalami error, rate limit (429), atau downtime, Gateway otomatis beralih ke Tier 2 dan Tier 3 secara mulus tanpa interupsi.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddComboModal(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm shrink-0 transition-all"
                >
                  <Plus className="w-4 h-4" /> + Buat Combo Kustom
                </button>
              </div>

              {/* Add Custom Combo Form */}
              {showAddComboModal && (
                <div className="p-4 sm:p-5 rounded-3xl border-2 border-amber-300 bg-amber-50/40 space-y-3.5 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-600" />
                      <h4 className="font-black text-sm text-amber-950">Formulir Pembuatan Fallback Combo Kustom</h4>
                    </div>
                    <button
                      onClick={() => setShowAddComboModal(false)}
                      className="text-zinc-400 hover:text-zinc-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveCombo} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Nama Combo <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="contoh: Cascade Super Cepat / Hemat Token"
                          value={newComboName}
                          onChange={(e) => setNewComboName(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Deskripsi Singkat (Opsional)
                        </label>
                        <input
                          type="text"
                          placeholder="contoh: Tier 1: Gemini 3.7 -> Tier 2: Claude -> Tier 3: Local Llama"
                          value={newComboDesc}
                          onChange={(e) => setNewComboDesc(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-xl bg-white outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Tier Selectors */}
                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] font-black uppercase text-zinc-700 tracking-wider block">
                        Urutan Model Fallback (Tier Sequence):
                      </label>
                      {newComboTiers.map((tierValue, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg text-white shrink-0 ${
                            idx === 0 ? 'bg-amber-600' : idx === 1 ? 'bg-blue-600' : idx === 2 ? 'bg-emerald-600' : 'bg-purple-600'
                          }`}>
                            Tier {idx + 1}
                          </span>
                          <select
                            value={tierValue}
                            onChange={(e) => {
                              const updated = [...newComboTiers];
                              updated[idx] = e.target.value;
                              setNewComboTiers(updated);
                            }}
                            className="w-full text-xs px-3 py-2 border rounded-xl bg-white outline-none focus:border-amber-500 font-medium"
                          >
                            {allAvailableModels.map(m => (
                              <option key={m.fullId} value={m.fullId}>
                                {m.label} ({m.fullId})
                              </option>
                            ))}
                          </select>
                          {newComboTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setNewComboTiers(newComboTiers.filter((_, i) => i !== idx))}
                              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                              title="Hapus Tier ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          if (allAvailableModels.length > 0) {
                            setNewComboTiers([...newComboTiers, allAvailableModels[0].fullId]);
                          }
                        }}
                        className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1 pt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Tier Fallback Berikutnya
                      </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddComboModal(false)}
                        className="px-4 py-2 text-xs font-bold rounded-xl border bg-white hover:bg-zinc-100"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 text-xs font-black rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-md"
                      >
                        Simpan Fallback Combo
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* List of Combos */}
              <div className="space-y-3">
                {routerState.combos.map((combo) => {
                  const isActive = routerState.activeComboId === combo.id;
                  const isComboEnabled = combo.enabled !== false;

                  return (
                    <div 
                      key={combo.id}
                      className={`p-4 rounded-3xl border-2 transition-all ${
                        isActive 
                          ? 'bg-amber-50/40 border-amber-500 ring-2 ring-amber-400/20 shadow-sm' 
                          : !isComboEnabled
                          ? 'bg-zinc-100/70 border-zinc-200 opacity-75'
                          : 'bg-zinc-50/60 border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`w-3 h-3 rounded-full ${
                            isActive 
                              ? 'bg-amber-500 ring-2 ring-amber-200 animate-pulse' 
                              : !isComboEnabled
                              ? 'bg-zinc-400'
                              : 'bg-emerald-400'
                          }`} />
                          <h4 className={`font-black text-sm ${!isComboEnabled ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>
                            {combo.name}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                              Aktif Digunakan
                            </span>
                          )}
                          {!isComboEnabled && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              Nonaktif
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Toggle Combo Enabled */}
                          <button
                            onClick={() => handleToggleCombo(combo.id, isComboEnabled)}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1 transition-colors ${
                              isComboEnabled
                                ? 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-300'
                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300'
                            }`}
                            title={isComboEnabled ? 'Nonaktifkan Fallback Combo ini' : 'Aktifkan Fallback Combo ini'}
                          >
                            <Power className={`w-3.5 h-3.5 ${isComboEnabled ? 'text-zinc-500' : 'text-emerald-600'}`} />
                            <span>{isComboEnabled ? 'Nonaktifkan' : 'Aktifkan'}</span>
                          </button>

                          {isActive ? (
                            <button
                              onClick={handleDeactivateCombo}
                              className="text-xs font-black px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs flex items-center gap-1"
                              title="Nonaktifkan status aktif fallback combo ini dan kembali ke model tunggal"
                            >
                              <Power className="w-3.5 h-3.5 text-rose-600" />
                              Kembali ke Single Model
                            </button>
                          ) : isComboEnabled ? (
                            <button
                              onClick={() => handleSetActive('gemini', 'gemini-3.7-flash', combo.id)}
                              className="text-xs font-black px-3.5 py-1.5 rounded-xl border bg-white hover:bg-zinc-100 transition-colors shadow-2xs"
                              style={{ borderColor: theme.border }}
                            >
                              Pilih Combo Ini
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                handleToggleCombo(combo.id, false);
                                handleSetActive('gemini', 'gemini-3.7-flash', combo.id);
                              }}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-200 text-zinc-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                            >
                              Aktifkan & Pilih
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteCombo(combo.id, combo.name)}
                            className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus Fallback Combo ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{combo.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {combo.models.map((m, idx) => (
                          <React.Fragment key={m + idx}>
                            <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-white border border-zinc-200 text-zinc-700 font-bold shadow-xs">
                              {idx === 0 && <span className="text-[10px] text-amber-600 font-sans mr-1 font-black">T1</span>}
                              {idx === 1 && <span className="text-[10px] text-blue-600 font-sans mr-1 font-black">T2</span>}
                              {idx === 2 && <span className="text-[10px] text-emerald-600 font-sans mr-1 font-black">T3</span>}
                              {idx > 2 && <span className="text-[10px] text-purple-600 font-sans mr-1 font-black">T{idx+1}</span>}
                              {m}
                            </span>
                            {idx < combo.models.length - 1 && (
                              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RTK TOKEN SAVER */}
          {activeTab === 'rtk' && routerState && (
            <div className="space-y-4">
              <div className="p-5 rounded-3xl bg-emerald-50/60 border-2 border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-emerald-950">RTK Token Saver (Output Compression)</h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Mengompresi output git diff, log bash, hasil pencarian web, dan JSON secara real-time untuk menghemat 20% - 40% token input context LLM.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleRtk}
                  className={`px-5 py-2.5 rounded-2xl font-black text-xs border-2 transition-all shrink-0 ${
                    routerState.rtkEnabled 
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' 
                      : 'bg-white text-zinc-600 border-zinc-300'
                  }`}
                >
                  {routerState.rtkEnabled ? '✓ RTK AKTIF' : 'NONAKTIFKAN RTK'}
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-200 text-center">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase">Token Diproses</span>
                  <p className="text-xl font-black text-zinc-800 mt-1 font-mono">
                    {routerState.stats.tokensProcessed.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Token Dihemat</span>
                  <p className="text-xl font-black text-emerald-700 mt-1 font-mono">
                    {routerState.stats.tokensSaved.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-center">
                  <span className="text-[11px] font-bold text-amber-700 uppercase">Efisiensi Rata-rata</span>
                  <p className="text-xl font-black text-amber-800 mt-1 font-mono">
                    {routerState.stats.tokensProcessed > 0 
                      ? `${Math.round((routerState.stats.tokensSaved / (routerState.stats.tokensProcessed + routerState.stats.tokensSaved)) * 100)}%`
                      : '32%'}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-purple-50 border-2 border-purple-300 text-center">
                  <span className="text-[11px] font-bold text-purple-700 uppercase">Auto Fallbacks</span>
                  <p className="text-xl font-black text-purple-800 mt-1 font-mono">
                    {routerState.stats.fallbacksTriggered}
                  </p>
                </div>
              </div>

              {/* Compression preview sample */}
              <div className="p-4 rounded-2xl bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 border-b border-zinc-800">
                  <span>Pratinjau Kompresi Tool Output (Git Diff / Log)</span>
                  <span className="text-emerald-400 font-bold">Penghematan ~35%</span>
                </div>
                <div className="text-zinc-400 leading-relaxed text-[11px]">
                  <code>
                    [Asli 850 baris] ➔ [RTK Compressed: spasi ganda, baris kosong berlebih, dan jejak error berulang diringkas secara optimal tanpa menghilangkan semantik kode]
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLI & IDE CONNECT */}
          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50/60 border-2 border-purple-200">
                <p className="font-black text-sm text-purple-900">Universal OpenAI / Claude Gateway Endpoint</p>
                <p className="text-xs text-purple-800 mt-0.5">
                  Hubungkan IDE atau terminal AI favorit Anda langsung ke Violet AI Gateway. Semua fitur fallback dan token saver otomatis berjalan di latar belakang!
                </p>
              </div>

              <div className="space-y-3">
                {/* Connection Box */}
                <div className="p-4 rounded-2xl border-2 bg-zinc-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-zinc-700 uppercase">Endpoint URL (Local Proxy)</span>
                    <button
                      onClick={() => copyToClipboard('http://localhost:3000/v1', 'url')}
                      className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                    >
                      {copiedId === 'url' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === 'url' ? 'Tersalin' : 'Salin URL'}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-white border rounded-xl font-mono text-xs text-zinc-800">
                    http://localhost:3000/v1
                  </pre>

                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-zinc-700 uppercase">API Key (OpenAI Compatible)</span>
                    <button
                      onClick={() => copyToClipboard('violet-gateway-key', 'key')}
                      className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                    >
                      {copiedId === 'key' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === 'key' ? 'Tersalin' : 'Salin Key'}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-white border rounded-xl font-mono text-xs text-zinc-800">
                    violet-gateway-key
                  </pre>
                </div>

                {/* Specific tool instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl border bg-white space-y-1.5">
                    <h5 className="font-black text-xs text-zinc-900 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-purple-600" />
                      Claude Code CLI
                    </h5>
                    <pre className="text-[11px] font-mono bg-zinc-50 p-2 rounded border text-zinc-700 overflow-x-auto">
                      claude config set --global apiBaseUrl http://localhost:3000/v1
                    </pre>
                  </div>
                  <div className="p-3 rounded-xl border bg-white space-y-1.5">
                    <h5 className="font-black text-xs text-zinc-900 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-blue-600" />
                      Cursor IDE
                    </h5>
                    <p className="text-[11px] text-zinc-500">
                      Settings ➔ Models ➔ OpenAI API Base: <code>http://localhost:3000/v1</code>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border bg-white space-y-1.5">
                    <h5 className="font-black text-xs text-zinc-900 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-600" />
                      Cline / Continue
                    </h5>
                    <p className="text-[11px] text-zinc-500">
                      Provider: OpenAI Compatible, Base URL: <code>http://localhost:3000/v1</code>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border bg-white space-y-1.5">
                    <h5 className="font-black text-xs text-zinc-900 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      Aider / OpenClaw / Windsurf
                    </h5>
                    <p className="text-[11px] text-zinc-500">
                      Export OPENAI_API_BASE=http://localhost:3000/v1
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STATS & QUOTA */}
          {activeTab === 'stats' && routerState && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50/60 border-2 border-blue-200">
                <p className="font-black text-sm text-blue-900">Status & Telemetri Gateway</p>
                <p className="text-xs text-blue-800 mt-0.5">
                  Pemantauan latensi dan konsumsi token secara menyeluruh.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-xl border-2 bg-zinc-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700">Total Permintaan Diproses</span>
                  <span className="text-sm font-black font-mono text-zinc-900">{routerState.stats.totalRequests}</span>
                </div>
                <div className="p-3.5 rounded-xl border-2 bg-zinc-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700">Provider Aktif Saat Ini</span>
                  <span className="text-sm font-black text-amber-600">{routerState.stats.activeProviderName}</span>
                </div>
                <div className="p-3.5 rounded-xl border-2 bg-zinc-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700">Combo Fallback Aktif</span>
                  <span className="text-sm font-black text-indigo-600">{routerState.activeComboId || 'Tidak ada (Single Model)'}</span>
                </div>
                <div className="p-3.5 rounded-xl border-2 bg-zinc-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700">Frekuensi Fallback Otomatis</span>
                  <span className="text-sm font-black text-emerald-600">{routerState.stats.fallbacksTriggered}x dipicu</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-5 sm:px-6 py-3.5 sm:py-4 border-t-4 flex justify-between items-center shrink-0"
          style={{ backgroundColor: theme.lightTint, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-zinc-600">
              Active: {routerState?.stats?.activeProviderName || 'Google Gemini'}
            </span>
            {routerState?.rtkEnabled && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                RTK ON
              </span>
            )}
          </div>
          <button
            onClick={onClose}
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
  );
};
