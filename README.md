# jynx funcionários (front-end)

Sistema web de cadastro de funcionários. A pessoa cria uma conta, entra e, no
painel, consegue listar, buscar, cadastrar, editar e excluir funcionários.

Este repositório tem **só o front-end**: HTML, CSS e JavaScript puros, sem
framework, sem biblioteca e sem etapa de build. Ele é publicado no GitHub Pages
e conversa com uma API REST própria (Node.js + Fastify) hospedada no Render.

> O back-end está em outro repositório: [LINK DO REPOSITÓRIO DO BACK]

## Funcionalidades

- **Tela de acesso com duas abas**, "Entrar" e "Criar conta". As abas funcionam
  pelo teclado (setas, Home e End) e o endereço `index.html#criar-conta` abre direto
  na aba de cadastro.
- **Criar conta**: depois do cadastro, a tela volta para "Entrar" com o e-mail
  já preenchido.
- **Entrar**: com o login certo, a pessoa vai direto para o painel. Quem já
  entrou e abre a tela de acesso também vai direto para o painel.
- **Painel de funcionários**:
  - lista com o total de funcionários cadastrados;
  - busca instantânea por nome, telefone ou e-mail (sem diferenciar acentos nem
    maiúsculas), feita no navegador sobre a lista já carregada;
  - um formulário com dois modos, "Novo funcionário" e "Editar funcionário";
  - exclusão em duas etapas, confirmada na própria linha;
  - botão "Sair".
- **Feedback em português simples**: mensagens diferentes para sem internet,
  tempo esgotado e erro do servidor, e um aviso quando o servidor gratuito do
  Render está "acordando" (pode levar até 1 minuto).
- **Validação antes de enviar**: campos obrigatórios, formato de e-mail,
  telefone com 8 a 15 dígitos e senha nova com pelo menos 6 caracteres. O foco
  vai para o primeiro campo com problema.
- **Acessibilidade**: rótulos em todos os campos, mensagens anunciadas por
  leitor de tela (`role="status"` / `role="alert"`), foco visível, alvos de toque
  de pelo menos 44px no celular e respeito ao `prefers-reduced-motion`.
- **Layout mobile first**, sem rolagem horizontal. No celular, a tabela vira uma
  pilha de cartões.

## Tecnologias

- HTML5 semântico
- CSS3 (custom properties, grid, flexbox, `:has()`, media queries)
- JavaScript (ES2020+), com `fetch`, `AbortController` e `localStorage`
- GitHub Pages (hospedagem do front)
- API própria em Node.js + Fastify, hospedada no Render (outro repositório)

## Como rodar localmente

Não há dependências nem build. Basta servir a pasta com qualquer servidor
estático, por exemplo:

```bash
# com Python
python -m http.server 8080

# ou com Node
npx serve .
```

Depois abra `http://localhost:8080` (ou a porta que o servidor indicar). No
VS Code, a extensão Live Server também funciona.

### Trocando o endereço da API

O endereço do back fica em **um único lugar**, no topo de `js/api.js`:

```js
const API_URL = "https://back-jynx.onrender.com";
// const API_URL = "http://localhost:3000"; // desenvolvimento local (npm run dev)
```

Para usar o back rodando na sua máquina, comente a primeira linha e descomente
a segunda. Se o site estiver publicado (fora do `localhost`) e a `API_URL` não
usar `https`, o console mostra um aviso, porque as senhas viajariam sem
criptografia.

## Estrutura de pastas

```
front-jynx/
├── index.html       tela de acesso (abas "Entrar" e "Criar conta")
├── painel.html      painel de funcionários
├── cadastro.html    só redireciona links antigos para index.html#criar-conta
├── css/
│   └── style.css    estilo de todas as páginas
└── js/
    ├── api.js       ferramentas compartilhadas: fetch, erros, mensagens, validação, localStorage
    ├── acesso.js    abas da tela de acesso e redirecionamento de quem já entrou
    ├── login.js     formulário "Entrar"
    ├── cadastro.js  formulário "Criar conta"
    └── painel.js    lista, busca, formulário (novo/editar), exclusão e "Sair"
```

Todos os caminhos são relativos (sem `/` no início), porque o GitHub Pages
publica o site numa subpasta (`/front-jynx/`).

Cada arquivo JS (menos o `api.js`) fica dentro de uma função autoexecutável
(IIFE). Como os scripts comuns dividem o mesmo escopo global, isso evita que
dois arquivos da mesma página colidam ao declarar nomes iguais (por exemplo,
`const mensagem` em `login.js` e em `cadastro.js`).

## Fluxo da aplicação

1. **index.html**: se já existe um nome salvo no navegador, a pessoa vai direto
   para `painel.html`. Se não, vê a aba "Entrar" (ou "Criar conta", com `#criar-conta`).
2. **Criar conta** → `POST /user`. Deu certo: a tela troca para "Entrar", preenche
   o e-mail e mostra "Conta criada! Agora é só entrar."
3. **Entrar** → `POST /login`. Deu certo: o front guarda **só o nome** no
   `localStorage` e abre `painel.html`.
4. **painel.html**: sem nome salvo, volta para `index.html`. Com nome, mostra
   "Olá, {nome}" e carrega a lista (`GET /users`).
5. **Buscar**: filtra a lista já carregada, sem nova requisição.
6. **Novo funcionário** → `POST /user`. **Editar** → `PUT /user/:id`.
   **Excluir** (dois cliques) → `DELETE /user/:id`. Depois de cada uma, a lista
   é recarregada do servidor.
7. **Sair**: apaga o nome salvo e volta para `index.html`.

## Decisões de segurança no front

- Dados vindos da API ou do `localStorage` são escritos com `textContent` /
  `createElement`, nunca com `innerHTML` (evita XSS).
- O `GET /users` devolve o hash da senha. O front copia só `id`, `name`,
  `phone` e `email` para um objeto novo, e o hash nunca é exibido, guardado ou logado.
- O id do funcionário só aceita inteiros positivos e entra na URL com
  `encodeURIComponent`. Ele fica num atributo `data-id` e não aparece na tela.
- Credenciais vão só no corpo de requisições `POST`/`PUT`, nunca na URL.
- O `localStorage` guarda apenas o nome, para o cumprimento. Nada de senha, e-mail ou id.
- Login errado e e-mail inexistente mostram a mesma frase, para a tela não
  revelar quais e-mails têm conta.
- As mensagens técnicas do servidor não são exibidas.

## Limitações conhecidas

Estas limitações existem hoje e não foram escondidas:

- **O login e a proteção do painel são só visuais.** A API não emite token nem
  sessão. "Estar logado" é apenas ter um nome salvo no `localStorage`, que
  qualquer pessoa pode criar pelo DevTools do navegador. O redirecionamento do
  painel é uma conveniência, não uma barreira de segurança.
- **As rotas da API são abertas.** Qualquer pessoa que conheça o endereço pode
  listar, criar, editar ou excluir registros sem passar por este front.
- **A API devolve o hash das senhas** no `GET /users`. O front não mostra esse
  campo, mas ele trafega na resposta.
- **Editar exige definir uma senha nova.** O back sempre troca a senha no `PUT`,
  então não é possível alterar só o telefone sem informar uma senha nova. O
  formulário avisa isso.
- **Funcionários e contas são a mesma coisa.** A API usa uma única tabela, então
  todo funcionário cadastrado no painel também consegue entrar no sistema com o
  e-mail e a senha definidos ali.
- **Excluir a própria conta não é tratado.** O painel não sabe qual linha é a da
  pessoa logada. Se ela se excluir, continua no painel até clicar em "Sair".
- **Erros do servidor são genéricos.** O back responde erro 500 para casos como
  e-mail ou telefone repetido, então o front só consegue sugerir a causa provável.
- **Primeiro acesso lento.** O plano gratuito do Render "dorme" sem uso, e a
  primeira requisição pode levar até 1 minuto.
- **Não há testes automatizados** neste repositório.

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
