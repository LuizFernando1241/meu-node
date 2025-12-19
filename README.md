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
   # Meu Node - Deploy com Login/Sync

   Este projeto tem:
   - **Frontend** estático na raiz (`index.html`, `styles.css`, `app.js`, `sw.js`).
   - **Backend** Node/Express em `server/` com autenticação (login/cadastro) e sincronização de estado por usuário (Turso).

   ## Backend (Render)
   1. Crie um banco no Turso e pegue `TURSO_URL` e `TURSO_AUTH_TOKEN`.
   2. No Render, crie um **Web Service** apontando para `server/`.
      - Build: `npm install`
      - Start: `npm start`
   3. Variáveis de ambiente obrigatórias:
      - `JWT_SECRET`: string forte.
      - `JWT_EXPIRES_IN`: ex.: `30d`.
      - `TURSO_URL`: URL do banco.
      - `TURSO_AUTH_TOKEN`: token do Turso.
      - `CORS_ORIGIN`: URL do frontend (ex.: `https://seu-front.netlify.app`).
      - `STATE_KEY`: (opcional) padrão `state`.
   4. Opcional: use `server/render.yaml` como referência de configuração.

   ## Frontend (Netlify ou Cloudflare Pages)
   1. Deploy estático apontando para a raiz do repo. Não há build.
      - No Netlify, escolha **Deploy site** → `netlify.toml` já define `publish="."`.
   2. Abra a URL publicada.

   ## Fluxo de uso
   1. Na tela inicial, informe a **API URL** do backend publicado.
   2. Crie conta (nome, e-mail, senha) ou faça login.
   3. O app só sincroniza automaticamente se você configurar a sincronização nas **Ajustes**.
   4. Em **Ajustes**, você pode sair da conta ou executar sincronização manual.

   ## Desenvolvimento local
   ```bash
   cd server
   npm install
   cp .env.example .env   # preencha as variáveis
   npm start
   ```
   Abra `index.html` no navegador (ou sirva a raiz com um servidor estático). Ajuste a URL da API para `http://localhost:3000`.
