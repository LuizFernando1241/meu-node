# Meu Node - Deploy com Login/Sync

Este projeto tem:
- **Frontend** estatico na raiz (`index.html`, `styles.css`, `app.js`, `sw.js`).
- **Backend** Node/Express em `server/` com autenticacao (login/cadastro) e sincronizacao de estado por usuario (Turso).

## Backend (Render)
1. Crie um banco no Turso e pegue `TURSO_URL` e `TURSO_AUTH_TOKEN`.
2. No Render, crie um **Web Service** apontando para `server/`.
   - Build: `npm install`
   - Start: `npm start`
3. Variaveis de ambiente obrigatorias:
   - `JWT_SECRET`: string forte.
   - `JWT_EXPIRES_IN`: ex. `30d`.
   - `TURSO_URL`: URL do banco.
   - `TURSO_AUTH_TOKEN`: token do Turso.
   - `CORS_ORIGIN`: URL do frontend (ex. `https://seu-front.netlify.app`).
   - `STATE_KEY`: (opcional) padrao `state`.
4. Opcional: use `server/render.yaml` como referencia de configuracao.

## Frontend (Netlify ou Cloudflare Pages)
1. Deploy estatico apontando para a raiz do repo. Nao ha build.
   - No Netlify, escolha **Deploy site** → `netlify.toml` ja define `publish="."`.
2. Abra a URL publicada.

## Fluxo de uso
1. Na tela inicial, informe a **API URL** do backend publicado.
2. Crie conta (nome, email, senha) ou faca login.
3. O app passa a sincronizar automaticamente os dados desse usuario entre dispositivos.
4. Em **Ajustes**, voce pode sair da conta ou rodar sync manual.

## Desenvolvimento local
```bash
cd server
npm install
cp .env.example .env   # preencha as variaveis
npm start
```
Abra `index.html` no navegador (ou sirva a raiz com um servidor estatico). Ajuste a URL da API para `http://localhost:3000`.
