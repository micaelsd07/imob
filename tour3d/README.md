# Fabelle Tour 3D

Sistema para imobiliárias criarem tours virtuais 360° dos imóveis.

## Como funciona
1. **Login**: tela exclusiva de acesso (`/login`).
2. **Painel** (`/painel`): lista de imóveis, criar novo e guia de fotos.
3. **Editor do imóvel** (4 passos):
   1. Dados do imóvel (preço, área, quartos…)
   2. Fotos dos cômodos, com o guia de como fotografar, a ordem das fotos e a detecção automática do tipo (360°, panorâmica ou foto comum)
   3. Conectar cômodos: toque na porta da imagem e escolha para onde ela leva (ou use "Conectar automaticamente")
   4. Gerar e publicar: verificação, prévia, link, WhatsApp e código para incorporar no site
4. **Tour público** (`/tour/:link`): o cliente gira a imagem e entra nos cômodos.

## Tecnologias
- Front-end: React, TypeScript, Vite e Three.js (visualizador 360°)
- API: Node.js e Express
- Banco: **SQLite local** (`server/data/tour3d.db`), sem serviço externo. As fotos ficam em `server/data/uploads`.

## Rodar (Node 22 ou mais novo)
```bash
cd tour3d/server && npm install
cd ../web && npm install && npm run build
cd ../server && npm start        # http://localhost:3333
```
Desenvolvimento: `npm run dev` em `server/` e em `web/` (abre em http://localhost:5173).

Login inicial: `admin@fabelle.com` / `fabelle123`.
Para trocar, use as variáveis `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `JWT_SECRET` (obrigatório em produção).
