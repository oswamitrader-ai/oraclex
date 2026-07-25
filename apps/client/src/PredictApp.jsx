import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Home, Search, Wallet, User, ChevronLeft, Clock, Flame, TrendingUp,
  TrendingDown, Star, ChevronRight, Bell, Menu, X, ArrowUpRight, ArrowDownRight,
  BarChart3, Settings, LogOut, Copy, Check, Mail, Loader2, ShieldCheck, Plus, Minus,
  Activity, Award, History, Edit3, Radio, Tv
} from "lucide-react";

function getYoutubeId(url) {
  if (!url) return '';
  let id = '';
  if (url.includes('v=')) {
    id = url.split('v=')[1]?.split('&')[0];
  } else if (url.includes('youtu.be/')) {
    id = url.split('youtu.be/')[1]?.split('?')[0];
  } else if (url.includes('/live/')) {
    id = url.split('/live/')[1]?.split('?')[0];
  } else {
    id = url.split('/').pop()?.split('?')[0];
  }
  return id || '';
}
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { supabase } from "./supabase";

/* ------------------------------------------------------------------ */
/*  MOCK DATA ENGINE                                                   */
/* ------------------------------------------------------------------ */

const CATEGORIES = ["Tendências", "Política", "Cripto", "Esportes", "Cultura", "Economia", "Ciência", "Clima"];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeHistory(seed, start, points = 48) {
  const rnd = seededRandom(seed);
  let p = start;
  const arr = [];
  for (let i = 0; i < points; i++) {
    p += (rnd() - 0.5) * 4;
    p = Math.max(2, Math.min(98, p));
    arr.push({ t: i, p: Math.round(p * 10) / 10 });
  }
  return arr;
}

const RAW_MARKETS = [
  { id: "m1", title: "O Bitcoin vai ultrapassar US$150.000 até dezembro de 2026?", category: "Cripto", icon: "₿", start: 62, vol: "R$ 8.4M" },
  { id: "m2", title: "Lula será candidato à reeleição em 2026?", category: "Política", icon: "🗳️", start: 81, vol: "R$ 12.1M" },
  { id: "m3", title: "Flamengo será campeão brasileiro 2026?", category: "Esportes", icon: "⚽", start: 34, vol: "R$ 3.2M" },
  { id: "m4", title: "Ethereum vai superar US$8.000 antes do fim do ano?", category: "Cripto", icon: "Ξ", start: 27, vol: "R$ 5.7M" },
  { id: "m5", title: "Nova temporada de The Last of Us estreia em 2026?", category: "Cultura", icon: "🎬", start: 71, vol: "R$ 1.1M" },
  { id: "m6", title: "Fed corta juros na próxima reunião de setembro?", category: "Economia", icon: "🏦", start: 55, vol: "R$ 9.9M" },
  { id: "m7", title: "SpaceX realiza pouso tripulado em Marte antes de 2030?", category: "Ciência", icon: "🚀", start: 18, vol: "R$ 2.4M" },
  { id: "m8", title: "2026 será o ano mais quente já registrado?", category: "Clima", icon: "🌡️", start: 64, vol: "R$ 1.8M" },
  { id: "m9", title: "Novak Djokovic vence mais um Grand Slam em 2026?", category: "Esportes", icon: "🎾", start: 46, vol: "R$ 2.9M" },
  { id: "m10", title: "Nova CPI é aberta no Congresso até outubro?", category: "Política", icon: "🏛️", start: 39, vol: "R$ 4.5M" },
  { id: "m11", title: "Apple lança óculos de RA antes do fim de 2026?", category: "Cultura", icon: "🕶️", start: 29, vol: "R$ 3.6M" },
  { id: "m12", title: "Solana ultrapassa US$400 em 2026?", category: "Cripto", icon: "◎", start: 22, vol: "R$ 6.3M" },
];

const INITIAL_MARKETS = RAW_MARKETS.map((m, i) => ({
  ...m,
  yes: m.start,
  history: makeHistory(i + 1, m.start),
}));

const SHARED_STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

        .pm-root {
          --bg: #0a0c0e;
          --surface: #131619;
          --surface2: #1a1e22;
          --border: #23282d;
          --border-soft: #1c2024;
          --text: #edeff1;
          --text-dim: #8b939b;
          --text-faint: #5b6167;
          --yes: #00d992;
          --yes-dim: rgba(0,217,146,0.12);
          --no: #ff5170;
          --no-dim: rgba(255,81,112,0.12);
          --accent: #1652f0;
          --radius: 12px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          position: relative;
          padding-bottom: 76px;
          -webkit-font-smoothing: antialiased;
        }
        .pm-root * { box-sizing: border-box; }
        .pm-root button { font-family: inherit; cursor: pointer; }
        .pm-root input { font-family: inherit; }

        /* ---- top bar ---- */
        .topbar {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px 10px;
          background: rgba(10,12,14,0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border-soft);
        }
        .brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 17px; letter-spacing: -0.02em; }
        .brand-mark {
          width: 26px; height: 26px; border-radius: 7px;
          background: linear-gradient(135deg, var(--yes), var(--accent));
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; color: #05130d;
        }
        .topbar-right { display: flex; align-items: center; gap: 10px; }
        .balance-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px; font-weight: 700;
          background: var(--surface2); border: 1px solid var(--border);
          padding: 6px 10px; border-radius: 20px; color: var(--yes);
        }
        .icon-btn {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--surface2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; color: var(--text-dim);
        }

        .screen { padding: 14px 16px 24px; animation: fadein .25s ease; }
        @keyframes fadein { from { opacity: 0; transform: translateY(4px);} to { opacity:1; transform:none; } }
        .screen-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 4px 0 16px; }
        .screen-subtitle { font-size: 14px; color: var(--text-dim); margin-top: -12px; margin-bottom: 20px; }

        /* ---- search / chips ---- */
        .search-mobile {
          display: flex; align-items: center; gap: 8px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; color: var(--text-dim);
        }
        .search-mobile input {
          background: transparent; border: none; outline: none; color: var(--text);
          font-size: 14px; width: 100%;
        }
        .chips-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; scrollbar-width: none; }
        .chips-row::-webkit-scrollbar { display: none; }
        .chip {
          flex-shrink: 0; padding: 7px 13px; border-radius: 20px; border: 1px solid var(--border);
          background: var(--surface); color: var(--text-dim); font-size: 13px; font-weight: 600;
          display: flex; align-items: center; transition: all .15s ease;
        }
        .chip-active { background: var(--text); color: #0a0c0e; border-color: var(--text); }

        /* ---- tabs layout (for portfolio) ---- */
        .page-tabs { display: flex; gap: 16px; border-bottom: 1px solid var(--border-soft); margin-bottom: 16px; }
        .page-tab { 
          padding: 10px 4px; background: transparent; border: none; color: var(--text-dim); font-size: 14px; font-weight: 600; 
          position: relative;
        }
        .page-tab.active { color: var(--text); }
        .page-tab.active::after {
          content: ""; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: var(--yes); border-radius: 2px;
        }

        /* ---- market card ---- */
        .grid { display: flex; flex-direction: column; gap: 10px; }
        .card {
          background: var(--surface); border: 1px solid var(--border-soft);
          border-radius: var(--radius); padding: 14px;
          transition: transform .15s ease, border-color .15s ease, background .15s ease;
        }
        .card:hover { border-color: var(--border); background: var(--surface2); transform: translateY(-1px); }
        .card-top { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
        .card-icon {
          width: 34px; height: 34px; border-radius: 9px; background: var(--surface2);
          border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .card-icon.lg { width: 44px; height: 44px; font-size: 20px; border-radius: 11px; }
        .card-title { font-size: 14.5px; font-weight: 600; line-height: 1.35; letter-spacing: -0.01em; }
        .card-mid { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .card-mid > div:first-child { flex: 1; }
        .card-pct-block { text-align: right; flex-shrink: 0; }
        .card-pct { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; line-height: 1; }
        .card-pct-label { font-size: 10.5px; color: var(--text-faint); margin-top: 2px; }

        .probbar { height: 5px; border-radius: 3px; background: var(--no-dim); overflow: hidden; margin-bottom: 12px; }
        .probbar-fill { height: 100%; background: var(--yes); border-radius: 3px; transition: width .4s ease; }

        .card-actions { display: flex; gap: 8px; margin-bottom: 10px; }
        .btn-yes, .btn-no {
          flex: 1; padding: 9px 0; border-radius: 8px; font-size: 12.5px; font-weight: 700;
          border: 1px solid transparent; transition: all .15s ease;
        }
        .btn-yes { background: var(--yes-dim); color: var(--yes); }
        .btn-yes:hover { background: var(--yes); color: #04120c; }
        .btn-no { background: var(--no-dim); color: var(--no); }
        .btn-no:hover { background: var(--no); color: #1a0508; }

        .card-foot { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-faint); }
        .dot { opacity: .6; }
        .empty { padding: 40px 10px; text-align: center; color: var(--text-faint); font-size: 13.5px; }

        /* ---- detail screen ---- */
        .back-btn {
          display: flex; align-items: center; gap: 4px; background: none; border: none;
          color: var(--text-dim); font-size: 13.5px; font-weight: 600; margin-bottom: 14px; padding: 0;
        }
        .detail-header { display: flex; gap: 12px; margin-bottom: 18px; }
        .detail-header h1 { font-size: 17px; font-weight: 700; line-height: 1.35; letter-spacing: -0.01em; margin: 0 0 6px; }
        .detail-meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11.5px; color: var(--text-faint); align-items: center; }
        .flex-inline { display: inline-flex; align-items: center; gap: 3px; }

        .detail-price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
        .big-pct { font-family: 'JetBrains Mono', monospace; font-size: 40px; font-weight: 800; letter-spacing: -0.02em; }
        .big-pct-label { font-size: 13px; color: var(--text-dim); }

        .chart-card {
          background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius);
          padding: 10px 6px 12px; margin-bottom: 18px;
        }
        .tf-row { display: flex; gap: 4px; padding: 6px 10px 0; }
        .tf-btn { flex: 1; padding: 6px 0; border-radius: 6px; border: none; background: transparent; color: var(--text-faint); font-size: 11.5px; font-weight: 600; }
        .tf-active { background: var(--surface2); color: var(--text); }

        .outcome-row { display: flex; justify-content: space-between; padding: 0 2px 8px; font-size: 12px; color: var(--text-faint); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
        .outcome-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
        .outcome-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 13px 14px; border-radius: 10px; background: var(--surface);
          border: 1.5px solid var(--border-soft); color: var(--text); font-size: 14px; font-weight: 600;
        }
        .outcome-active-yes { border-color: var(--yes); background: var(--yes-dim); }
        .outcome-active-no { border-color: var(--no); background: var(--no-dim); }
        .outcome-price { font-family: 'JetBrains Mono', monospace; font-weight: 700; }
        .outcome-price.yes { color: var(--yes); }
        .outcome-price.no { color: var(--no); }

        .trade-panel { position: relative; overflow: hidden; background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 16px; }
        .trade-tabs { display: flex; background: var(--surface2); border-radius: 10px; padding: 4px; margin-bottom: 16px; }
        .trade-tabs button { flex: 1; padding: 9px 0; border: none; background: transparent; border-radius: 8px; color: var(--text-dim); font-weight: 700; font-size: 13px; transition: all .15s; }
        .trade-tabs button.active { background: var(--text); color: #0a0c0e; }
        
        .amount-label { font-size: 11.5px; color: var(--text-faint); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
        .amount-input-row {
          display: flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 10px;
          padding: 12px 14px; margin: 8px 0 10px; background: var(--bg); transition: border-color .2s;
        }
        .amount-input-row:focus-within { border-color: var(--yes); }
        .amount-input-row span { color: var(--text-faint); font-weight: 700; }
        .amount-input-row input {
          background: transparent; border: none; outline: none; color: var(--text);
          font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; width: 100%;
        }
        .quick-amounts { display: flex; gap: 8px; margin-bottom: 16px; }
        .quick-amounts button {
          flex: 1; padding: 7px 0; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2);
          color: var(--text-dim); font-size: 12px; font-weight: 700; transition: background .1s;
        }
        .quick-amounts button:active { background: var(--surface); }
        
        .trade-summary { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; font-size: 13px; }
        .trade-summary > div { display: flex; justify-content: space-between; color: var(--text-dim); }
        .trade-summary .highlight { color: var(--text); font-weight: 700; }
        .trade-summary .highlight em { font-style: normal; color: var(--yes); font-size: 11.5px; margin-left: 4px; }
        .trade-submit { width: 100%; padding: 14px 0; border-radius: 10px; border: none; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; transition: transform .1s, opacity .2s; }
        .trade-submit:active { transform: scale(0.98); }
        .trade-submit.yes { background: var(--yes); color: #04120c; }
        .trade-submit.no { background: var(--no); color: #1a0508; }
        .trade-submit.neutral { background: var(--text); color: #0a0c0e; }
        .trade-submit:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .balance-note { text-align: center; font-size: 11.5px; color: var(--text-faint); margin-top: 10px; }

        /* ---- portfolio / minhas apostas ---- */
        .portfolio-summary { display: flex; justify-content: space-between; background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 16px; margin-bottom: 18px; }
        .ps-label { font-size: 11px; color: var(--text-faint); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .ps-value { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; }
        .pos-list { display: flex; flex-direction: column; gap: 8px; }
        .pos-item { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--border-soft); border-radius: 10px; padding: 12px; transition: transform .15s; }
        .pos-info { flex: 1; min-width: 0; }
        .pos-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pos-sub { font-size: 11.5px; color: var(--text-faint); display: flex; align-items: center; gap: 6px; }
        .tag-yes, .tag-no, .tag-status { font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
        .tag-yes { background: var(--yes-dim); color: var(--yes); }
        .tag-no { background: var(--no-dim); color: var(--no); }
        .tag-status { background: var(--surface2); color: var(--text-dim); border: 1px solid var(--border); }
        
        .pos-value { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; flex-shrink: 0; }

        /* ---- wallet screen ---- */
        .wallet-card { background: linear-gradient(135deg, rgba(22,82,240,0.1), rgba(0,217,146,0.1)); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 20px; margin-bottom: 24px; text-align: center; }
        .wc-label { font-size: 13px; color: var(--text-dim); margin-bottom: 8px; font-weight: 600; }
        .wc-balance { font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 800; color: var(--text); margin-bottom: 20px; }
        .wc-actions { display: flex; gap: 10px; }
        .wc-btn { flex: 1; padding: 12px 0; border-radius: 10px; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; transition: transform .1s; }
        .wc-btn:active { transform: scale(0.97); }
        .wc-btn.deposit { background: var(--yes); color: #04120c; }
        .wc-btn.withdraw { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
        
        .tx-list { display: flex; flex-direction: column; gap: 0; }
        .tx-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-soft); }
        .tx-item:last-child { border-bottom: none; }
        .tx-left { display: flex; align-items: center; gap: 12px; }
        .tx-icon { width: 36px; height: 36px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
        .tx-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
        .tx-date { font-size: 12px; color: var(--text-faint); }
        .tx-amount { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; }
        .tx-amount.positive { color: var(--yes); }
        .tx-amount.negative { color: var(--text); }

        /* ---- profile ---- */
        .profile-card { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; background: var(--surface); padding: 16px; border-radius: var(--radius); border: 1px solid var(--border-soft); }
        .avatar { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--yes)); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: #05130d; }
        .profile-name { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .profile-name button { background: none; border: none; color: var(--text-faint); padding: 0; display: flex; }
        .profile-wallet { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-faint); display: flex; align-items: center; gap: 5px; margin-top: 6px; cursor: pointer; padding: 4px 8px; background: var(--surface2); border-radius: 6px; border: 1px solid var(--border); width: fit-content; }
        
        .profile-stats { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 24px; }
        .p-stat { flex: 1; background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 16px; text-align: center; }
        .p-stat .ps-value { font-size: 20px; font-weight: 800; margin-bottom: 4px; font-family: 'JetBrains Mono', monospace; }
        .p-stat .ps-label { font-size: 11px; color: var(--text-faint); text-transform: uppercase; font-weight: 600; }

        .achievements { margin-bottom: 24px; }
        .ach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
        .ach-card { background: var(--surface); border: 1px solid var(--border-soft); border-radius: 10px; padding: 12px 8px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .ach-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--surface2); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; font-size: 18px; }
        .ach-title { font-size: 11px; font-weight: 700; color: var(--text); }
        
        .settings-list { display: flex; flex-direction: column; gap: 8px; }
        .settings-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border-soft); border-radius: 12px; font-size: 14px; font-weight: 600; color: var(--text); cursor: pointer; transition: background .15s; }
        .settings-item:hover { background: var(--surface2); }
        .si-left { display: flex; align-items: center; gap: 12px; color: var(--text-dim); }
        .settings-item.danger .si-left { color: var(--no); }

        /* ---- bottom nav ---- */
        .bottom-nav {
          position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
          width: 100%; max-width: 480px;
          display: flex; justify-content: space-around; align-items: center;
          background: rgba(19,22,25,0.96); backdrop-filter: blur(10px);
          border-top: 1px solid var(--border-soft); padding: 10px 0 14px; z-index: 40;
        }
        .nav-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; color: var(--text-faint); font-size: 10.5px; font-weight: 600; }
        .nav-btn.active { color: var(--text); }

        @media (min-width: 481px) {
          .pm-root { max-width: 100%; padding-bottom: 76px; border-radius: 0; }
          .topbar { padding: 16px 32px; }
          .screen { max-width: 900px; margin: 0 auto; padding: 24px 32px 60px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .detail { max-width: 640px; }
        }
      
        /* ---- auth screen ---- */
        .auth-screen {
          min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 40px 28px; text-align: center;
        }
        .auth-mark {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, var(--yes), var(--accent));
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 24px; color: #05130d; margin-bottom: 18px;
        }
        .auth-screen h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 8px; }
        .auth-sub { font-size: 13.5px; color: var(--text-dim); max-width: 300px; margin: 0 0 32px; line-height: 1.5; }
        .auth-options { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 10px; }
        .auth-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px 0; border-radius: 10px; font-size: 14px; font-weight: 700;
          border: 1px solid var(--border); background: var(--surface); color: var(--text);
          transition: all .15s ease;
        }
        .auth-btn:hover { background: var(--surface2); border-color: var(--text-faint); }
        .auth-btn.wallet { background: var(--yes); color: #04120c; border: none; }
        .auth-btn.wallet:hover { filter: brightness(1.08); }
        .auth-terms { font-size: 10.5px; color: var(--text-faint); margin-top: 14px; line-height: 1.5; }
        .auth-loading { display: flex; align-items: center; gap: 10px; color: var(--text-dim); font-size: 14px; font-weight: 600; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-email-form { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 10px; text-align: left; }
        .auth-email-form label { font-size: 11.5px; color: var(--text-faint); font-weight: 600; }
        .auth-email-form input {
          background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
          padding: 12px 14px; color: var(--text); font-size: 14px; outline: none;
        }
        .auth-submit { padding: 12px 0; border-radius: 10px; border: none; background: var(--yes); color: #04120c; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .auth-back { display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--text-faint); font-size: 12.5px; margin-top: 4px; align-self: center; }
        .auth-method-tag { font-size: 11px; color: var(--text-faint); margin: -12px 0 16px; }

        /* ---- Generic Modal ---- */
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100;
          display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(2px);
        }
        .modal-sheet {
          width: 100%; max-width: 480px; background: var(--surface); border: 1px solid var(--border);
          border-bottom: none; border-radius: 18px 18px 0 0; padding: 18px 18px 26px;
          animation: slideup .22s ease;
        }
        @keyframes slideup { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
        .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .modal-head h3 { font-size: 16px; font-weight: 800; margin: 0; }
`;

/* ------------------------------------------------------------------ */
/*  SMALL UI PRIMITIVES                                                */
/* ------------------------------------------------------------------ */

function fmtPct(n) {
  return `${Math.round(n)}%`;
}

function Sparkline({ data, positive }) {
  const stroke = positive ? "var(--yes)" : "var(--no)";
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${positive ? "y" : "n"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="p" stroke={stroke} strokeWidth={1.75}
          fill={`url(#spark-${positive ? "y" : "n"})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ProbBar({ yes }) {
  return (
    <div className="probbar">
      <div className="probbar-fill" style={{ width: `${yes}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI COUNTER OVERLAY (SIMULATOR & HUD)                               */
/* ------------------------------------------------------------------ */

function AICounterOverlay({ type, dbCount = 0 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* HUD Info */}
      <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.7)', border: '1px solid #00ff00', borderRadius: 8, padding: '6px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}>
        <div style={{ color: '#00ff00', fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>VISÃO COMPUTACIONAL</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{type.toUpperCase()}:</span>
          <span style={{ color: '#00ff00', fontSize: 18, fontFamily: 'monospace', fontWeight: 900 }}>{String(dbCount).padStart(4, '0')}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MARKET CARD                                                        */
/* ------------------------------------------------------------------ */

function MarketCard({ m, onOpen }) {
  const positive = m.yes >= (m.history[0]?.p ?? m.yes);
  const isScheduled = m.start_date && new Date() < new Date(m.start_date);
  const isExpired = m.end_date && new Date() > new Date(m.end_date);
  const isClosed = m.status === 'closed';
  const canTrade = !isScheduled && !isExpired && !isClosed;
  const isLiveVideo = !!m.video_type;
  const endDateFmt = m.end_date ? new Date(m.end_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null;
  const startDateFmt = m.start_date ? new Date(m.start_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null;

  return (
    <div 
      className={`card ${!canTrade && !isScheduled ? 'opacity-70' : ''}`} 
      style={isLiveVideo ? { 
        border: '1px solid rgba(255, 60, 60, 0.4)', 
        background: 'linear-gradient(180deg, var(--surface) 0%, rgba(255, 60, 60, 0.03) 100%)',
        boxShadow: '0 4px 20px rgba(255, 60, 60, 0.05)'
      } : {}} 
      onClick={() => onOpen(m)}
    >
      <div className="card-top">
        <div className="card-icon">{m.icon}</div>
        <div className="card-title" style={{ flex: 1 }}>{m.title}</div>
        {isLiveVideo && (
          <div style={{ background: 'var(--no-dim)', color: 'var(--no)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 900, height: 'fit-content', border: '1px solid var(--no)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, background: 'var(--no)', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
            AO VIVO
          </div>
        )}
      </div>

      <div className="card-mid">
        <Sparkline data={m.history} positive={positive} />
        <div className="card-pct-block">
          <div className="card-pct" style={{ color: positive ? "var(--yes)" : "var(--no)" }}>
            {fmtPct(m.yes)}
          </div>
          <div className="card-pct-label">chance</div>
        </div>
      </div>

      <ProbBar yes={m.yes} />

      <div className="card-actions">
        {canTrade ? (
          <>
            <button className="btn-yes" onClick={(e) => { e.stopPropagation(); onOpen(m, "yes"); }}>
              Sim · {fmtPct(m.yes)}
            </button>
            <button className="btn-no" onClick={(e) => { e.stopPropagation(); onOpen(m, "no"); }}>
              Não · {fmtPct(100 - m.yes)}
            </button>
          </>
        ) : isScheduled ? (
           <div style={{ width: '100%', textAlign: 'center', background: 'var(--surface2)', color: 'var(--text-dim)', padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
             COMEÇA EM {startDateFmt}
           </div>
        ) : (
           <div style={{ width: '100%', textAlign: 'center', background: 'var(--surface2)', color: 'var(--text-dim)', padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
             {isClosed ? `VENCEU ${m.winner_side.toUpperCase()}` : 'AGUARDANDO RESULTADO'}
           </div>
        )}
      </div>

      <div className="card-foot">
        <span>{m.vol} vol.</span>
        <span className="dot">•</span>
        <span>{m.category}</span>
        {endDateFmt && (
          <>
            <span className="dot">•</span>
            <span><Clock size={10} style={{display:'inline', marginBottom:-2}}/> {endDateFmt}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HOME SCREEN                                                        */
/* ------------------------------------------------------------------ */

function HomeScreen({ markets, onOpen, query, setQuery }) {
  const visible = markets.filter((m) => {
    if (m.status !== 'active') return false;
    if (m.video_type) return false; // Hide video markets from home
    if (query && !m.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="screen">
      <div className="search-mobile">
        <Search size={18} />
        <input 
          type="text" 
          placeholder="Buscar mercados..." 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
        />
      </div>
      {visible.length === 0 ? (
        <div className="empty">Nenhum mercado encontrado.</div>
      ) : (
        <div className="grid">
          {visible.map((m) => (
            <MarketCard key={m.id} m={m} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LIVE MARKET CARD & SCREEN                                          */
/* ------------------------------------------------------------------ */
function CountdownTimer({ endDate }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if(!endDate) return;
    const end = new Date(endDate).getTime();
    
    const tick = () => {
      const now = new Date().getTime();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft('ENCERRADO');
        setUrgent(false);
        return;
      }
      
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      setUrgent(diff < 60000); // Menos de 1 minuto
    };
    
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (!endDate || timeLeft === 'ENCERRADO') return null;

  return (
    <div style={{ 
      position: 'absolute', bottom: 12, right: 12, 
      background: urgent ? 'rgba(255, 60, 60, 0.9)' : 'rgba(0, 0, 0, 0.7)', 
      color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 14, fontWeight: 900, 
      fontFamily: 'monospace', backdropFilter: 'blur(4px)', 
      border: urgent ? '1px solid #ffaaaa' : '1px solid rgba(255,255,255,0.2)', 
      animation: urgent ? 'pulse 1s infinite' : 'none' 
    }}>
      ⏱ {timeLeft}
    </div>
  );
}

function LiveMarketCard({ m, onTrade, balance }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isScheduled = m.start_date && now < new Date(m.start_date);
  const isExpired = m.end_date && now > new Date(m.end_date);
  const isClosed = m.status === 'closed';
  const canTrade = !isScheduled && !isExpired && !isClosed;
  
  const [side, setSide] = useState("yes");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  
  const price = side === "yes" ? m.yes : 100 - m.yes;
  const numAmount = parseFloat(amount) || 0;
  const shares = price > 0 ? (numAmount / (price / 100)) : 0;
  
  const handleTrade = () => {
    if (numAmount <= 0) return;
    onTrade({ marketId: m.id, side, amount: numAmount, price, shares, title: m.title });
    setConfirmed(true);
    setTimeout(() => {
      setConfirmed(false);
      setAmount("");
    }, 1800);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 24 }}>
      {/* Video Area */}
      <div style={{ position: 'relative', width: '100%', background: '#111', aspectRatio: '16/9', overflow: 'hidden' }}>
        {m.video_type === 'youtube' ? (
          <iframe 
            src={`https://www.youtube.com/embed/${getYoutubeId(m.video_url)}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1`}
            style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            allow="autoplay; encrypted-media"
            title="Live Stream"
          />
        ) : (
          <img 
            src={`http://192.168.2.112:5000/video_feed/${m.id}`} 
            alt="Foresight AI Stream"
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        )}
        <div style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, textAlign: 'center', padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Tv size={32} opacity={0.5} />
            Sem sinal de vídeo.<br/>Aguardando a conexão da Inteligência Artificial.
          </div>
        </div>
        
        <AICounterOverlay type={m.ai_counter_type} dbCount={m.ai_current_count} />
        {/* Live Badge over video */}
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255, 60, 60, 0.9)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(4px)' }}>
          <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
          AO VIVO
        </div>
        <CountdownTimer endDate={m.end_date} />
      </div>

      {/* Info & Trade Area */}
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px 0', lineHeight: 1.3 }}>{m.title}</h2>
        
        {/* Probabilities Bar */}
        <ProbBar yes={m.yes} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 16 }}>
          <span style={{ color: 'var(--yes)' }}>SIM: {m.yes}%</span>
          <span style={{ color: 'var(--no)' }}>NÃO: {100 - m.yes}%</span>
        </div>

        {canTrade ? (
          <div className={`trade-panel ${side}`} style={{ margin: 0, padding: 16, borderRadius: 12, background: 'var(--surface2)' }}>
            
            {confirmed && (
              <div style={{ position: 'absolute', inset: 0, background: 'var(--surface)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', animation: 'slideup 0.2s ease-out' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: side === 'yes' ? 'var(--yes-dim)' : 'var(--no-dim)', color: side === 'yes' ? 'var(--yes)' : 'var(--no)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Check size={28} />
                </div>
                <strong style={{ fontSize: 18, marginBottom: 4 }}>Ordem Confirmada!</strong>
                <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 600 }}>Cotas de <b>{side === 'yes' ? 'SIM' : 'NÃO'}</b> adquiridas</span>
              </div>
            )}

            <div className="trade-tabs">
              <button className={`trade-tab ${side === "yes" ? "active" : ""}`} onClick={() => setSide("yes")}>SIM</button>
              <button className={`trade-tab ${side === "no" ? "active" : ""}`} onClick={() => setSide("no")}>NÃO</button>
            </div>
            
            <div className="amount-input-row">
              <span>R$</span>
              <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <button className={`trade-submit ${side}`} onClick={handleTrade} disabled={numAmount <= 0 || numAmount > balance || confirmed} style={{ marginTop: 12 }}>
              {confirmed ? <Check size={20} /> : (numAmount > balance ? "Saldo Insuficiente" : `Comprar ${side === "yes" ? "SIM" : "NÃO"}`)}
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', textAlign: 'center', background: 'var(--surface2)', color: 'var(--text-dim)', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            {isClosed ? `VENCEU ${m.winner_side.toUpperCase()}` : isScheduled ? 'COMEÇA EM BREVE' : 'AGUARDANDO RESULTADO'}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveScreen({ markets, onTrade, balance }) {
  const visible = markets.filter(m => m.video_type && m.status === 'active');

  return (
    <div className="screen" style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Radio size={24} color="var(--no)" /> Câmeras Ao Vivo
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>Apostas em tempo real com Visão Computacional</p>
      </div>

      {visible.length === 0 ? (
        <div className="empty">Nenhuma câmera ao vivo no momento.</div>
      ) : (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {visible.map((m) => (
            <LiveMarketCard key={m.id} m={m} onTrade={onTrade} balance={balance} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MARKET DETAIL SCREEN                                               */
/* ------------------------------------------------------------------ */

const TIMEFRAMES = ["1H", "6H", "1D", "1S", "1M", "TUDO"];

function MarketDetail({ m, onBack, initialSide, onTrade, balance }) {
  const [side, setSide] = useState(initialSide === "no" ? "no" : "yes");
  const [tf, setTf] = useState("1D");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { setSide(initialSide === "no" ? "no" : "yes"); }, [initialSide, m.id]);

  const isScheduled = m.start_date && new Date() < new Date(m.start_date);
  const isExpired = m.end_date && new Date() > new Date(m.end_date);
  const isClosed = m.status === 'closed';
  const canTrade = !isScheduled && !isExpired && !isClosed;
  const endDateFmt = m.end_date ? new Date(m.end_date).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const startDateFmt = m.start_date ? new Date(m.start_date).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  const price = side === "yes" ? m.yes : 100 - m.yes;
  const numAmount = parseFloat(amount) || 0;
  const shares = price > 0 ? (numAmount / (price / 100)) : 0;
  const payout = shares;
  const profit = payout - numAmount;

  const sliceLen = { "1H": 6, "6H": 12, "1D": 24, "1S": 36, "1M": 48, "TUDO": 48 }[tf];
  const data = m.history.slice(-sliceLen);

  const handleTrade = () => {
    if (numAmount <= 0) return;
    onTrade({ marketId: m.id, side, amount: numAmount, price, shares, title: m.title });
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 1800);
    setAmount("");
  };

  return (
    <div className="screen detail">
      <button className="back-btn" onClick={onBack}>
        <ChevronLeft size={18} /> Voltar
      </button>

      <div className="detail-header">
        <div className="card-icon lg">{m.icon}</div>
        <div>
          <h1>{m.title}</h1>
          <div className="detail-meta">
            <span>{m.vol} volume</span>
            <span className="dot">•</span>
            <span>{m.category}</span>
            {isScheduled && startDateFmt && (
              <>
                <span className="dot">•</span>
                <span className="flex-inline"><Clock size={12} /> Inicia {startDateFmt}</span>
              </>
            )}
            {!isScheduled && endDateFmt && (
              <>
                <span className="dot">•</span>
                <span className="flex-inline"><Clock size={12} /> Encerra {endDateFmt}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="detail-price-row">
        <div className="big-pct" style={{ color: "var(--yes)" }}>{fmtPct(m.yes)}</div>
        <div className="big-pct-label">de chance em <b>Sim</b></div>
      </div>

      {m.video_type ? (
        <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 18, border: '1px solid var(--border-soft)', background: '#000', aspectRatio: '16/9' }}>
          {m.video_type === 'youtube' && (
            <iframe 
              width="100%" height="100%" 
              src={`https://www.youtube.com/embed/${getYoutubeId(m.video_url)}?autoplay=1&mute=1&controls=0`} 
              frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
          )}
          {(m.video_type === 'ipcam' || m.video_type === 'upload') && (
            <video src={m.video_url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <AICounterOverlay type={m.ai_counter_type} dbCount={m.ai_current_count} />
        </div>
      ) : (
        <div className="chart-card">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--yes)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--yes)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={() => ""} formatter={(v) => [`${v}%`, "Sim"]}
              />
              <Area type="monotone" dataKey="p" stroke="var(--yes)" strokeWidth={2} fill="url(#mainGrad)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="tf-row">
            {TIMEFRAMES.map((t) => (
              <button key={t} className={`tf-btn ${tf === t ? "tf-active" : ""}`} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>
        </div>
      )}

      <div className="outcome-row">
        <div className="outcome-label">Resultado</div>
        <div className="outcome-cols"><span>Preço</span></div>
      </div>
      <div className="outcome-list">
        <button className={`outcome-item ${side === "yes" ? "outcome-active-yes" : ""}`} onClick={() => setSide("yes")}>
          <span>Sim</span>
          <span className="outcome-price yes">{fmtPct(m.yes)}¢</span>
        </button>
        <button className={`outcome-item ${side === "no" ? "outcome-active-no" : ""}`} onClick={() => setSide("no")}>
          <span>Não</span>
          <span className="outcome-price no">{fmtPct(100 - m.yes)}¢</span>
        </button>
      </div>

      <div className={`trade-panel ${side}`}>
        
        {confirmed && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--surface)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', animation: 'slideup 0.2s ease-out' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: side === 'yes' ? 'var(--yes-dim)' : 'var(--no-dim)', color: side === 'yes' ? 'var(--yes)' : 'var(--no)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Check size={32} />
            </div>
            <strong style={{ fontSize: 20, marginBottom: 4 }}>Ordem de R$ {numAmount.toFixed(2)} Enviada!</strong>
            <span style={{ fontSize: 14, color: 'var(--text-faint)', fontWeight: 600 }}>Você comprou {shares.toFixed(2)} cotas de {side === 'yes' ? 'SIM' : 'NÃO'}</span>
          </div>
        )}

        <div className="trade-tabs">
          <button className={side === "yes" ? "active" : ""} onClick={() => setSide("yes")}>Comprar Sim</button>
          <button className={side === "no" ? "active" : ""} onClick={() => setSide("no")}>Comprar Não</button>
        </div>

        {isScheduled ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
               <Clock size={32} opacity={0.5} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Mercado Agendado</h3>
            <p style={{ margin: '8px 0 0 0', fontSize: 13, lineHeight: 1.4 }}>
              As apostas estarão disponíveis a partir de:<br/><b style={{color: 'white'}}>{startDateFmt}</b>
            </p>
          </div>
        ) : !canTrade ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
               <Clock size={32} opacity={0.5} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              {isClosed ? `Aposta Resolvida (${m.winner_side === 'yes' ? 'SIM' : 'NÃO'})` : 'Apostas Encerradas'}
            </h3>
            <p style={{ margin: '8px 0 0 0', fontSize: 13, lineHeight: 1.4 }}>
              {isClosed ? 'Os lucros já foram distribuídos para os vencedores.' : 'O prazo expirou e a aposta está aguardando apuração oficial dos resultados.'}
            </p>
          </div>
        ) : (
          <>
            <label className="amount-label">Valor (R$)</label>
            <div className="amount-input-row">
              <span>R$</span>
              <input type="number" min="0" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="quick-amounts">
              {[10, 50, 100, 500].map((v) => (
                <button key={v} onClick={() => setAmount(String(v))}>+{v}</button>
              ))}
            </div>

            <div className="trade-summary">
              <div><span>Preço médio</span><span>{price.toFixed(1)}¢</span></div>
              <div><span>Cotas</span><span>{shares.toFixed(2)}</span></div>
              <div className="highlight"><span>Retorno potencial</span><span>R$ {payout.toFixed(2)} {numAmount > 0 && <em>(+R$ {profit.toFixed(2)})</em>}</span></div>
            </div>

            <button className={`trade-submit ${side}`} onClick={handleTrade} disabled={numAmount <= 0 || numAmount > balance}>
              {confirmed ? <><Check size={16} /> Ordem enviada</> : numAmount > balance ? "Saldo insuficiente" : `Comprar ${side === "yes" ? "Sim" : "Não"}`}
            </button>
            <div className="balance-note">Saldo disponível: R$ {balance.toFixed(2)}</div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PORTFOLIO SCREEN (MINHAS APOSTAS)                                  */
/* ------------------------------------------------------------------ */

function PortfolioScreen({ positions, markets, balance, onCashout }) {
  const [filter, setFilter] = useState("ativas"); // ativas | encerradas

  // Agrupar posições por (mercado + lado + status)
  const groupedPositions = useMemo(() => {
    const groups = {};
    positions.forEach(p => {
      const isCashedOut = p.status === 'cashed_out';
      const isClosed = markets.find(m => m.id === p.marketId)?.status === 'closed';
      const virtualStatus = (isClosed || isCashedOut) ? "encerradas" : "ativas";
      
      const key = `${p.marketId}_${p.side}_${virtualStatus}`;
      if (!groups[key]) {
        groups[key] = { ...p, amount: 0, shares: 0, ids: [] };
      }
      groups[key].amount += parseFloat(p.amount);
      groups[key].shares += parseFloat(p.shares);
      groups[key].ids.push(p.id);
    });
    return Object.values(groups).map(g => ({
      ...g,
      price: g.shares > 0 ? (g.amount / g.shares) * 100 : 0
    }));
  }, [positions, markets]);

  const enriched = groupedPositions.map((p) => {
    const mkt = markets.find((m) => m.id === p.marketId);
    const currentPrice = mkt ? (p.side === "yes" ? mkt.yes : 100 - mkt.yes) : p.price;
    const currentValue = p.shares * (currentPrice / 100);
    const pnl = currentValue - p.amount;
    
    const isClosed = mkt?.status === 'closed';
    const isCashedOut = p.status === 'cashed_out';
    
    const status = (isClosed || isCashedOut) ? "encerradas" : "ativas";
    
    let won = false;
    let finalValue = currentValue;
    let finalPnl = pnl;

    if (isCashedOut) {
       finalValue = currentValue; 
       finalPnl = finalValue - p.amount;
    } else if (isClosed) {
       won = p.side === mkt.winner_side;
       if (won) {
         finalValue = p.shares;
         finalPnl = finalValue - p.amount;
       } else {
         finalValue = 0;
         finalPnl = -p.amount;
       }
    }

    return { ...p, currentPrice, currentValue: finalValue, pnl: finalPnl, mkt, status, isClosed, isCashedOut, won };
  }).filter(p => p.status === filter);

  const totalValue = enriched.reduce((a, p) => a + p.currentValue, 0);
  const totalPnl = enriched.reduce((a, p) => a + p.pnl, 0);

  return (
    <div className="screen">
      <h1 className="screen-title">Minhas Apostas</h1>
      
      <div className="page-tabs">
        <button className={`page-tab ${filter === "ativas" ? "active" : ""}`} onClick={() => setFilter("ativas")}>Em Aberto</button>
        <button className={`page-tab ${filter === "encerradas" ? "active" : ""}`} onClick={() => setFilter("encerradas")}>Encerradas (Histórico)</button>
      </div>

      <div className="portfolio-summary">
        <div>
          <div className="ps-label">Investido</div>
          <div className="ps-value">R$ {enriched.reduce((a,p) => a + p.amount, 0).toFixed(2)}</div>
        </div>
        <div>
          <div className="ps-label">Retorno {filter === "encerradas" ? 'Final' : 'Atual'}</div>
          <div className="ps-value">R$ {totalValue.toFixed(2)}</div>
        </div>
        <div>
          <div className="ps-label">Lucro/Prejuízo</div>
          <div className="ps-value" style={{ color: totalPnl >= 0 ? "var(--yes)" : "var(--no)" }}>
            {totalPnl >= 0 ? "+" : ""}R$ {totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="pos-list">
        {enriched.length === 0 && (
          <div className="empty">Você ainda não tem apostas {filter}.</div>
        )}
        {enriched.map((p, i) => (
          <div className="pos-item" key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="card-icon">{p.mkt?.icon ?? "❔"}</div>
                <div className="pos-title">{p.title}</div>
              </div>
              {p.isCashedOut ? (
                <div style={{ background: 'var(--surface2)', color: 'var(--text-dim)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  CASHOUT REALIZADO
                </div>
              ) : p.isClosed ? (
                <div style={{ background: p.won ? 'var(--yes-dim)' : 'var(--no-dim)', color: p.won ? 'var(--yes)' : 'var(--no)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  {p.won ? 'VENCEU' : 'PERDEU'}
                </div>
              ) : (
                <button 
                  onClick={() => {
                    if (confirm(`Deseja realizar o Cashout e resgatar R$ ${p.currentValue.toFixed(2)} agora?`)) {
                      onCashout(p.ids, p.currentValue, p.marketId, p.side);
                    }
                  }}
                  style={{ 
                    background: p.pnl >= 0 ? 'var(--yes)' : 'var(--no)', 
                    color: p.pnl >= 0 ? '#04120c' : '#1a0508', 
                    border: 'none', 
                    padding: '8px 12px', 
                    borderRadius: 6, 
                    fontSize: 11, 
                    fontWeight: 900, 
                    cursor: 'pointer', 
                    transition: 'transform 0.1s' 
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                >
                  Cashout (R$ {p.currentValue.toFixed(2)}) {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingLeft: 46 }}>
              <div className="pos-sub">
                <span className={p.side === "yes" ? "tag-yes" : "tag-no"}>{p.side === "yes" ? "Sim" : "Não"}</span>
                <span className="dot">•</span>
                <span>{p.shares.toFixed(2)} cotas</span>
                <span className="dot">•</span>
                <span>R$ {(p.currentPrice / 100).toFixed(2)} cada</span>
              </div>
              <div className="pos-value" style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Investido</div>
                  <div>R$ {p.amount.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--yes)', textTransform: 'uppercase' }}>Se Vencer</div>
                  <div style={{ color: 'var(--yes)' }}>R$ {p.shares.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: 'var(--yes)', opacity: 0.8, marginTop: 2 }}>+R$ {(p.shares - p.amount).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WALLET SCREEN (CARTEIRA)                                           */
/* ------------------------------------------------------------------ */

function WalletScreen({ balance, address, onDeposit, onWithdraw, txHistory }) {
  const [modalType, setModalType] = useState(null); // 'deposit' | 'withdraw'
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(1); // 1 = Digitar valor, 2 = Mostrar QR Code
  const n = parseFloat(amount) || 0;

  const submitModal = () => {
    if (n <= 0) return;
    
    if (modalType === "deposit") {
      if (step === 1) {
        setStep(2); // Avança para o QR Code
      } else {
        onDeposit(n); 
        closeModal();
      }
    } else {
      onWithdraw(Math.min(n, balance));
      closeModal();
    }
  };

  const closeModal = () => {
    setAmount("");
    setStep(1);
    setModalType(null);
  };

  return (
    <div className="screen">
      <h1 className="screen-title">Carteira</h1>
      <p className="screen-subtitle">Gerencie seu saldo e transações</p>

      <div className="wallet-card">
        <div className="wc-label">Saldo Disponível</div>
        <div className="wc-balance">R$ {balance.toFixed(2)}</div>
        <div className="wc-actions">
          <button className="wc-btn deposit" onClick={() => setModalType("deposit")}><Plus size={18} /> Depositar</button>
          <button className="wc-btn withdraw" onClick={() => setModalType("withdraw")}><Minus size={18} /> Sacar</button>
        </div>
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Histórico</h3>
      <div className="tx-list">
        {txHistory.length === 0 && <div className="empty">Nenhuma transação encontrada.</div>}
        {txHistory.map((tx, i) => (
          <div className="tx-item" key={i}>
            <div className="tx-left">
              <div className="tx-icon">
                {tx.type === "deposit" ? <ArrowDownRight size={18} color="var(--yes)" /> : <ArrowUpRight size={18} color="var(--no)" />}
              </div>
              <div>
                <div className="tx-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {tx.type === "deposit" ? "Depósito" : "Saque"}
                  {tx.status === 'pending' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff', fontWeight: 800 }}>PENDENTE</span>}
                  {tx.status === 'rejected' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--no)', color: '#fff', fontWeight: 800 }}>REJEITADO</span>}
                </div>
                <div className="tx-date">{tx.date}</div>
              </div>
            </div>
            <div className={`tx-amount ${tx.status === 'rejected' ? '' : tx.type === 'deposit' ? 'positive' : 'negative'}`} style={{ textDecoration: tx.status === 'rejected' ? 'line-through' : 'none', opacity: tx.status === 'rejected' ? 0.5 : 1, color: tx.status === 'rejected' ? 'inherit' : tx.type === 'deposit' ? 'var(--yes)' : 'var(--no)' }}>
              {tx.type === "deposit" ? "+" : "-"}R$ {tx.amount.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {modalType && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modalType === "deposit" ? "Depositar fundos" : "Sacar fundos"}</h3>
              <button className="icon-btn" onClick={closeModal}><X size={16} /></button>
            </div>
            
            {modalType === "deposit" && step === 2 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 24, marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 16 }}>
                  Escaneie o QR Code abaixo no aplicativo do seu banco para transferir R$ {n.toFixed(2)}.
                </div>
                
                <div style={{ background: '#fff', padding: 16, borderRadius: 12, marginBottom: 24 }}>
                   {/* Aqui usaremos a imagem que o usuário fez upload. Como ela está local no chat, o usuário vai salvá-la como pix-qrcode.png na pasta public */}
                   <img src="/pix-qrcode.png" alt="QR Code PIX" style={{ width: 200, height: 200, objectFit: 'contain' }} 
                     onError={(e) => { e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020101021126580014br.gov.bcb.pix0136${Math.random()}5204000053039865404${n.toFixed(2)}5802BR5907OracleX6008BRASILIA62070503***6304ABCD` }}
                   />
                </div>
                
                <button className="trade-submit" onClick={submitModal} style={{ background: 'var(--yes)', color: 'var(--bg)' }}>
                  Já realizei o pagamento
                </button>
              </div>
            ) : (
              <>
                <label className="amount-label" style={{ marginTop: 20, display: 'block' }}>Valor (R$)</label>
                <div className="amount-input-row">
                  <span>R$</span>
                  <input type="number" min="0" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
                </div>
                <div className="quick-amounts">
                  {[50, 100, 250, 1000].map((v) => (
                    <button key={v} onClick={() => setAmount(String(v))}>+{v}</button>
                  ))}
                </div>

                <button className="trade-submit neutral" onClick={submitModal} disabled={n <= 0 || (modalType === "withdraw" && n > balance)}>
                  {modalType === "deposit" ? "Gerar QR Code PIX" : "Confirmar Saque"}
                </button>
                <div className="balance-note">Saldo atual: R$ {balance.toFixed(2)}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PROFILE SCREEN                                                      */
/* ------------------------------------------------------------------ */

function ProfileScreen({ balance, positions, txHistory, address, authMethod, userName, setUserName, userDbId, onLogout }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [view, setView] = useState("main"); // 'main' | 'history' | 'preferences'

  const winRate = positions.length > 0 ? "62%" : "0%";

  const saveName = async () => {
    if (!nameInput.trim() || !userDbId) return;
    setUserName(nameInput);
    await supabase.from('users').update({ name: nameInput }).eq('id', userDbId);
    setEditing(false);
  };

  if (view === "history") {
    // Mesclar txHistory e positions
    const allHistory = [
      ...txHistory.map(t => ({ ...t, isTx: true })),
      ...positions.map(p => ({ ...p, isPos: true }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="screen detail">
        <button className="back-btn" onClick={() => setView("main")}>
          <ChevronLeft size={18} /> Voltar
        </button>
        <h1 className="screen-title" style={{ marginTop: 0 }}>Histórico Completo</h1>
        <p className="screen-subtitle">Extrato cronológico da sua conta</p>

        <div className="tx-list">
          {allHistory.length === 0 && <div className="empty">Nenhum registro encontrado.</div>}
          {allHistory.map((item, i) => {
            if (item.isTx) {
              return (
                <div className="tx-item" key={`tx-${i}`}>
                  <div className="tx-left">
                    <div className="tx-icon">
                      {item.type === "deposit" ? <ArrowDownRight size={18} color="var(--yes)" /> : <ArrowUpRight size={18} color="var(--no)" />}
                    </div>
                    <div>
                      <div className="tx-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.type === "deposit" ? "Depósito PIX" : "Saque PIX"}
                        {item.status === 'pending' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff', fontWeight: 800 }}>PENDENTE</span>}
                        {item.status === 'rejected' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--no)', color: '#fff', fontWeight: 800 }}>REJEITADO</span>}
                      </div>
                      <div className="tx-date">{new Date(item.date).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className={`tx-amount ${item.status === 'rejected' ? '' : item.type === 'deposit' ? 'positive' : 'negative'}`} style={{ textDecoration: item.status === 'rejected' ? 'line-through' : 'none', opacity: item.status === 'rejected' ? 0.5 : 1, color: item.status === 'rejected' ? 'inherit' : item.type === 'deposit' ? 'var(--yes)' : 'var(--no)' }}>
                    {item.type === "deposit" ? "+" : "-"}R$ {item.amount.toFixed(2)}
                  </div>
                </div>
              );
            } else {
              return (
                <div className="tx-item" key={`pos-${i}`}>
                  <div className="tx-left">
                    <div className="tx-icon" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                      <Activity size={18} color="var(--text-dim)" />
                    </div>
                    <div>
                      <div className="tx-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Compra de Posição
                        {item.status === 'cashed_out' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--text-dim)', color: '#fff', fontWeight: 800 }}>CASHOUT</span>}
                      </div>
                      <div className="tx-date">{item.title} • {new Date(item.date).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="tx-amount negative" style={{ color: 'var(--text-dim)' }}>
                    -R$ {item.amount.toFixed(2)}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    );
  }

  if (view === "preferences") {
    return (
      <div className="screen detail">
        <button className="back-btn" onClick={() => setView("main")}>
          <ChevronLeft size={18} /> Voltar
        </button>
        <h1 className="screen-title" style={{ marginTop: 0 }}>Preferências</h1>
        <p className="screen-subtitle">Personalize a sua experiência</p>

        <div className="settings-list" style={{ marginTop: 20 }}>
          <div className="settings-item" style={{ justifyContent: 'space-between' }}>
            <span className="si-left" style={{ fontWeight: 600 }}>Modo Escuro (Amoled)</span>
            <div style={{ width: 44, height: 24, background: 'var(--yes)', borderRadius: 20, position: 'relative' }}>
              <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', right: 2, top: 2 }}></div>
            </div>
          </div>
          <div className="settings-item" style={{ justifyContent: 'space-between' }}>
            <span className="si-left" style={{ fontWeight: 600 }}>Notificações Push</span>
            <div style={{ width: 44, height: 24, background: 'var(--yes)', borderRadius: 20, position: 'relative' }}>
              <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', right: 2, top: 2 }}></div>
            </div>
          </div>
          <div className="settings-item" style={{ justifyContent: 'space-between' }}>
            <span className="si-left" style={{ fontWeight: 600 }}>Alertas por E-mail</span>
            <div style={{ width: 44, height: 24, background: 'var(--border)', borderRadius: 20, position: 'relative' }}>
              <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', left: 2, top: 2 }}></div>
            </div>
          </div>
          <div className="settings-item" style={{ justifyContent: 'space-between', opacity: 0.5 }}>
            <span className="si-left" style={{ fontWeight: 600 }}>Moeda Padrão</span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 700 }}>BRL (R$)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>Perfil</h1>
        <button className="icon-btn" onClick={() => { setNameInput(userName); setEditing(true); }}><Edit3 size={16}/></button>
      </div>

      <div className="profile-card">
        <div className="avatar">{userName.slice(0,2).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">
            {userName}
          </div>
          <div className="profile-wallet" onClick={() => {
            navigator.clipboard?.writeText(address || "");
            setCopied(true); setTimeout(() => setCopied(false), 1200);
          }}>
            {address.slice(0,6)}...{address.slice(-4)} {copied ? <Check size={12} /> : <Copy size={12} />}
          </div>
        </div>
      </div>
      
      <div className="profile-stats">
        <div className="p-stat">
          <div className="ps-value">R$ {balance.toFixed(0)}</div>
          <div className="ps-label">Saldo</div>
        </div>
        <div className="p-stat">
          <div className="ps-value">{positions.length}</div>
          <div className="ps-label">Apostas</div>
        </div>
        <div className="p-stat">
          <div className="ps-value">{winRate}</div>
          <div className="ps-label">Acerto</div>
        </div>
      </div>

      <div className="achievements">
        <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>Conquistas</h3>
        <div className="ach-grid">
          <div className="ach-card">
            <div className="ach-icon">🌱</div>
            <div className="ach-title">Primeira Aposta</div>
          </div>
          <div className="ach-card">
            <div className="ach-icon">🎯</div>
            <div className="ach-title">Acertou na Mosca</div>
          </div>
          <div className="ach-card" style={{ opacity: 0.4 }}>
            <div className="ach-icon">🐳</div>
            <div className="ach-title">Baleia</div>
          </div>
        </div>
      </div>

      <div className="settings-list">
        <div className="settings-item" onClick={() => setView("history")}>
          <span className="si-left"><History size={18} />Histórico Completo</span>
          <ChevronRight size={18} color="var(--text-faint)" />
        </div>
        <div className="settings-item" onClick={() => setView("preferences")}>
          <span className="si-left"><Settings size={18} />Preferências</span>
          <ChevronRight size={18} color="var(--text-faint)" />
        </div>
        <div className="settings-item danger" onClick={onLogout}>
          <span className="si-left"><LogOut size={18} />Sair da conta</span>
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Editar Perfil</h3>
              <button className="icon-btn" onClick={() => setEditing(false)}><X size={16} /></button>
            </div>
            <label className="amount-label" style={{ marginTop: 20, display: 'block', marginBottom: 8 }}>Nome de usuário</label>
            <div className="search-mobile" style={{ marginBottom: 20 }}>
              <User size={16} />
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} autoFocus />
            </div>
            <button className="trade-submit neutral" onClick={saveName}>Salvar Alterações</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AUTH SCREEN                                                        */
/* ------------------------------------------------------------------ */

function fakeAddress() {
  const chars = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * 16)];
  s += "…";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState(null); // 'login' | 'register' | null
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.includes("@") || password.length < 6) {
      setError("E-mail inválido ou senha com menos de 6 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
      return;
    }
    if (data.user) {
      onAuth({ method: "email", address: data.user.email, uid: data.user.id });
    }
  };

  const handleRegister = async () => {
    if (!email.includes("@") || password.length < 6) {
      setError("E-mail inválido ou senha com menos de 6 caracteres.");
      return;
    }
    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } }
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.user) {
      // Criar registro na tabela users
      await supabase.from('users').insert({
        id: data.user.id,
        name: name,
        wallet_address: data.user.email,
        balance: 1000.00,
        role: 'user'
      });
      onAuth({ method: "email", address: data.user.email, uid: data.user.id });
    }
  };

  return (
    <div className="auth-screen">
      <div style={{ marginBottom: 18 }}><OracleXLogo size={72} /></div>
      <h1>OracleX</h1>
      <p className="auth-sub">Compre e venda posições sobre o que vai acontecer no mundo.</p>

      {!mode && (
        <div className="auth-options">
          <button className="auth-btn wallet" onClick={() => setMode("login")}>
            <Mail size={17} /> Entrar com e-mail
          </button>
          <button className="auth-btn email" onClick={() => setMode("register")}>
            <ShieldCheck size={17} /> Criar conta
          </button>
          <div className="auth-terms">
            Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.
          </div>
        </div>
      )}

      {(mode === "login" || mode === "register") && (
        <div className="auth-email-form">
          {mode === "register" && (
            <>
              <label>Nome</label>
              <input type="text" placeholder="Seu nome" value={name}
                onChange={(e) => setName(e.target.value)} />
            </>
          )}
          <label>E-mail</label>
          <input type="email" placeholder="voce@exemplo.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <label>Senha</label>
          <input type="password" placeholder="Mínimo 6 caracteres" value={password}
            onChange={(e) => setPassword(e.target.value)} />

          {error && <div style={{ color: 'var(--no)', fontSize: 12, fontWeight: 600 }}>{error}</div>}

          <button className="auth-submit" onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          <button className="auth-back" onClick={() => { setMode(null); setError(""); }}>
            <ChevronLeft size={14} /> Voltar
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APP SHELL                                                          */
/* ------------------------------------------------------------------ */

const OracleXLogo = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="oxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00d2ff" />
        <stop offset="100%" stopColor="#3a7bd5" />
      </linearGradient>
    </defs>
    <line x1="30" y1="80" x2="80" y2="30" stroke="url(#oxGrad)" strokeWidth="8" strokeLinecap="round"/>
    <line x1="20" y1="70" x2="70" y2="20" stroke="url(#oxGrad)" strokeWidth="8" strokeLinecap="round"/>
    <line x1="20" y1="20" x2="80" y2="80" stroke="url(#oxGrad)" strokeWidth="8" />
    <circle cx="20" cy="20" r="9" fill="#00d2ff"/>
    <circle cx="80" cy="80" r="9" fill="#3a7bd5"/>
  </svg>
);

export default function PredictApp() {
  const [markets, setMarkets] = useState([]);
  const [tab, setTab] = useState("home");
  const [selected, setSelected] = useState(null);
  const [initialSide, setInitialSide] = useState("yes");
  const [query, setQuery] = useState("");

  const [auth, setAuth] = useState(null);
  const [userDbId, setUserDbId] = useState(null);
  const [balance, setBalance] = useState(0);
  const [userName, setUserName] = useState("");
  const [positions, setPositions] = useState([]);
  const [txHistory, setTxHistory] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuth({ method: "email", address: session.user.email, uid: session.user.id });
      }
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuth({ method: "email", address: session.user.email, uid: session.user.id });
      } else {
        setAuth(null);
        setUserDbId(null);
        setBalance(0);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('markets').select('*, categories(name, icon)').order('created_at', { ascending: false });
      if(data) {
        setMarkets(data.map((m, i) => {
          const hist = makeHistory(i + 1, m.start_chance);
          // Adicionar o valor atual real como o último ponto do gráfico para animar em tempo real
          hist.push({ t: 'Agora', p: m.current_yes });
          return {
            ...m,
            yes: m.current_yes,
            category: m.categories?.name,
            icon: m.categories?.icon || '⭐',
            history: hist,
            vol: `R$ ${m.volume}`
          };
        }));
      }
    }
    load();
    
    const marketsSub = supabase.channel('public:markets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => {
         load();
      })
      .subscribe();

    const id = setInterval(load, 30000); // Polling as fallback
    return () => {
      clearInterval(id);
      supabase.removeChannel(marketsSub);
    };
  }, []);

  useEffect(() => {
    async function initUser() {
      if(!auth?.uid) return;
      let { data } = await supabase.from('users').select('*').eq('id', auth.uid);
      let u = data?.[0];
      if(!u) {
        const { data: n } = await supabase.from('users').insert({ id: auth.uid, name: auth.address, wallet_address: auth.address, balance: 1000 }).select();
        u = n?.[0];
      }
      if(u) {
        setUserDbId(u.id);
        setBalance(Number(u.balance));
        setUserName(u.name || "forecast_player");
        const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', u.id).order('created_at', { ascending: false });
        if(txs) setTxHistory(txs.map(t => ({ type: t.type, amount: Number(t.amount), date: t.created_at, status: t.status })));
        const { data: pos } = await supabase.from('positions').select('*, markets(title)').eq('user_id', u.id);
        if(pos) setPositions(pos.map(p => ({ id: p.id, marketId: p.market_id, side: p.side, amount: Number(p.amount), price: Number(p.price), shares: Number(p.shares), title: p.markets?.title || "Aposta", status: p.status, date: p.created_at })));
      }
    }
    initUser();
  }, [auth]);

  const openMarket = useCallback((m, side) => {
    setSelected(m.id);
    setInitialSide(side || "yes");
    setTab("detail");
  }, []);

  const handleTrade = useCallback(async ({ marketId, side, amount, price, shares, title }) => {
    if(!userDbId || balance < amount) return;
    setBalance((b) => b - amount);
    setPositions((prev) => [{ marketId, side, amount, price, shares, title, date: new Date().toISOString() }, ...prev]);
    await supabase.from('users').update({ balance: balance - amount }).eq('id', userDbId);
    await supabase.from('positions').insert({ user_id: userDbId, market_id: marketId, side, amount, shares, price, status: 'active' });
    const m = markets.find(x => x.id === marketId);
    if(m) {
      // Dinâmica de Preço (AMM Simplificado): 
      // R$ 10 apostados movem o preço em ~0.1% a 0.5% dependendo da volatilidade
      const impact = (amount / 100); 
      let newYes = side === 'yes' ? (m.yes + impact) : (m.yes - impact);
      newYes = Math.max(1, Math.min(99, newYes)); // Limita entre 1% e 99%
      
      await supabase.from('markets').update({ 
        volume: Number(m.volume || 0) + amount,
        current_yes: newYes
      }).eq('id', marketId);
    }
  }, [userDbId, balance, markets]);

  const handleCashout = useCallback(async (positionIds, cashoutValue, marketId, side) => {
    if(!userDbId || !positionIds || positionIds.length === 0) return;
    setBalance(b => b + cashoutValue);
    
    // Update local state optimistic
    setPositions(prev => prev.map(p => positionIds.includes(p.id) ? { ...p, status: 'cashed_out' } : p));
    
    await supabase.from('users').update({ balance: balance + cashoutValue }).eq('id', userDbId);
    await supabase.from('positions').update({ status: 'cashed_out' }).in('id', positionIds);
    
    const m = markets.find(x => x.id === marketId);
    if(m) {
      const impact = (cashoutValue / 100);
      let newYes = side === 'yes' ? (m.yes - impact) : (m.yes + impact);
      newYes = Math.max(1, Math.min(99, newYes));
      await supabase.from('markets').update({ 
        current_yes: newYes
      }).eq('id', marketId);
    }
  }, [userDbId, balance, markets]);

  const handleDeposit = async (amount) => {
    if(!userDbId) return;
    // NÃO ADICIONA O SALDO AINDA. Aguarda aprovação do Admin!
    setTxHistory([{ type: 'deposit', amount, date: 'Agora', status: 'pending' }, ...txHistory]);
    await supabase.from('transactions').insert({ user_id: userDbId, type: 'deposit', amount, status: 'pending' });
    
    // Aviso temporário ao usuário
    alert("Pagamento PIX registrado! Seu depósito está em análise e entrará no saldo assim que aprovado pela administração.");
  };

  const handleWithdraw = async (amount) => {
    if(!userDbId || balance < amount) return;
    setBalance(b => b - amount);
    setTxHistory([{ type: 'withdraw', amount, date: 'Agora', status: 'pending' }, ...txHistory]);
    await supabase.from('transactions').insert({ user_id: userDbId, type: 'withdraw', amount, status: 'pending' });
    await supabase.from('users').update({ balance: balance - amount }).eq('id', userDbId);
  };

  const currentMarket = markets.find((m) => m.id === selected);

  if (authLoading) {
    return (
      <div className="pm-root">
        <style>{SHARED_STYLES}</style>
        <div className="auth-screen">
          <Loader2 size={32} className="spin" style={{ color: 'var(--yes)' }} />
        </div>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="pm-root">
        <style>{SHARED_STYLES}</style>
        <AuthScreen onAuth={setAuth} />
      </div>
    );
  }

  return (
    <div className="pm-root">
      <style>{SHARED_STYLES}</style>

      <div className="topbar">
        <div className="brand">
          <OracleXLogo size={28} />
          OracleX
        </div>
        <div className="topbar-right">
          <div className="balance-chip" onClick={() => setTab("wallet")} style={{cursor:'pointer'}}>
            R$ {balance.toFixed(2)}
          </div>
          <div className="icon-btn"><Bell size={15} /></div>
        </div>
      </div>

      {tab === "home" && <HomeScreen markets={markets} onOpen={openMarket} query={query} setQuery={setQuery} />}
      
      {tab === "live" && <LiveScreen markets={markets} onTrade={handleTrade} balance={balance} />}
      
      {tab === "detail" && currentMarket && (
        <MarketDetail
          m={currentMarket}
          onBack={() => setTab(currentMarket.video_type ? "live" : "home")}
          initialSide={initialSide}
          onTrade={handleTrade}
          balance={balance}
        />
      )}
      
      {tab === "portfolio" && <PortfolioScreen positions={positions} markets={markets} balance={balance} onCashout={handleCashout} />}
      
      {tab === "wallet" && (
        <WalletScreen 
          balance={balance} 
          address={auth.address}
          txHistory={txHistory}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
        />
      )}

      {tab === "profile" && (
        <ProfileScreen 
          balance={balance} 
          positions={positions} 
          txHistory={txHistory}
          address={auth.address} 
          authMethod={auth.method} 
          userName={userName}
          setUserName={setUserName}
          userDbId={userDbId}
          onLogout={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
        />
      )}

      <div className="bottom-nav">
        <button className={`nav-btn ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>
          <Home size={22} strokeWidth={tab === "home" ? 2.5 : 2} /> Início
        </button>
        <button className={`nav-btn ${tab === "live" ? "active" : ""}`} onClick={() => setTab("live")} style={{ color: tab === "live" ? 'var(--no)' : '' }}>
          <Radio size={22} strokeWidth={tab === "live" ? 2.5 : 2} /> Ao Vivo
        </button>
        <button className={`nav-btn ${tab === "portfolio" ? "active" : ""}`} onClick={() => setTab("portfolio")}>
          <Activity size={22} strokeWidth={tab === "portfolio" ? 2.5 : 2} /> Apostas
        </button>
        <button className={`nav-btn ${tab === "wallet" ? "active" : ""}`} onClick={() => setTab("wallet")}>
          <Wallet size={22} strokeWidth={tab === "wallet" ? 2.5 : 2} /> Carteira
        </button>
        <button className={`nav-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
          <User size={22} strokeWidth={tab === "profile" ? 2.5 : 2} /> Perfil
        </button>
      </div>
    </div>
  );
}
