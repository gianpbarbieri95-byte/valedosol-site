# Vale do Sol Imóveis

Plataforma imobiliária da Vale do Sol Empreendimentos Imobiliários S/C Ltda — Arujá/SP, desde 1975.

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase · Vercel.

---

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev
```

O site sobe em <http://localhost:3000>. Sem `.env.local` preenchido ele ainda abre:
as páginas renderizam com os textos institucionais padrão e as listagens
aparecem vazias, sinalizando "configuração pendente" em vez de quebrar.

O painel administrativo abre em <http://admin.localhost:3000> (mesmo
`npm run dev`, veja [Painel administrativo](#painel-administrativo)).

### Variáveis de ambiente

| Variável | Onde encontrar | Exposta ao navegador |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › Data API | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesma tela | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › API Keys › service_role | **não** |
| `NEXT_PUBLIC_SITE_URL` | domínio público, sem barra final | sim |

A `SUPABASE_SERVICE_ROLE_KEY` ignora RLS. Ela só é lida em código de servidor
(`lib/supabase/admin.ts`, protegido por `server-only`) e nos scripts de
migração. Nunca prefixe com `NEXT_PUBLIC_`.

---

## Banco de dados

As migrations ficam em `supabase/migrations/` e devem ser aplicadas **em ordem**:

| Arquivo | O que faz |
|---|---|
| `0001_schema.sql` | tabelas, índices, triggers, busca textual em português |
| `0002_rls.sql` | Row Level Security de todas as tabelas |
| `0003_storage.sql` | buckets e políticas de arquivo |
| `0004_seed.sql` | tipos de imóvel e dados de contato reais |

Aplique pelo SQL Editor do Supabase (cole o conteúdo de cada arquivo, na ordem)
ou pela CLI:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

As migrations são aditivas: usam `create table if not exists`, `on conflict do
nothing` e não apagam nada.

### O primeiro usuário vira administrador

Crie o usuário em Supabase › Authentication › Users. O trigger
`handle_new_user` dá papel `admin` ao primeiro perfil criado e `editor` aos
seguintes. Depois é só entrar em `https://admin.valedosolimoveis.com.br/`.

Para promover alguém depois:

```sql
update public.profiles set role = 'admin' where email = 'pessoa@exemplo.com';
```

### Esqueci minha senha

`/esqueci-senha` (no painel) envia um link pelo Supabase; o link volta em
`/auth/confirmar`, que abre a sessão e leva a `/nova-senha`. Quem
já está logado troca a senha pelo mesmo endereço ("Trocar senha" no menu).
Para o link funcionar, duas configurações no Supabase:

1. **Authentication › URL Configuration › Redirect URLs**: incluir
   `https://admin.valedosolimoveis.com.br/auth/confirmar` (e, para testar no
   computador, `http://admin.localhost:3000/auth/confirmar`). O link sempre
   volta para o endereço do painel onde o pedido foi feito. Sem isso o
   Supabase manda a pessoa para a Site URL e o link não abre a tela de senha
   nova.
2. **Authentication › Emails › SMTP Settings**: o envio padrão do Supabase só
   entrega para membros da organização e tem limite de poucos e-mails por hora.
   Para a equipe receber, configure um SMTP próprio (Resend, Gmail/Workspace…).

O link precisa ser aberto no mesmo navegador em que foi pedido (fluxo PKCE).
Se vencer ou for aberto em outro aparelho, o login mostra um aviso para pedir
outro.

---

## Papéis

| | admin | editor |
|---|---|---|
| Imóveis (criar, editar, publicar) | sim | sim |
| Excluir imóvel | sim | não |
| Contatos (ler, responder, anotar) | sim | sim |
| Excluir contato | sim | não |
| Regiões e tipos de imóvel | sim | sim (sem excluir) |
| Configurações do site | sim | **não** |

O bloqueio acontece em três camadas: `proxy.ts` barra o painel sem sessão,
cada página chama `requireStaff()` ou `requireAdmin()`, e a RLS decide no banco.
Nenhuma delas confia no frontend.

---

## Painel administrativo

O painel é separado do site público pelo **hostname**, no mesmo projeto Next.js,
na mesma Vercel e no mesmo Supabase:

| Endereço | O que abre |
|---|---|
| `https://valedosolimoveis.com.br/` (ou o domínio público em uso) | só o site público |
| `https://admin.valedosolimoveis.com.br/` | só o painel |

O site público não tem nenhum link para o painel, e `/admin` nele responde 404,
como qualquer endereço inexistente.

No painel, os endereços não têm o prefixo `/admin`:

| Endereço no painel | Tela |
|---|---|
| `/` | login (ou início, para quem já entrou) |
| `/login`, `/esqueci-senha`, `/nova-senha` | acesso e senha |
| `/dashboard` | início |
| `/imoveis`, `/imoveis/novo`, `/imoveis/<id>` | imóveis |
| `/leads` | contatos |
| `/regioes`, `/tipos-imovel` | regiões e tipos de imóvel |
| `/configuracoes` | configurações do site (só admin) |

Como funciona (arquivos):

- `lib/admin-host.ts` — a regra de host (primeiro rótulo `admin`) e os caminhos
  do painel. É a única fonte dessa regra; o matcher do `proxy.ts` e o
  `headers()` do `next.config.ts` repetem o mesmo padrão `admin\..+` porque
  lá o valor precisa ser literal.
- `proxy.ts` — no host `admin.*`, reescreve `/dashboard` → `/admin/dashboard`
  (as telas continuam em `app/admin`), renova a sessão do Supabase e barra quem
  não entrou; endereços antigos `/admin/...` são redirecionados para a versão
  sem prefixo. Em qualquer outro host, `/admin` responde 404. O proxy não roda
  nas páginas públicas.
- `app/admin/layout.tsx` — repete a trava de host no servidor: nenhuma tela do
  painel é renderizada fora do `admin.*`.
- Nada do painel é indexado: `robots.txt` próprio (`Disallow: /`),
  `<meta name="robots" content="noindex, nofollow">` e cabeçalho
  `X-Robots-Tag: noindex, nofollow` em todas as respostas do `admin.*`.

Os links "Ver o site" e "ver no site" do painel apontam para
`NEXT_PUBLIC_SITE_URL`.

### No computador

Com `npm run dev`, abra <http://admin.localhost:3000>. Chrome, Edge e Firefox
resolvem `*.localhost` sozinhos. Se o navegador não abrir (Safari, por
exemplo), acrescente ao arquivo de hosts (`/etc/hosts` no macOS/Linux,
`C:\Windows\System32\drivers\etc\hosts` no Windows):

```
127.0.0.1 admin.localhost
```

O site público continua em <http://localhost:3000>.

### Domínio na Vercel

1. Vercel › projeto › **Settings › Domains** › adicionar
   `admin.valedosolimoveis.com.br` (ambiente Production).
2. No DNS do domínio `valedosolimoveis.com.br`, criar o registro que a Vercel
   indicar para o subdomínio — normalmente `CNAME admin → cname.vercel-dns.com`.
3. Supabase › Authentication › URL Configuration › Redirect URLs: incluir
   `https://admin.valedosolimoveis.com.br/auth/confirmar`.

Enquanto o subdomínio não estiver apontado, o painel fica inacessível em
produção (o `/admin` do domínio público não existe mais). Faça os passos acima
**antes** de publicar esta versão em produção.

---

## Migração do site antigo

O site anterior é WordPress e expõe a REST API. Dois scripts cuidam da mudança:

```bash
# 1. Baixa os imóveis, as taxonomias e as fotos para ./data (não grava no banco)
node scripts/extract-wordpress.mjs

# Retomar só o download das fotos, reaproveitando o que já foi extraído
node scripts/extract-wordpress.mjs --only-images

# 2. Confira data/properties.json e então importe
node scripts/import-to-supabase.mjs              # simulação
node scripts/import-to-supabase.mjs --confirm    # grava, como RASCUNHO
node scripts/import-to-supabase.mjs --confirm --publicar
```

O import é idempotente (casa pelo `legacy_id`), nunca apaga nada e traz os
imóveis como rascunho, para alguém da Vale do Sol revisar antes de publicar.

> **O servidor do site antigo limita conexões.** Ele bloqueia o IP por vários
> minutos depois de uma rajada de requisições. Por isso o extrator usa uma
> conexão só, com pausa entre pedidos e recuo automático. Baixar as ~540 fotos
> demora, e o script pode ser interrompido e retomado à vontade: o que já está
> em `data/images/` é pulado.

> **Foto com acento no nome não é baixável.** Arquivos como
> `Rubens-Jordanópolisi-5.jpg` respondem **404** no servidor antigo, embora a
> REST API os liste normalmente. Testado com o caractere literal, com
> percent-encoding UTF-8 (`%C3%B3`), Latin-1 (`%F3`), forma decomposta
> (`o%CC%81`), nome sem acento e com cabeçalho `Referer` — todos 404. Também
> não estão no Internet Archive. Não há como recuperá-las por HTTP: a saída é
> pegar a pasta `wp-content/uploads` pela hospedagem (cPanel ou FTP).

---

## SEO e migração de URLs

As páginas de imóvel mantêm o mesmo caminho do site antigo (`/imoveis/<slug>`),
então os links já indexados continuam valendo. O que mudou de endereço tem 301
declarado em `next.config.ts`:

| Antes | Agora |
|---|---|
| `/sobre` | `/a-imobiliaria` |
| `/envie-seu-imovel` | `/venda-seu-imovel` |
| `/local/:cidade` | `/regioes/:cidade` |
| `/local/:cidade/:bairro` | `/regioes/:bairro` |
| `/tipo-de-imovel/:slug` | `/imoveis?tipo=:slug` |
| `/situacao/:slug` | `/imoveis?status=:slug` |
| `/corretores` | `/a-imobiliaria` |

Também há `sitemap.xml`, `robots.txt`, metadata dinâmica por imóvel, Open Graph,
Twitter Card e JSON-LD (`Residence`, `RealEstateAgent`, `BreadcrumbList`).

Buscas com filtro (`/imoveis?...`) saem do índice com `robots: noindex, follow`:
a combinação de filtros gera milhares de URLs quase iguais, e deixá-las no
índice dilui a listagem principal.

---

## O logo

`public/brand/logo.png` é o arquivo oficial da marca, exatamente como está no ar
desde 2016. Ele não é redesenhado, recolorido, convertido nem "modernizado" — o
sistema visual foi construído em volta dele, e a paleta do site é derivada das
cores que o próprio logo já tem (verde `#004818`, dourado `#f0c018`).

A troca do logo não está no painel de configurações, de propósito: substituir a
marca é decisão que passa por quem cuida do código, não um clique acidental.

Sobre a foto do hero o cabeçalho fica transparente. Como o logo foi desenhado
para fundo claro, ele ganha uma **placa branca atrás** — o arquivo continua
exatamente o mesmo, sem filtro, recorte ou inversão.

---

## Sistema visual

Todos os valores de cor, tipo, sombra, raio e curva de animação ficam em
`app/globals.css`, dentro de `@theme`. Componente nenhum escreve cor ou tamanho
absoluto: se a paleta mudar ali, o site inteiro acompanha.

| Token | Para que serve |
|---|---|
| `--text-hero`, `--text-display`, `--text-title` | escala tipográfica fluida (`clamp`), sem breakpoint |
| `--radius-lg` (24px) | o card de imóvel |
| `--radius-md` (16px) | painéis, galeria, caixas de filtro |
| `--radius-pill` | todos os botões |
| `--shadow-subtle` → `--shadow-float` | quatro níveis de elevação, todos esverdeados |
| `--ease-premium` | a curva usada em hover, revelação e transição de tela |
| `.section`, `.section-tight` | ritmo vertical único entre as seções |
| `.eyebrow` | linha fina de seção, já com o traço dourado |
| `.label-caps` | micro-rótulo em caixa alta (campos, meta do card) |
| `.glass-panel` | painel translúcido sobre foto — a busca do hero |
| `.reveal`, `.ken-burns`, `.shimmer`, `.link-sweep` | movimento |

A linguagem de forma — cantos generosos, botão-pílula, painel de vidro, card
com o título **sobre** a foto e trilho horizontal nos destaques — veio de
`imobiliariatorela.com.br`, referência escolhida pelo cliente. O que **não**
veio de lá: a paleta e a tipografia. Cor e serifa continuam saindo do logo da
Vale do Sol, por decisão explícita dele.

Toda animação está desligada sob `prefers-reduced-motion: reduce`, e as páginas
continuam legíveis sem JavaScript: a revelação no scroll nasce visível e só
depois é armada.

---

## Estrutura

```
app/
  (site)/          páginas públicas (Home, imóveis, regiões, institucional)
  admin/           painel — servido em admin.* sem o prefixo /admin (proxy.ts)
    login/         entrada
    esqueci-senha/ pedido do link de senha nova
    auth/confirmar retorno do link do e-mail (vira sessão)
    nova-senha/    criar ou trocar a senha
    (painel)/      área autenticada, com barra lateral
actions/           server actions (formulários, CRUD, autenticação)
components/
  ui/              botões, campos, selos, paginação, ícones
  property/        card, galeria, busca, filtros, favoritar
  forms/           formulários públicos
  admin/           telas do painel
lib/
  supabase/        env (neutro), public (leitura), server (sessão), admin (service role)
  queries/         leitura de dados
  validations/     schemas zod
hooks/             favoritos e estado do navegador
supabase/migrations/
scripts/           extração e importação do site antigo
```

---

## Deploy

Vercel, com as quatro variáveis de ambiente configuradas no projeto.
`NEXT_PUBLIC_SITE_URL` deve apontar para o domínio final — é ele que assina
canonical, sitemap e Open Graph.

Páginas públicas usam ISR (`revalidate`), e o painel dispara `revalidatePath`
ao salvar: publicar um imóvel atualiza o site sem rebuild manual.
