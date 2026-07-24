# Foresight — app de mercados de previsão (clone visual da Polymarket)

## Como rodar localmente

Pré-requisito: Node.js 18+ instalado.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

## Como gerar uma versão de produção

```bash
npm run build
npm run preview
```

## Testar como app no celular (PWA simples)

1. Rode `npm run build` e depois `npm run preview` (ou hospede a pasta `dist/` em qualquer serviço estático: Vercel, Netlify, GitHub Pages).
2. Acesse a URL pelo celular.
3. No Safari (iOS): toque em Compartilhar → "Adicionar à Tela de Início".
   No Chrome (Android): menu ⋮ → "Adicionar à tela inicial".

## Ícones e splash

A pasta `public/` já contém os ícones gerados (iOS e Android) e os splash screens,
prontos para usar em um projeto Capacitor/Expo/React Native se você quiser
transformar isso em um app nativo de verdade.

## Estrutura

```
foresight-app/
├── src/
│   ├── main.jsx        # ponto de entrada
│   └── PredictApp.jsx  # app inteiro (todas as telas)
├── public/              # ícones e splash screens
├── index.html
├── package.json
└── vite.config.js
```
