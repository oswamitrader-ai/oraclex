import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, DollarSign, LogOut, Plus, Check, X, Loader2, Edit2, Trash2, Pause, Play, RefreshCw, Clock, Bell } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './supabase';

const toastEventEmitter = {
  listeners: [],
  emit(toast) { this.listeners.forEach(l => l(toast)); },
  subscribe(l) { this.listeners.push(l); return () => { this.listeners = this.listeners.filter(cb => cb !== l); }; }
};
export const toast = (message, type = 'info') => toastEventEmitter.emit({ id: Date.now(), message, type });

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const unsub = toastEventEmitter.subscribe(t => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, 6000);
    });
    return unsub;
  }, []);
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      {toasts.map(t => (
        <div key={t.id} className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-semibold transition-all pointer-events-auto border-l-4 ${t.type === 'success' ? 'bg-surface border-yes' : t.type === 'warning' ? 'bg-surface border-alert' : 'bg-surface border-accent'}`} style={{animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'}}>
          <Bell className={t.type === 'success' ? 'text-yes' : t.type === 'warning' ? 'text-alert' : 'text-accent'} size={24} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

const playAlert = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.2); // Sobe o tom para chamar atenção
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.error(e);
  }
};

function Sidebar() {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function loadPending() {
      const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      setPendingCount(count || 0);
    }
    loadPending();

    const sub = supabase.channel('sidebar-tx')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
         loadPending();
         if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
            playAlert();
            const typeText = payload.new.type === 'withdraw' ? 'SAQUE' : 'DEPÓSITO';
            const valueText = Number(payload.new.amount).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
            toast(`Novo pedido de ${typeText} pendente: ${valueText}`, 'warning');
         }
      })
      .subscribe();
      
    return () => supabase.removeChannel(sub);
  }, []);
  const links = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Mercados', path: '/markets', icon: <Activity size={20} /> },
    { name: 'Usuários', path: '/users', icon: <Users size={20} /> },
    { name: 'Transações', path: '/transactions', icon: <DollarSign size={20} />, badge: pendingCount },
  ];

  return (
    <div className="w-64 bg-surface border-r border-border min-h-screen p-4 flex flex-col">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-yes to-accent flex items-center justify-center font-bold text-bg">OX</div>
        <span className="font-bold text-lg text-white">Admin Panel</span>
      </div>
      
      <nav className="flex-1 flex flex-col gap-2">
        {links.map(l => (
          <Link 
            key={l.path} 
            to={l.path}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-colors ${location.pathname === l.path ? 'bg-accent text-white' : 'text-text-dim hover:text-white hover:bg-surface2'}`}
          >
            <div className="flex items-center gap-3">
              {l.icon}
              {l.name}
            </div>
            {l.badge > 0 && (
              <span className="bg-no text-bg text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {l.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto">
        <button 
          onClick={async () => { 
            await supabase.auth.signOut(); 
            window.location.reload();
          }} 
          className="flex items-center gap-3 px-3 py-2.5 w-full text-no hover:bg-no/10 rounded-lg font-medium transition-colors"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </div>
  );
}

function DashboardHome() {
  const [stats, setStats] = useState({ users: 0, volume: 0, payouts: 0, profit: 0, loss: 0 });
  const [marketChart, setMarketChart] = useState([]);
  const [cashflowChart, setCashflowChart] = useState([]);

  useEffect(() => {
    async function load() {
      const { count: users } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { data: markets } = await supabase.from('markets').select('*');
      const { data: positions } = await supabase.from('positions').select('*');
      const { data: transactions } = await supabase.from('transactions').select('*');

      let volume = 0, payouts = 0, profit = 0, loss = 0;
      let mActive = 0, mClosed = 0, mPaused = 0, mScheduled = 0;
      const now = new Date();

      markets?.forEach(m => {
        volume += Number(m.volume || 0);
        if (m.status === 'closed') {
          mClosed++;
          const mPositions = positions?.filter(p => p.market_id === m.id) || [];
          mPositions.forEach(p => {
             if (p.side === m.winner_side) {
               loss += (Number(p.shares) - Number(p.amount));
             } else {
               profit += Number(p.amount);
             }
          });
        } else if (m.status === 'paused') {
          mPaused++;
        } else if (m.start_date && new Date(m.start_date) > now) {
          mScheduled++;
        } else {
          mActive++;
        }
      });

      transactions?.filter(t => t.type === 'withdraw' && t.status === 'completed').forEach(t => {
        payouts += Number(t.amount);
      });

      setStats({ users: users || 0, volume, payouts, profit, loss });

      setMarketChart([
        { name: 'Ativos', value: mActive, color: '#2dd4bf' },
        { name: 'Encerrados', value: mClosed, color: '#f87171' },
        { name: 'Agendados', value: mScheduled, color: '#a78bfa' },
        { name: 'Pausados', value: mPaused, color: '#9ca3af' }
      ].filter(d => d.value > 0));
      
      const last7Days = Array.from({length: 7}).map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { date: d.toISOString().split('T')[0], deps: 0, withs: 0 };
      });
      
      transactions?.forEach(t => {
         const date = t.created_at.split('T')[0];
         const dayObj = last7Days.find(d => d.date === date);
         if (dayObj) {
           if (t.type === 'deposit') dayObj.deps += Number(t.amount);
           if (t.type === 'withdraw' && t.status === 'completed') dayObj.withs += Number(t.amount);
         }
      });

      setCashflowChart(last7Days.map(d => ({
        name: d.date.slice(8, 10) + '/' + d.date.slice(5, 7),
        Depósitos: d.deps,
        Saques: d.withs
      })));
    }
    load();
    
    const sub = supabase.channel('admin:dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, load)
      .subscribe();
      
    return () => { supabase.removeChannel(sub); }
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Visão Geral</h1>
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-surface p-5 rounded-xl border border-border">
          <h3 className="text-text-dim text-xs font-bold uppercase mb-1">Usuários Totais</h3>
          <p className="text-2xl font-bold font-mono">{stats.users}</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border">
          <h3 className="text-text-dim text-xs font-bold uppercase mb-1">Volume Apostado</h3>
          <p className="text-2xl font-bold font-mono text-accent">R$ {stats.volume.toFixed(2)}</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border">
          <h3 className="text-text-dim text-xs font-bold uppercase mb-1">Saques Pagos</h3>
          <p className="text-2xl font-bold font-mono text-blue-400">R$ {stats.payouts.toFixed(2)}</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border">
          <h3 className="text-text-dim text-xs font-bold uppercase mb-1">Lucro da Casa</h3>
          <p className="text-2xl font-bold font-mono text-yes">R$ {stats.profit.toFixed(2)}</p>
        </div>
        <div className="bg-surface p-5 rounded-xl border border-border">
          <h3 className="text-text-dim text-xs font-bold uppercase mb-1">Prejuízo Casa</h3>
          <p className="text-2xl font-bold font-mono text-no">R$ {stats.loss.toFixed(2)}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-surface p-6 rounded-xl border border-border">
          <h3 className="text-lg font-bold mb-6">Fluxo de Caixa (Últimos 7 dias)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowChart}>
                <defs>
                  <linearGradient id="colorDeps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWiths" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                <XAxis dataKey="name" stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                <RechartsTooltip contentStyle={{backgroundColor: '#1a202c', border: 'none', borderRadius: '8px'}} />
                <Area type="monotone" dataKey="Depósitos" stroke="#2dd4bf" fillOpacity={1} fill="url(#colorDeps)" strokeWidth={2} />
                <Area type="monotone" dataKey="Saques" stroke="#f87171" fillOpacity={1} fill="url(#colorWiths)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-surface p-6 rounded-xl border border-border flex flex-col">
          <h3 className="text-lg font-bold mb-6">Status dos Mercados</h3>
          <div className="h-64 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={marketChart} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {marketChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{backgroundColor: '#1a202c', border: 'none', borderRadius: '8px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {marketChart.map(m => (
              <div key={m.name} className="flex items-center gap-1 text-xs font-semibold text-text-dim">
                <div className="w-2 h-2 rounded-full" style={{backgroundColor: m.color}}></div>
                {m.name} ({m.value})
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateTimeLocal(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // ajusta o fuso horário para bater com o input datetime-local
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function MarketsPage() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  const [filter, setFilter] = useState("ativas"); // ativas | encerradas
  const [draggingPoint, setDraggingPoint] = useState(null); // 'p1' or 'p2'

  const handlePointerDown = (point) => (e) => {
    e.preventDefault();
    setDraggingPoint(point);
  };
  
  const handlePointerMove = (e) => {
    if (!draggingPoint || !formData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    
    setFormData(prev => ({
      ...prev,
      ai_line_config: {
        ...(prev.ai_line_config || {x1:0,y1:0.6,x2:1,y2:0.6}),
        [draggingPoint === 'p1' ? 'x1' : 'x2']: x,
        [draggingPoint === 'p1' ? 'y1' : 'y2']: y
      }
    }));
  };

  const handlePointerUp = () => setDraggingPoint(null);

  useEffect(() => {
    load();
    const sub = supabase.channel('admin:markets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); }
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('markets').select('*, categories(name)').order('created_at', { ascending: false });
    const { data: cData } = await supabase.from('categories').select('*');
    if (data) setMarkets(data);
    if (cData) setCats(cData);
    setLoading(false);
  }

  function openAdd() {
    if (!cats.length) return alert('Sem categorias no banco!');
    setFormData({ title: '', category_id: cats[0].id, start_date: '', end_date: '', start_chance: 50, market_type: 'binary', options: [{ id: crypto.randomUUID(), title: 'Opção A', price: 50 }, { id: crypto.randomUUID(), title: 'Opção B', price: 50 }], video_type: null, video_url: '', ai_counter_type: 'carros', ai_target_count: 0 });
    setModalOpen(true);
  }

  function openEdit(m) {
    setFormData({ 
      id: m.id,
      title: m.title, 
      category_id: m.category_id, 
      start_date: m.start_date ? formatDateTimeLocal(m.start_date) : '',
      end_date: m.end_date ? formatDateTimeLocal(m.end_date) : '',
      start_chance: m.start_chance,
      market_type: m.market_type || 'binary',
      options: m.options || [{ id: crypto.randomUUID(), title: 'Opção A', price: 50 }, { id: crypto.randomUUID(), title: 'Opção B', price: 50 }],
      video_type: m.video_type || null,
      video_url: m.video_url || '',
      ai_counter_type: m.ai_counter_type || 'carros',
      ai_target_count: m.ai_target_count || 0,
      ai_line_config: m.ai_line_config || {x1:0, y1:0.6, x2:1, y2:0.6}
    });
    setModalOpen(true);
  }

  async function handleAddCategory() {
    const name = window.prompt("Digite o nome da nova Categoria:");
    if (!name) return;
    const icon = window.prompt("Digite o ícone (emoji) da Categoria:", "📌");
    if (!icon) return;

    const { data, error } = await supabase.from('categories').insert([{ name, icon }]).select();
    if (error) {
      alert("Erro ao criar categoria. Lembre-se de configurar a RLS da tabela 'categories' para permitir inserts: " + error.message);
    } else {
      if (data && data[0]) {
        setCats(prev => [...prev, data[0]]);
        setFormData(prev => ({ ...prev, category_id: data[0].id }));
      }
    }
  }

  async function saveMarket() {
    if (!formData.title) return alert("O título é obrigatório.");
    
    let startDateISO = null;
    if (formData.start_date) startDateISO = new Date(formData.start_date).toISOString();
    
    let endDateISO = null;
    if (formData.end_date) endDateISO = new Date(formData.end_date).toISOString();

    if (formData.id) {
      await supabase.from('markets').update({ 
        title: formData.title,
        category_id: formData.category_id,
        start_date: startDateISO,
        end_date: endDateISO,
        video_type: formData.video_type,
        video_url: formData.video_url,
        ai_counter_type: formData.ai_counter_type,
        ai_target_count: parseInt(formData.ai_target_count) || 0,
        ai_line_config: formData.ai_line_config,
        market_type: formData.market_type,
        options: formData.market_type === 'multiple' ? formData.options : []
      }).eq('id', formData.id);
    } else {
      if (formData.market_type === 'multiple') {
        const sum = formData.options.reduce((a, b) => a + b.price, 0);
        if (sum !== 100) return alert('A soma dos preços das opções deve ser exatamente 100%.');
      }
      
      await supabase.from('markets').insert({
        title: formData.title,
        category_id: formData.category_id,
        start_chance: Number(formData.start_chance),
        current_yes: Number(formData.start_chance),
        start_date: startDateISO,
        end_date: endDateISO,
        volume: 0,
        status: 'active',
        video_type: formData.video_type,
        video_url: formData.video_url,
        ai_counter_type: formData.ai_counter_type,
        ai_target_count: parseInt(formData.ai_target_count) || 0,
        ai_line_config: formData.ai_line_config,
        market_type: formData.market_type,
        options: formData.market_type === 'multiple' ? formData.options : []
      });
    }
    setModalOpen(false);
    load();
  }

  async function resolveMarket(id, sideId, sideName = sideId) {
    if(!window.confirm(`Tem certeza que quer resolver como ${sideName.toUpperCase()}?`)) return;
    await supabase.from('markets').update({ status: 'closed', winner_side: sideId }).eq('id', id);
    load();
  }

  async function togglePause(id, currentStatus) {
    const newStatus = currentStatus === 'paused' ? 'active' : 'paused';
    await supabase.from('markets').update({ status: newStatus }).eq('id', id);
    load();
  }

  async function deleteMarket(id) {
    if(!window.confirm("Deseja realmente excluir este mercado?")) return;
    await supabase.from('markets').delete().eq('id', id);
    load();
  }

  async function republishMarket(m) {
    if(!window.confirm("Deseja republicar (criar uma nova cópia) este mercado?")) return;
    await supabase.from('markets').insert({
        title: m.title,
        category_id: m.category_id,
        start_chance: Number(m.start_chance),
        current_yes: Number(m.start_chance),
        start_date: m.start_date,
        end_date: m.end_date,
        volume: 0,
        status: 'active'
    });
    load();
  }

  const filteredMarkets = markets.filter(m => filter === 'ativas' ? m.status !== 'closed' : m.status === 'closed');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold">Mercados de Apostas</h1>
          <div className="flex bg-surface2 p-1 rounded-lg">
            <button className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${filter === 'ativas' ? 'bg-surface text-white shadow-sm' : 'text-text-dim'}`} onClick={() => setFilter('ativas')}>Em Aberto</button>
            <button className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${filter === 'encerradas' ? 'bg-surface text-white shadow-sm' : 'text-text-dim'}`} onClick={() => setFilter('encerradas')}>Encerrados</button>
          </div>
        </div>
        <button onClick={openAdd} className="bg-yes text-bg px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:brightness-110">
          <Plus size={18} /> Novo Mercado
        </button>
      </div>
      
      {loading ? <Loader2 className="animate-spin text-accent mx-auto mt-10" /> : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface2 text-text-dim text-sm">
              <tr>
                <th className="p-4 font-semibold">Título</th>
                <th className="p-4 font-semibold">Categoria</th>
                <th className="p-4 font-semibold">Encerramento</th>
                <th className="p-4 font-semibold">Volume</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMarkets.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-text-dim font-semibold">Nenhum mercado encontrado nesta aba.</td>
                </tr>
              )}
              {filteredMarkets.map(m => {
                const isScheduled = m.start_date && new Date() < new Date(m.start_date);
                const isExpired = m.end_date && new Date() > new Date(m.end_date);
                return (
                <tr key={m.id} className={`hover:bg-surface2/50 ${m.video_type ? 'bg-red-500/5' : ''}`}>
                  <td className="p-4 font-medium flex items-center gap-2">
                    {m.title}
                    {m.video_type && (
                      <span className="px-2 py-0.5 bg-no/20 text-no text-[10px] rounded font-bold border border-no/30 whitespace-nowrap">
                        🎥 IA VÍDEO
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-text-dim">{m.categories?.name}</td>
                  <td className="p-4 text-sm text-text-dim">
                    {m.start_date && <div className="text-accent mb-1"><Clock size={10} className="inline mr-1"/>Início: {new Date(m.start_date).toLocaleString()}</div>}
                    <div>Fim: {m.end_date ? new Date(m.end_date).toLocaleString() : 'Sem prazo'}</div>
                  </td>
                  <td className="p-4 font-mono">R$ {m.volume}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      m.status === 'active' && isScheduled ? 'bg-accent/20 text-accent' :
                      m.status === 'active' && !isExpired && !isScheduled ? 'bg-yes/20 text-yes' : 
                      m.status === 'active' && isExpired ? 'bg-accent/20 text-accent' :
                      m.status === 'paused' ? 'bg-text-dim/20 text-text-dim' :
                      'bg-border text-text-dim'
                    }`}>
                      {isScheduled && m.status === 'active' ? 'AGENDADO' : isExpired && m.status === 'active' ? 'AGUARDANDO RESULTADO' : m.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(m)} className="p-1.5 bg-surface2 text-text-dim hover:text-white rounded" title="Editar">
                        <Edit2 size={15}/>
                      </button>

                      {m.status !== 'closed' ? (
                        <>
                          <button onClick={() => togglePause(m.id, m.status)} className="p-1.5 bg-surface2 text-text-dim hover:text-white rounded" title={m.status === 'paused' ? 'Retomar' : 'Pausar'}>
                            {m.status === 'paused' ? <Play size={15} /> : <Pause size={15}/>}
                          </button>
                          {m.status === 'active' && (
                            <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
                              {m.market_type === 'multiple' && m.options ? (
                                m.options.map(opt => (
                                  <button key={opt.id} onClick={() => resolveMarket(m.id, opt.id, opt.title)} className="text-xs bg-yes/10 text-yes px-2 py-1 rounded hover:bg-yes hover:text-bg font-bold transition">Venceu {opt.title}</button>
                                ))
                              ) : (
                                <>
                                  <button onClick={() => resolveMarket(m.id, 'yes')} className="text-xs bg-yes/10 text-yes px-2 py-1 rounded hover:bg-yes hover:text-bg font-bold transition">Venceu SIM</button>
                                  <button onClick={() => resolveMarket(m.id, 'no')} className="text-xs bg-no/10 text-no px-2 py-1 rounded hover:bg-no hover:text-bg font-bold transition">Venceu NÃO</button>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <button onClick={() => republishMarket(m)} className="p-1.5 bg-yes/10 text-yes hover:bg-yes hover:text-bg rounded" title="Republicar">
                          <RefreshCw size={15}/>
                        </button>
                      )}

                      <button onClick={() => deleteMarket(m.id)} className="p-1.5 bg-surface2 text-no/70 hover:text-no hover:bg-no/10 rounded ml-1" title="Excluir">
                        <Trash2 size={15}/>
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
              {markets.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-text-dim">Nenhum mercado encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <style>{`
            @keyframes slideUpSheet {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
          
          {/* Backdrop Escuro */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{animation: 'fadeIn 0.3s ease-out forwards'}} onClick={() => setModalOpen(false)}></div>
          
          {/* Bottom Sheet */}
          <div className="relative bg-surface border-t border-x sm:border-y border-border w-full max-w-2xl rounded-t-[32px] sm:rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl pb-10 sm:pb-8" style={{animation: 'slideUpSheet 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'}}>
            
            {/* Grab handle (indicador de arraste) */}
            <div className="w-16 h-1.5 bg-border rounded-full mx-auto mb-6 sm:hidden"></div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white">{formData.id ? 'Editar Mercado' : 'Novo Mercado'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-text-dim hover:text-white bg-surface2 p-2 rounded-full transition-transform hover:scale-105 active:scale-95"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-dim mb-1">Título da Aposta</label>
                <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: O Bitcoin vai bater US$ 100k?" className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-dim mb-1">Início (Agendamento)</label>
                  <input type="datetime-local" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-dim mb-1">Prazo de Encerramento</label>
                  <input type="datetime-local" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes [color-scheme:dark]" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-dim mb-1 flex justify-between items-center">
                    Categoria
                    <button type="button" onClick={handleAddCategory} className="text-yes hover:text-white text-xs px-2 py-0.5 rounded bg-yes/20 hover:bg-yes/40 transition-colors">
                      + Nova
                    </button>
                  </label>
                  <select value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes appearance-none">
                    {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                {!formData.id && formData.market_type === 'binary' && (
                  <div>
                    <label className="block text-sm font-semibold text-text-dim mb-1">Preço (Probabilidade %)</label>
                    <input type="number" min="1" max="99" value={formData.start_chance} onChange={e => setFormData({...formData, start_chance: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes" />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border mt-2">
                <label className="block text-sm font-semibold text-text-dim mb-2">Tipo de Mercado</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input type="radio" checked={formData.market_type === 'binary'} onChange={() => setFormData({...formData, market_type: 'binary'})} className="accent-yes" /> Binário (Sim / Não)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input type="radio" checked={formData.market_type === 'multiple'} onChange={() => setFormData({...formData, market_type: 'multiple'})} className="accent-yes" /> Múltipla Escolha
                  </label>
                </div>
                
                {formData.market_type === 'multiple' && (
                  <div className="bg-surface2 p-4 rounded-xl border border-border mb-4 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-bold text-white">Opções</h4>
                      <button type="button" onClick={() => setFormData({...formData, options: [...formData.options, {id: crypto.randomUUID(), title: `Opção ${formData.options.length + 1}`, price: 0}]})} className="text-xs bg-surface border border-border px-3 py-1 rounded hover:bg-border transition-colors text-white">+ Adicionar Opção</button>
                    </div>
                    {formData.options.map((opt, idx) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <input type="text" value={opt.title} onChange={e => { const newOpts = [...formData.options]; newOpts[idx].title = e.target.value; setFormData({...formData, options: newOpts}); }} placeholder="Título da Opção" className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-white outline-none focus:border-yes text-sm" />
                        <input type="number" min="0" max="100" value={opt.price} onChange={e => { const newOpts = [...formData.options]; newOpts[idx].price = Number(e.target.value); setFormData({...formData, options: newOpts}); }} placeholder="%" className="w-20 bg-surface border border-border rounded-lg px-3 py-1.5 text-white outline-none focus:border-yes text-sm" />
                        <button type="button" onClick={() => { const newOpts = formData.options.filter(o => o.id !== opt.id); setFormData({...formData, options: newOpts}); }} className="p-2 text-no hover:bg-no/20 rounded"><X size={16}/></button>
                      </div>
                    ))}
                    <div className="text-xs text-text-dim text-right mt-1">Soma atual: {formData.options.reduce((acc, o) => acc + o.price, 0)}% (Deve somar 100%)</div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border mt-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-text mb-4 cursor-pointer">
                  <input type="checkbox" checked={!!formData.video_type} onChange={e => setFormData({...formData, video_type: e.target.checked ? 'youtube' : null})} className="w-4 h-4 accent-yes" />
                  Habilitar Modo Câmera ao Vivo com IA
                </label>
                
                {!!formData.video_type && (
                  <div className="bg-surface2 p-4 rounded-xl border border-border space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-text-dim mb-1">Tipo de Vídeo</label>
                        <select value={formData.video_type} onChange={e => setFormData({...formData, video_type: e.target.value, video_url: ''})} className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes appearance-none">
                          <option value="youtube">YouTube (Live ou Gravado)</option>
                          <option value="ipcam">Câmera IP (M3U8 / HLS)</option>
                          <option value="static_link">Link de Vídeo Direto (.mp4)</option>
                          <option value="upload">Upload de Arquivo de Vídeo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-dim mb-1">Alvo da Detecção IA</label>
                        <select value={formData.ai_counter_type} onChange={e => setFormData({...formData, ai_counter_type: e.target.value})} className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes appearance-none">
                          <option value="carros">Carros na Via</option>
                          <option value="pessoas">Pessoas Passando</option>
                          <option value="motos">Motos / Motociclistas</option>
                          <option value="onibus">Ônibus</option>
                          <option value="avioes">Aviões</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-text-dim mb-1">URL do Vídeo / Arquivo</label>
                        {formData.video_type === 'upload' ? (
                          <input type="file" accept="video/mp4,video/*" onChange={async (e) => {
                            const file = e.target.files[0];
                            if(!file) return;
                            try {
                              const fName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                              const { data, error } = await supabase.storage.from('videos').upload(fName, file);
                              if(error) {
                                alert("Erro ao fazer upload (Crie o bucket 'videos' no Supabase!): " + error.message);
                              } else {
                                const { data: pData } = supabase.storage.from('videos').getPublicUrl(fName);
                                setFormData({...formData, video_url: pData.publicUrl});
                                alert("Upload concluído!");
                              }
                            } catch(err) {
                              alert("Erro no upload");
                            }
                          }} className="w-full bg-surface border border-border rounded-lg px-4 py-1.5 text-white outline-none focus:border-yes" />
                        ) : (
                          <input type="text" value={formData.video_url} onChange={e => setFormData({...formData, video_url: e.target.value})} placeholder={formData.video_type === 'youtube' ? "https://youtube.com/watch?v=..." : "https://site.com/video.mp4"} className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes" />
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-text-dim mb-1">Alvo para Vitória (Linha de Chegada)</label>
                        <input type="number" min="0" value={formData.ai_target_count} onChange={e => setFormData({...formData, ai_target_count: e.target.value})} placeholder="Ex: 50" className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes" />
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <label className="block text-sm font-semibold text-text-dim mb-2">Linha de Contagem da IA</label>
                      <p className="text-xs text-text-dim mb-3">Ajuste onde a linha vermelha deve ficar para contar perfeitamente no vídeo.</p>
                      
                      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border">
                         {formData.video_type === 'youtube' && formData.video_url ? (
                           <iframe
                             className="w-full h-full pointer-events-none opacity-50"
                             src={`https://www.youtube.com/embed/${formData.video_url.split('v=')[1]?.split('&')[0] || formData.video_url.split('/').pop()}?autoplay=1&mute=1`}
                             frameBorder="0"
                             allow="autoplay; encrypted-media"
                           ></iframe>
                         ) : (formData.video_type === 'static_link' || formData.video_type === 'upload') && formData.video_url ? (
                           <video 
                             src={formData.video_url} 
                             autoPlay loop muted playsInline
                             className="w-full h-full object-cover opacity-50 pointer-events-none"
                           />
                         ) : (
                           <div className="flex items-center justify-center w-full h-full text-text-dim text-sm">Preview do Vídeo</div>
                         )}
                         
                         {/* Linha de contagem visual via SVG */}
                         <svg 
                           className="absolute inset-0 w-full h-full z-10 touch-none" 
                           style={{ cursor: draggingPoint ? 'grabbing' : 'default' }}
                           viewBox="0 0 100 100" 
                           preserveAspectRatio="none"
                           onPointerMove={handlePointerMove}
                           onPointerUp={handlePointerUp}
                           onPointerLeave={handlePointerUp}
                         >
                            <line 
                              x1={`${(formData.ai_line_config?.x1 ?? 0) * 100}`} 
                              y1={`${(formData.ai_line_config?.y1 ?? 0.6) * 100}`} 
                              x2={`${(formData.ai_line_config?.x2 ?? 1) * 100}`} 
                              y2={`${(formData.ai_line_config?.y2 ?? 0.6) * 100}`} 
                              stroke="red" 
                              strokeWidth="1.5" 
                              strokeLinecap="round"
                              style={{ filter: 'drop-shadow(0px 0px 4px red)', pointerEvents: 'none' }}
                            />
                            {/* Ponto Arrastável Inicial */}
                            <circle 
                              cx={`${(formData.ai_line_config?.x1 ?? 0) * 100}`} 
                              cy={`${(formData.ai_line_config?.y1 ?? 0.6) * 100}`} 
                              r="4" 
                              fill="white" 
                              stroke="red" 
                              strokeWidth="1"
                              style={{ cursor: 'grab' }}
                              onPointerDown={handlePointerDown('p1')}
                            />
                            {/* Ponto Arrastável Final */}
                            <circle 
                              cx={`${(formData.ai_line_config?.x2 ?? 1) * 100}`} 
                              cy={`${(formData.ai_line_config?.y2 ?? 0.6) * 100}`} 
                              r="4" 
                              fill="white" 
                              stroke="red" 
                              strokeWidth="1"
                              style={{ cursor: 'grab' }}
                              onPointerDown={handlePointerDown('p2')}
                            />
                         </svg>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-text-dim flex justify-between">Início X (Esquerda/Direita) <span>{Math.round((formData.ai_line_config?.x1 ?? 0)*100)}%</span></label>
                          <input type="range" min="0" max="1" step="0.01" 
                            value={formData.ai_line_config?.x1 ?? 0} 
                            onChange={e => setFormData({...formData, ai_line_config: {...(formData.ai_line_config || {y1:0.6,x2:1,y2:0.6}), x1: parseFloat(e.target.value)}})}
                            className="accent-yes" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-text-dim flex justify-between">Início Y (Cima/Baixo) <span>{Math.round((formData.ai_line_config?.y1 ?? 0.6)*100)}%</span></label>
                          <input type="range" min="0" max="1" step="0.01" 
                            value={formData.ai_line_config?.y1 ?? 0.6} 
                            onChange={e => setFormData({...formData, ai_line_config: {...(formData.ai_line_config || {x1:0,x2:1,y2:0.6}), y1: parseFloat(e.target.value)}})}
                            className="accent-yes" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-text-dim flex justify-between">Fim X (Esquerda/Direita) <span>{Math.round((formData.ai_line_config?.x2 ?? 1)*100)}%</span></label>
                          <input type="range" min="0" max="1" step="0.01" 
                            value={formData.ai_line_config?.x2 ?? 1} 
                            onChange={e => setFormData({...formData, ai_line_config: {...(formData.ai_line_config || {x1:0,y1:0.6,y2:0.6}), x2: parseFloat(e.target.value)}})}
                            className="accent-yes" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-text-dim flex justify-between">Fim Y (Cima/Baixo) <span>{Math.round((formData.ai_line_config?.y2 ?? 0.6)*100)}%</span></label>
                          <input type="range" min="0" max="1" step="0.01" 
                            value={formData.ai_line_config?.y2 ?? 0.6} 
                            onChange={e => setFormData({...formData, ai_line_config: {...(formData.ai_line_config || {x1:0,y1:0.6,x2:1}), y2: parseFloat(e.target.value)}})}
                            className="accent-yes" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg font-semibold text-text-dim hover:text-white transition">Cancelar</button>
              <button onClick={saveMarket} className="px-5 py-2.5 rounded-lg font-bold bg-yes text-bg hover:brightness-110 transition">Publicar Mercado</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  
  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if(data) setUsers(data);
  }

  function openAdd() {
    setFormData({ name: '', wallet_address: '', role: 'user', balance: 1000 });
    setModalOpen(true);
  }

  function openEdit(u) {
    setFormData({ ...u });
    setModalOpen(true);
  }

  async function saveUser() {
    if (!formData.name) return alert("O nome é obrigatório.");
    if (formData.id) {
      await supabase.from('users').update({ 
        name: formData.name, 
        role: formData.role,
        wallet_address: formData.wallet_address,
        balance: parseFloat(formData.balance) || 0 
      }).eq('id', formData.id);
    } else {
      await supabase.from('users').insert({ 
        name: formData.name, 
        role: formData.role,
        wallet_address: formData.wallet_address,
        balance: parseFloat(formData.balance) || 0 
      });
    }
    setModalOpen(false);
    load();
  }

  async function deleteUser(id) {
    if(!window.confirm("Deseja realmente excluir este usuário e todo seu histórico (transações e apostas)?")) return;
    await supabase.from('transactions').delete().eq('user_id', id);
    await supabase.from('positions').delete().eq('user_id', id);
    await supabase.from('users').delete().eq('id', id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Estúdio de Usuários</h1>
        <button onClick={openAdd} className="bg-yes text-bg px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:brightness-110">
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface2 text-text-dim text-sm">
            <tr>
              <th className="p-4 font-semibold">Nome</th>
              <th className="p-4 font-semibold">Role</th>
              <th className="p-4 font-semibold">E-mail (Wallet)</th>
              <th className="p-4 font-semibold text-right">Saldo</th>
              <th className="p-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-surface2/50">
                <td className="p-4 font-medium">{u.name}</td>
                <td className="p-4"><span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">{u.role}</span></td>
                <td className="p-4 font-mono text-sm text-text-dim">{u.wallet_address || '-'}</td>
                <td className="p-4 font-mono text-right text-yes">R$ {u.balance}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(u)} className="p-1.5 bg-surface2 text-text-dim hover:text-white rounded" title="Editar">
                      <Edit2 size={15}/>
                    </button>
                    <button onClick={() => deleteUser(u.id)} className="p-1.5 bg-surface2 text-no/70 hover:text-no hover:bg-no/10 rounded" title="Excluir">
                      <Trash2 size={15}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-text-dim">Nenhum usuário cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{formData.id ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-text-dim hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-dim mb-1">Nome Completo</label>
                <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-dim mb-1">E-mail de Cadastro</label>
                <input value={formData.wallet_address} onChange={e => setFormData({...formData, wallet_address: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-dim mb-1">Permissão</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes appearance-none">
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-dim mb-1">Saldo (R$)</label>
                  <input type="number" value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})} className="w-full bg-surface2 border border-border rounded-lg px-4 py-2 text-white outline-none focus:border-yes" />
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg font-semibold text-text-dim hover:text-white transition">Cancelar</button>
              <button onClick={saveUser} className="px-5 py-2.5 rounded-lg font-bold bg-yes text-bg hover:brightness-110 transition">Salvar Dados</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionsPage() {
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    load();
    const sub = supabase.channel('admin:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, load)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  async function load() {
    const { data } = await supabase.from('transactions').select('*, users(name)').order('created_at', { ascending: false });
    if(data) setTxs(data);
  }

  async function handleStatus(id, newStatus, userId, amount, type) {
    if(!window.confirm(`Deseja marcar essa transação como ${newStatus.toUpperCase()}?`)) return;
    
    await supabase.from('transactions').update({ status: newStatus }).eq('id', id);
    
    // Se o admin REJEITAR o saque, o dinheiro deve voltar para o saldo do usuário
    if(newStatus === 'rejected' && type === 'withdraw') {
       const { data: u } = await supabase.from('users').select('balance').eq('id', userId).single();
       if(u) {
         await supabase.from('users').update({ balance: Number(u.balance) + Number(amount) }).eq('id', userId);
       }
    }

    // Se o admin APROVAR o depósito, o dinheiro é injetado no saldo do usuário
    if(newStatus === 'completed' && type === 'deposit') {
       const { data: u } = await supabase.from('users').select('balance').eq('id', userId).single();
       if(u) {
         await supabase.from('users').update({ balance: Number(u.balance) + Number(amount) }).eq('id', userId);
       }
    }
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Transações e Saques</h1>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface2 text-text-dim text-sm">
            <tr>
              <th className="p-4 font-semibold">Usuário</th>
              <th className="p-4 font-semibold">Tipo</th>
              <th className="p-4 font-semibold">Valor</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {txs.map(t => (
              <tr key={t.id} className="hover:bg-surface2/50">
                <td className="p-4 font-medium">{t.users?.name}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-1 rounded font-bold ${t.type === 'deposit' ? 'text-yes bg-yes/10' : 'text-no bg-no/10'}`}>
                    {t.type.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 font-mono">R$ {t.amount}</td>
                <td className="p-4">
                   <span className="text-xs text-text-dim bg-surface2 px-2 py-1 rounded">{t.status}</span>
                </td>
                <td className="p-4 text-right flex justify-end gap-2">
                  {t.status === 'pending' && (
                    <>
                      <button onClick={() => handleStatus(t.id, 'completed', t.user_id, t.amount, t.type)} className="p-2 bg-yes/10 text-yes rounded hover:bg-yes hover:text-bg"><Check size={16}/></button>
                      <button onClick={() => handleStatus(t.id, 'rejected', t.user_id, t.amount, t.type)} className="p-2 bg-no/10 text-no rounded hover:bg-no hover:text-bg"><X size={16}/></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {txs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-text-dim">Nenhuma transação.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    
    if (authErr) {
      setError(authErr.message === "Invalid login credentials" ? "Credenciais inválidas" : authErr.message);
      setLoading(false);
      return;
    }

    if (authData?.user) {
      // Verificar se é admin
      const { data: userData } = await supabase.from('users').select('role').eq('id', authData.user.id).single();
      
      if (userData?.role === 'admin') {
        onLogin(authData.session);
      } else {
        await supabase.auth.signOut();
        setError('Acesso negado. Esta conta não tem privilégios de administrador.');
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center p-4">
      <div className="bg-surface border border-border w-full max-w-sm rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded bg-gradient-to-br from-yes to-accent flex items-center justify-center font-bold text-bg text-xl">OX</div>
          <span className="font-bold text-2xl">Admin</span>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-dim mb-1">E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-white outline-none focus:border-yes" placeholder="admin@oraclex.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-dim mb-1">Senha</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-white outline-none focus:border-yes" placeholder="••••••••" />
          </div>

          {error && <div className="text-no text-sm font-semibold bg-no/10 p-3 rounded">{error}</div>}

          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-bold bg-yes text-bg hover:brightness-110 transition mt-4 flex justify-center">
            {loading ? <Loader2 size={20} className="animate-spin" /> : "Acessar Painel"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Verificar se é admin
        const { data: userData } = await supabase.from('users').select('role').eq('id', session.user.id).single();
        if (userData?.role === 'admin') {
          setSession(session);
        } else {
          await supabase.auth.signOut();
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-white"><Loader2 className="animate-spin" size={32}/></div>;
  }

  if (!session) {
    return <AdminLogin onLogin={setSession} />;
  }

  return (
    <BrowserRouter>
      <ToastContainer />
      <div className="flex min-h-screen bg-bg text-white">
        <Sidebar />
        <main className="flex-1 p-10">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
