# ServeGo

**O profissional que você precisa, quando precisa.**

Marketplace de serviços que conecta **clientes ↔ profissionais** (eletricistas, encanadores,
mecânicos, pintores, pedreiros, técnicos de ar-condicionado, montadores, jardineiros, técnicos de
informática, faxineiros, marceneiros, serralheiros, chaveiros e instaladores).

Aplicação web em **HTML5 + CSS3 + JavaScript moderno (sem build)** com **Supabase** como backend
(Auth, PostgreSQL, Storage, Realtime e Row Level Security).

---

## 1. Como rodar

### Modo demonstração (imediato, sem configurar nada)

O projeto funciona 100% sem backend: uma base em memória (`js/mock.js`) alimenta todas as telas com
dados realistas — inclusive orçamentos chegando ao vivo, chat respondendo e o serviço avançando de
status sozinho.

```bash
# qualquer servidor estático serve
npx serve .
# ou
python3 -m http.server 8000
```

Abra `http://localhost:8000/index.html` (landing) e clique em **Encontrar um profissional**.
Na tela de login use os atalhos **Cliente · Profissional**. Para abrir o painel administrativo em
modo demo, entre com o e-mail proprietário (`caio.programador10@gmail.com`) — nenhuma outra conta
vê esse painel.

> Também é possível abrir o `index.html` direto pelo navegador (`file://`), mas um servidor local
> é recomendado.

### Modo conectado ao Supabase

1. Crie um projeto em <https://supabase.com>.
2. No **SQL Editor**, rode os arquivos de `/sql` **nesta ordem**:

   | Arquivo | O que faz |
   |---|---|
   | `01_schema.sql` | enums, 16 tabelas, índices, triggers, funções e RPCs |
   | `02_rls.sql` | Row Level Security em todas as tabelas (~60 policies) |
   | `03_storage.sql` | buckets de avatares, fotos de serviço, imagens de chat e documentos |
   | `04_seed.sql` | as 14 categorias iniciais |
   | `05_admin.sql` | trava o papel de administrador na conta proprietária |

3. Em **Project Settings → API**, copie a **URL** e a **anon/public key**.
4. Cole em `js/config.js`:

```js
window.SG.config = {
  supabaseUrl: "https://xxxxxxxxxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  ...
};
```

5. Crie a **conta de administrador** (uma só, veja a seção 3.1) e depois os demais usuários pelo
   próprio app, na tela **Criar conta**.

Assim que as credenciais existirem, o modo demo é desligado automaticamente e todas as telas passam
a ler e gravar no Postgres.

> **Nunca** coloque a `service_role key` no front-end. O app usa apenas a chave `anon`; as operações
> privilegiadas ficam em RPCs `SECURITY DEFINER` protegidas por `is_admin()` (ou em Edge Functions).

---

## 2. Estrutura de arquivos

```
servego/
├── index.html                 landing page
├── app.html                   SPA (cliente, profissional e admin)
├── assets/
│   ├── logo-mark.png       ícone oficial (usado em toda a interface)
│   ├── logo-servego.png    lockup completo com o wordmark
│   └── favicon.png
├── css/
│   ├── tokens.css             design tokens (cores, tipografia, espaços, sombras)
│   ├── base.css               reset, tipografia, utilitários de layout
│   ├── components.css         botões, cards, campos, chat, timeline, modais, toasts…
│   ├── landing.css            landing page
│   └── app.css                shell do app (sidebar, header, bottom nav, telas)
├── js/
│   ├── config.js              credenciais e parâmetros do produto
│   ├── icons.js               sistema único de ícones SVG + marca
│   ├── theme.js               tema claro/escuro (preferência + botão)
│   ├── ui.js                  helpers de DOM, formatação, toasts, modais, skeletons
│   ├── supabaseClient.js      criação do client + tradução de erros
│   ├── mock.js                base de demonstração (mesmo formato das tabelas)
│   ├── api.js                 camada de dados (Supabase ⇄ demo)
│   ├── router.js              roteador por hash
│   ├── app.js                 shell, sessão, navegação, notificações
│   └── views/
│       ├── auth.js                 entrar / criar conta
│       ├── client.js               início, categorias, atividade, matching, acompanhamento
│       ├── request-flow.js         solicitação em 6 etapas
│       ├── professional-profile.js perfil público do profissional
│       ├── chat.js                 mensagens em tempo real
│       ├── pro.js                  painel, oportunidades, orçamentos, ganhos, avaliações
│       ├── admin.js                painel administrativo
│       └── profile.js              perfil e configurações
└── sql/
    ├── 01_schema.sql
    ├── 02_rls.sql
    ├── 03_storage.sql
    ├── 04_seed.sql
    └── 05_admin.sql
```

**Regra de arquitetura:** nenhuma tela conversa com o Supabase diretamente. Tudo passa por
`js/api.js`, que tem duas implementações para cada função (Supabase e demo). Trocar de fonte de
dados não exige mudar nenhuma view.

---

## 3. Banco de dados

16 tabelas com UUID, timestamps, enums e índices:

`profiles` · `professionals` · `categories` · `professional_categories` · `service_requests` ·
`service_photos` · `service_offers` · `bookings` · `booking_events` · `messages` · `reviews` ·
`notifications` · `favorites` · `professional_documents` · `transactions` · `reports`

Automatizações no próprio banco:

- `handle_new_user()` — cria o `profile` (e o `professional`) no cadastro
- `refresh_professional_rating()` — recalcula nota e nº de avaliações
- `on_booking_completed()` — carimba a conclusão, incrementa serviços e gera a transação com a taxa
- `log_booking_event()` — alimenta a timeline de acompanhamento
- gatilhos de notificação para oferta recebida, oferta aceita, nova mensagem, avaliação e conclusão

RPCs:

- `search_professionals(categoria, lat, lng, raio, limite)` — busca por proximidade (Haversine),
  ordenada por nota e distância, já devolvendo preço e tempo estimado de chegada
- `admin_metrics()` — indicadores do marketplace (restrito a admin)
- `professional_earnings(id)` — ganhos do dia/semana/mês, a receber e série dos últimos 7 dias

### 3.1 Administrador único

O papel `admin` está travado no banco por `sql/05_admin.sql`: apenas o e-mail devolvido por
`public.servego_owner_email()` — hoje **caio.programador10@gmail.com** — pode ser administrador.

- o e-mail proprietário é promovido a `admin` automaticamente ao criar a conta;
- qualquer outra conta que tente virar admin (pelo formulário, pela API com a chave anon ou por
  `update` direto no próprio perfil) recebe erro `42501`;
- o script também rebaixa qualquer admin antigo que já exista e nunca cria ficha de profissional
  para o dono;
- o front-end reflete a mesma regra: o cadastro público só oferece cliente/profissional e o painel
  administrativo só é montado para essa conta (`config.owner.email` em `js/config.js`).

**Como criar a conta:** no painel do Supabase, *Authentication → Users → Add user → Create new
user*, com o e-mail acima, a senha escolhida e a opção *Auto Confirm User* marcada. A senha fica
somente no Supabase Auth (em hash) — **nenhum arquivo do projeto guarda senha em texto**.

Para trocar o dono no futuro: altere o e-mail em `servego_owner_email()` (dentro de
`sql/05_admin.sql`), rode o arquivo novamente e atualize `owner.email` em `js/config.js`.

### 3.2 Tema claro e escuro

A interface tem os dois temas, e eles nascem dos mesmos tokens — não existe folha de estilo
duplicada.

- **Padrão:** segue o sistema operacional (`prefers-color-scheme`).
- **Escolha do usuário:** o botão de sol/lua no cabeçalho (e no menu da conta) grava a preferência
  e passa a mandar sobre o sistema. Dá para voltar em *Seguir o sistema*, no menu da conta.
- **Sem flash:** um script minúsculo no `<head>` de `index.html` e `app.html` aplica o tema antes
  da primeira pintura, então a tela nunca "pisca" branca ao carregar.

O que torna isso possível é a camada de **materiais** em `css/tokens.css` — `glaze` (verniz de luz),
`hover`, `well` (fundo rebaixado), `sheen` (filete de 1px), `inset`, `scrim` e as auras de fundo.
No escuro a luz vem de um brilho branco sobre preto; no claro, de branco sobre marfim, com as
sombras virando quentes e o ouro virando bronze no texto (`--sg-brand-ink`, `--sg-gold-ink`) para
manter o contraste legível sobre papel.

Ao criar uma tela nova, use sempre esses tokens em vez de `rgba()` cru — assim ela já nasce
funcionando nos dois temas.

### Segurança (RLS)

- cliente enxerga apenas os próprios dados;
- profissional enxerga os próprios dados e as solicitações abertas da sua especialidade;
- mensagens só são visíveis para remetente e destinatário;
- administrador tem acesso via `is_admin()` (`SECURITY DEFINER`, evitando recursão de RLS);
- Storage: cada usuário só grava dentro da pasta com o próprio `auth.uid()`.

---

## 4. O que está implementado

**Cliente** — dashboard com categorias e serviços ativos · busca · solicitação em 6 etapas
(categoria → descrição → local → fotos → urgência → revisão) · tela de matching com radar animado e
orçamentos chegando em tempo real · comparação por preço, nota e chegada · perfil completo do
profissional · chat · acompanhamento com timeline e mapa · avaliação com estrelas e tags · favoritos
· repetição de serviço · denúncia · notificações.

**Profissional** — painel com métricas, agenda e mapa de oportunidades · switch Online/Offline ·
feed de solicitações filtrado por especialidade e distância · envio de orçamento com sugestão de
preço ("orçamento inteligente") · atualização de status do serviço (a caminho → chegou → em
andamento → concluído) · ganhos com gráfico e extrato · avaliações com resposta pública · perfil,
especialidades e documentos.

**Administrador** — métricas do marketplace · aprovação de profissionais e documentos · gestão de
usuários (bloqueio) · solicitações · avaliações · denúncias · CRUD de categorias.

**Transversal** — design system próprio, tema claro e escuro, modo demo, skeletons, estados vazios,
toasts, microinterações, navegação inferior no mobile e responsividade completa.

---

## 5. Preparado para evoluir

A arquitetura já foi desenhada para receber, sem reescrita:

- **Pagamentos** — a tabela `transactions` já registra valor, taxa e líquido; basta plugar o
  provedor (split, antecipação) numa Edge Function.
- **Mapas reais** — `config.maps` aceita `mapbox` ou `google`; os componentes `.sg-map` são a versão
  mockada e podem ser trocados por um mapa real sem mexer nas telas.
- **Geolocalização** — `service_requests.lat/lng` e `professionals.lat/lng` já existem e a RPC de
  busca já calcula distância; a etapa de local do fluxo captura a posição do navegador.
- **Notificações push** — a tabela `notifications` e o canal Realtime já estão prontos; falta a
  camada de envio (FCM/APNs).
- **Apps Android e iOS** — a mesma camada `api.js` pode ser reaproveitada, ou o app web pode ser
  empacotado (PWA/Capacitor).
- **Comissão e assinatura** — a taxa está centralizada em `config.app.platformFeePercent` e no
  trigger `on_booking_completed()`.

---

## 6. Identidade visual

Preto profundo e grafite como base, branco para texto e o amarelo/dourado da logo **apenas como
destaque** (botões primários, selos, estados ativos). Tipografia **Manrope** para títulos e
**Inter** para interface. Raios sóbrios, bordas sutis, sombras direcionais e gradientes discretos.
Todos os valores vivem em `css/tokens.css` — mudar a marca inteira é mudar um arquivo.

A logo oficial é usada como imagem (`assets/logo-mark.png`) em todos os lugares: header, sidebar,
tela de login, composição do hero e animação de busca de profissionais. O caminho está centralizado
em `SG.brandAsset` (`js/icons.js`).
