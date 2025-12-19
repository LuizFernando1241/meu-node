# Meu Node - Deploy com Sync (sem login)

Este projeto tem:
- **Frontend** estatico na raiz (`index.html`, `styles.css`, `app.js`, `sw.js`).
- **Backend** Node/Express em `server/` com sincronizacao via API key (single-user).

## Backend (Render)
1. Crie um banco no Turso e pegue `TURSO_URL` e `TURSO_AUTH_TOKEN`.
2. No Render, crie um **Web Service** apontando para `server/`.
   - Build: `npm install`
   - Start: `npm start`
3. Variaveis de ambiente obrigatorias:
   - `TURSO_URL`: URL do banco.
   - `TURSO_AUTH_TOKEN`: token do Turso.
   - `API_KEY`: chave da API (use a mesma no frontend).
4. Variaveis recomendadas:
   - `CORS_ORIGIN`: URL do frontend (ex.: `https://seu-front.netlify.app`).
   - `STATE_KEY`: (opcional) padrao `state`.
   - `DEFAULT_USER_ID`: (opcional) padrao `single-user`.
5. Opcional: use `server/render.yaml` como referencia.

## Frontend (Netlify ou Cloudflare Pages)
1. Deploy estatico apontando para a raiz do repo. Nao ha build.
   - No Netlify, escolha **Deploy site** e `netlify.toml` ja define `publish="."`.
2. Configure `DEFAULT_API_URL` e `DEFAULT_API_KEY` em `app.js` (ou edite em **Ajustes**).

## Fluxo de uso
1. Abra o app.
2. Em **Ajustes**, confirme API URL e API Key.
3. Ative o auto-sync, se desejar.

## Desenvolvimento local
```bash
cd server
npm install
cp .env.example .env   # preencha as variaveis
npm start
```
Abra `index.html` no navegador (ou sirva a raiz com um servidor estatico). Ajuste a URL da API para `http://localhost:3000`.
