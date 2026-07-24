import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Home, Search, Wallet, User, ChevronLeft, Clock, Flame, TrendingUp,
  TrendingDown, Star, ChevronRight, Bell, Menu, X, ArrowUpRight, ArrowDownRight,
  BarChart3, Settings, LogOut, Copy, Check, Mail, Loader2, ShieldCheck, Plus, Minus,
  Activity, Award, History, Edit3
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

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

        .trade-panel { background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 16px; }
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
/*  MARKET CARD                                                        */
/* ------------------------------------------------------------------ */

function MarketCard({ m, onOpen }) {
  const positive = m.yes >= (m.history[0]?.p ?? m.yes);
  return (
    <div className="card" onClick={() => onOpen(m)}>
      <div className="card-top">
        <div className="card-icon">{m.icon}</div>
        <div className="card-title">{m.title}</div>
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
        <button className="btn-yes" onClick={(e) => { e.stopPropagation(); onOpen(m, "yes"); }}>
          Sim · {fmtPct(m.yes)}
        </button>
        <button className="btn-no" onClick={(e) => { e.stopPropagation(); onOpen(m, "no"); }}>
          Não · {fmtPct(100 - m.yes)}
        </button>
      </div>

      <div className="card-foot">
        <span>{m.vol} vol.</span>
        <span className="dot">•</span>
        <span>{m.category}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HOME SCREEN                                                        */
/* ------------------------------------------------------------------ */

function HomeScreen({ markets, onOpen, query, setQuery }) {
  const [cat, setCat] = useState("Tendências");

  const filtered = useMemo(() => {
    let list = markets;
    if (cat !== "Tendências") list = list.filter((m) => m.category === cat);
    if (query.trim()) list = list.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [markets, cat, query]);

  return (
    <div className="screen">
      <div className="search-mobile">
        <Search size={16} />
        <input placeholder="Buscar mercados" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="chips-row">
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? "chip-active" : ""}`} onClick={() => setCat(c)}>
            {c === "Tendências" && <Flame size={13} style={{ marginRight: 4 }} />}
            {c}
          </button>
        ))}
      </div>

      <div className="grid">
        {filtered.map((m) => (
          <MarketCard key={m.id} m={m} onOpen={onOpen} />
        ))}
        {filtered.length === 0 && (
          <div className="empty">Nenhum mercado encontrado para "{query}".</div>
        )}
      </div>
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
            <span className="dot">•</span>
            <span className="flex-inline"><Clock size={12} /> Encerra 31 dez 2026</span>
          </div>
        </div>
      </div>

      <div className="detail-price-row">
        <div className="big-pct" style={{ color: "var(--yes)" }}>{fmtPct(m.yes)}</div>
        <div className="big-pct-label">de chance em <b>Sim</b></div>
      </div>

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
        <div className="trade-tabs">
          <button className={side === "yes" ? "active" : ""} onClick={() => setSide("yes")}>Comprar Sim</button>
          <button className={side === "no" ? "active" : ""} onClick={() => setSide("no")}>Comprar Não</button>
        </div>

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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PORTFOLIO SCREEN (MINHAS APOSTAS)                                  */
/* ------------------------------------------------------------------ */

function PortfolioScreen({ positions, markets, balance }) {
  const [filter, setFilter] = useState("ativas"); // ativas | encerradas

  const enriched = positions.map((p) => {
    const mkt = markets.find((m) => m.id === p.marketId);
    const currentPrice = mkt ? (p.side === "yes" ? mkt.yes : 100 - mkt.yes) : p.price;
    const currentValue = p.shares * (currentPrice / 100);
    const pnl = currentValue - p.amount;
    const status = "ativa"; // Mock status
    return { ...p, currentPrice, currentValue, pnl, mkt, status };
  }).filter(p => filter === "ativas" ? p.status === "ativa" : p.status !== "ativa");

  const totalValue = enriched.reduce((a, p) => a + p.currentValue, 0);
  const totalPnl = enriched.reduce((a, p) => a + p.pnl, 0);

  return (
    <div className="screen">
      <h1 className="screen-title">Minhas Apostas</h1>
      
      <div className="page-tabs">
        <button className={`page-tab ${filter === "ativas" ? "active" : ""}`} onClick={() => setFilter("ativas")}>Em Andamento</button>
        <button className={`page-tab ${filter === "encerradas" ? "active" : ""}`} onClick={() => setFilter("encerradas")}>Encerradas</button>
      </div>

      <div className="portfolio-summary">
        <div>
          <div className="ps-label">Investido</div>
          <div className="ps-value">R$ {enriched.reduce((a,p) => a + p.amount, 0).toFixed(2)}</div>
        </div>
        <div>
          <div className="ps-label">Valor Atual</div>
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
          <div className="pos-item" key={i}>
            <div className="card-icon">{p.mkt?.icon ?? "❔"}</div>
            <div className="pos-info">
              <div className="pos-title">{p.title}</div>
              <div className="pos-sub">
                <span className={p.side === "yes" ? "tag-yes" : "tag-no"}>{p.side === "yes" ? "Sim" : "Não"}</span>
                <span className="dot">•</span>
                <span>{p.shares.toFixed(2)} cotas</span>
              </div>
            </div>
            <div className="pos-value">
              <div>R$ {p.currentValue.toFixed(2)}</div>
              <div style={{ color: p.pnl >= 0 ? "var(--yes)" : "var(--no)", fontSize: 12 }}>
                {p.pnl >= 0 ? <ArrowUpRight size={12} style={{ display: "inline" }} /> : <ArrowDownRight size={12} style={{ display: "inline" }} />}
                {p.pnl >= 0 ? "+" : ""}R$ {p.pnl.toFixed(2)}
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
  const n = parseFloat(amount) || 0;

  const submitModal = () => {
    if (n <= 0) return;
    if (modalType === "deposit") onDeposit(n); 
    else onWithdraw(Math.min(n, balance));
    setAmount("");
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
                <div className="tx-title">{tx.type === "deposit" ? "Depósito" : "Saque"}</div>
                <div className="tx-date">{tx.date}</div>
              </div>
            </div>
            <div className={`tx-amount ${tx.type === 'deposit' ? 'positive' : 'negative'}`}>
              {tx.type === "deposit" ? "+" : "-"}R$ {tx.amount.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {modalType && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modalType === "deposit" ? "Depositar fundos" : "Sacar fundos"}</h3>
              <button className="icon-btn" onClick={() => setModalType(null)}><X size={16} /></button>
            </div>
            
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
              {modalType === "deposit" ? "Confirmar Depósito" : "Confirmar Saque"}
            </button>
            <div className="balance-note">Saldo atual: R$ {balance.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PROFILE SCREEN                                                      */
/* ------------------------------------------------------------------ */

function ProfileScreen({ balance, positions, address, authMethod, onLogout }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("forecast_player");

  const winRate = positions.length > 0 ? "62%" : "0%";

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>Perfil</h1>
        <button className="icon-btn" onClick={() => setEditing(true)}><Edit3 size={16}/></button>
      </div>

      <div className="profile-card">
        <div className="avatar">{name.slice(0,2).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">
            {name}
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
        <div className="settings-item">
          <span className="si-left"><History size={18} />Histórico Completo</span>
          <ChevronRight size={18} color="var(--text-faint)" />
        </div>
        <div className="settings-item">
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
              <input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <button className="trade-submit neutral" onClick={() => setEditing(false)}>Salvar Alterações</button>
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
  const [mode, setMode] = useState(null); // 'wallet' | 'email' | null
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const connectWallet = (provider) => {
    setMode("wallet");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAuth({ method: provider, address: fakeAddress() });
    }, 1400);
  };

  const sendOtp = () => {
    if (!email.includes("@")) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setOtpSent(true); }, 1000);
  };

  const confirmOtp = () => {
    if (otp.length < 4) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAuth({ method: "email", address: email });
    }, 900);
  };

  return (
    <div className="auth-screen">
      <div style={{ marginBottom: 18 }}><OracleXLogo size={72} /></div>
      <h1>OracleX</h1>
      <p className="auth-sub">Compre e venda posições sobre o que vai acontecer no mundo.</p>

      {!mode && (
        <div className="auth-options">
          <button className="auth-btn wallet" onClick={() => connectWallet("MetaMask")}>
            <Wallet size={17} /> Conectar carteira
          </button>
          <button className="auth-btn google" onClick={() => connectWallet("Google")}>
            <ShieldCheck size={17} /> Continuar com Google
          </button>
          <button className="auth-btn email" onClick={() => setMode("email")}>
            <Mail size={17} /> Continuar com e-mail
          </button>
          <div className="auth-terms">
            Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade (simulados nesta demo).
          </div>
        </div>
      )}

      {mode === "wallet" && (
        <div className="auth-loading">
          <Loader2 size={22} className="spin" />
          <span>Conectando carteira…</span>
        </div>
      )}

      {mode === "email" && (
        <div className="auth-email-form">
          {!otpSent ? (
            <>
              <label>E-mail</label>
              <input type="email" placeholder="voce@exemplo.com" value={email}
                onChange={(e) => setEmail(e.target.value)} />
              <button className="auth-submit" onClick={sendOtp} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : "Enviar código"}
              </button>
            </>
          ) : (
            <>
              <label>Código enviado para {email}</label>
              <input type="text" placeholder="000000" maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value)} />
              <button className="auth-submit" onClick={confirmOtp} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : "Confirmar"}
              </button>
            </>
          )}
          <button className="auth-back" onClick={() => { setMode(null); setOtpSent(false); }}>
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
  const [markets, setMarkets] = useState(INITIAL_MARKETS);
  const [tab, setTab] = useState("home");
  const [selected, setSelected] = useState(null);
  const [initialSide, setInitialSide] = useState("yes");
  const [query, setQuery] = useState("");
  const [balance, setBalance] = useState(1000);
  const [positions, setPositions] = useState([]);
  const [txHistory, setTxHistory] = useState([
    { type: 'deposit', amount: 1000, date: 'Hoje, 10:42' }
  ]);
  const [auth, setAuth] = useState(null); // { method, address }

  // live-ish price simulation
  useEffect(() => {
    const id = setInterval(() => {
      setMarkets((prev) =>
        prev.map((m) => {
          const rnd = Math.random() - 0.5;
          let next = m.yes + rnd * 1.6;
          next = Math.max(2, Math.min(98, next));
          const hist = [...m.history.slice(1), { t: m.history[m.history.length - 1].t + 1, p: Math.round(next * 10) / 10 }];
          return { ...m, yes: Math.round(next * 10) / 10, history: hist };
        })
      );
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const openMarket = useCallback((m, side) => {
    setSelected(m.id);
    setInitialSide(side || "yes");
    setTab("detail");
  }, []);

  const handleTrade = useCallback(({ marketId, side, amount, price, shares, title }) => {
    setBalance((b) => Math.max(0, b - amount));
    setPositions((prev) => [{ marketId, side, amount, price, shares, title, date: new Date().toISOString() }, ...prev]);
  }, []);

  const handleDeposit = (amount) => {
    setBalance(b => b + amount);
    setTxHistory([{ type: 'deposit', amount, date: 'Agora' }, ...txHistory]);
  };

  const handleWithdraw = (amount) => {
    setBalance(b => Math.max(0, b - amount));
    setTxHistory([{ type: 'withdraw', amount, date: 'Agora' }, ...txHistory]);
  };

  const currentMarket = markets.find((m) => m.id === selected);

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
      
      {tab === "detail" && currentMarket && (
        <MarketDetail
          m={currentMarket}
          onBack={() => setTab("home")}
          initialSide={initialSide}
          onTrade={handleTrade}
          balance={balance}
        />
      )}
      
      {tab === "portfolio" && <PortfolioScreen positions={positions} markets={markets} balance={balance} />}
      
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
          address={auth.address}
          authMethod={auth.method}
          onLogout={() => setAuth(null)}
        />
      )}

      <div className="bottom-nav">
        <button className={`nav-btn ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>
          <Home size={22} strokeWidth={tab === "home" ? 2.5 : 2} /> Início
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
