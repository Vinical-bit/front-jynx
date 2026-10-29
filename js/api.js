// =========================================================
// api.js — a "caixa de ferramentas" que as páginas compartilham
// =========================================================
//
// MAPA DO ARQUIVO
//   API_URL ............ endereço do back (o ÚNICO lugar do projeto com a URL)
//   ErroApi ............ tipo de erro com um "tipo": "rede", "tempo" ou "servidor"
//   requisitar() ....... faz o fetch e devolve o corpo já lido (texto ou objeto)
//   mensagemDeErro() ... traduz um ErroApi para uma frase em português simples
//   mostrarMensagem() .. escreve um aviso na tela (sucesso, erro ou informação)
//   limparMensagem() ... apaga o aviso
//   ocuparBotao() / liberarBotao() ... "Salvando…" durante a requisição
//   marcarInvalido() / limparInvalidos() ... destaque do campo com problema
//   emailValido(), telefoneValido(), lerId() ... validações usadas antes de enviar
//   salvarNomeLogado(), lerNomeLogado(), apagarNomeLogado() ... o único dado do localStorage
//
// ORDEM
//   Este arquivo é carregado ANTES do script de cada página (<script src> no HTML),
//   então tudo aqui já existe quando acesso.js, login.js, cadastro.js ou painel.js rodam.
//   Ao carregar, ele só confere se a URL da API é segura.
//
// POR QUE ESTE ARQUIVO NÃO ESTÁ NUMA IIFE (e os outros estão)
//   Scripts comuns (sem type="module") dividem o mesmo escopo global. Aqui isso
//   é de propósito: estas funções são as ferramentas "públicas" que os outros
//   arquivos usam. Por isso os outros arquivos ficam fechados em IIFEs e NUNCA
//   devem declarar no topo um nome que já exista aqui.
//
// ---------------------------------------------------------
// CONTRATO DA API (exemplos reais, tirados do código do back)
// ---------------------------------------------------------
// Toda requisição com corpo usa Content-Type: application/json.
//
// POST /user  (cadastro)
//   corpo: { "name": "teste-jynx", "phone": "11999990000", "email": "teste@teste.local", "password": "senha-de-teste-123" }
//   resposta 200, TEXTO: O Usuario: teste-jynx foi cadastrado com sucesso!
//
// POST /login  (atenção: aqui a senha se chama "senha", e não "password")
//   corpo: { "email": "teste@teste.local", "senha": "senha-de-teste-123" }
//   sucesso, 200, JSON: { "menssagem": "Logado com sucesso", "nome": "teste-jynx", "telefone": "11999990000", "email": "teste@teste.local", "id": 7 }
//   e-mail inexistente, 200, TEXTO: Não encontrado
//   senha errada, 200, TEXTO: usuario ou senha incorreta
//
// GET /users
//   resposta 200, JSON: [ { "id": 7, "name": "teste-jynx", "phone": "11999990000", "email": "teste@teste.local", "password": "$2b$10$...hash..." } ]
//   NUNCA renderize nem guarde o campo "password" (é o hash).
//
// GET /user/7
//   resposta 200, JSON: um objeto igual ao de cima.
//   Id inexistente: 200 com corpo VAZIO. Id que não é número: erro 500.
//
// PUT /user/7
//   corpo: { "name": "teste-jynx-2", "phone": "11999990000", "email": "teste@teste.local", "password": "nova-senha-123" }
//   resposta 200, TEXTO: O usuario teste-jynx Foi atualizado para o nome teste-jynx-2
//
// DELETE /user/7
//   resposta 200, TEXTO: Usuario com ID: 7, deletado com sucesso!
//
// Erros do servidor: status 500 e JSON { statusCode, error, message }.
// =========================================================

const API_URL = "https://back-jynx.onrender.com";
// const API_URL = "http://localhost:3000"; // desenvolvimento local (npm run dev)

// O Render (plano free) "dorme" quando ninguém usa e leva até ~1 minuto para
// acordar. Por isso esperamos 60s antes de desistir, e depois de 4s avisamos
// a pessoa que a demora é normal, para ela não achar que travou.
const TEMPO_LIMITE_MS = 60000;
const TEMPO_AVISO_MS = 4000;
const AVISO_SERVIDOR_ACORDANDO = "O servidor está acordando, pode levar até 1 minuto…";

const CHAVE_NOME_LOGADO = "jynx:nomeLogado";

// Na tela de acesso, cadastro.js AVISA que uma conta foi criada (um evento) e
// acesso.js/login.js REAGEM. Assim nenhum arquivo mexe nas variáveis do outro.
const EVENTO_CONTA_CRIADA = "jynx:conta-criada";

// Se o site está publicado (não é localhost) e a API não usa https, os dados
// (inclusive senhas) viajam sem criptografia. O front não consegue impedir
// isso, mas pode avisar bem alto no console de quem está desenvolvendo.
if (!API_URL.startsWith("https://") && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  console.warn(`[jynx] ATENÇÃO: API_URL (${API_URL}) não usa https. Senhas e dados vão trafegar sem criptografia.`);
}

// ---------- requisições ----------

// Um Error comum só tem texto. Com o "tipo" a página sabe QUAL problema
// aconteceu e pode mostrar uma mensagem diferente para cada um.
class ErroApi extends Error {
  constructor(tipo, status = 0) {
    super(`Falha na API: ${tipo}`);
    this.tipo = tipo; // "rede" | "tempo" | "servidor"
    this.status = status;
  }
}

// Faz a requisição e devolve o corpo pronto: um objeto/array (se veio JSON),
// um texto (se veio texto) ou "" (se veio vazio). Qualquer problema vira ErroApi.
//
// opcoes.metodo ...... "GET", "POST", "PUT" ou "DELETE"
// opcoes.corpo ....... objeto que vai virar JSON (só para POST e PUT)
// opcoes.aoDemorar ... função chamada se passar de 4s sem resposta
async function requisitar(caminho, { metodo = "GET", corpo, aoDemorar } = {}) {
  // AbortController é o "botão de cancelar" do fetch. Sem ele, um fetch
  // esperaria para sempre se o servidor nunca respondesse.
  const controle = new AbortController();
  const relogioLimite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  const relogioAviso = aoDemorar ? setTimeout(aoDemorar, TEMPO_AVISO_MS) : null;

  const opcoesFetch = { method: metodo, signal: controle.signal };
  if (corpo !== undefined) {
    // Sem esse header o Fastify não sabe que o corpo é JSON e req.body chega vazio.
    opcoesFetch.headers = { "Content-Type": "application/json" };
    opcoesFetch.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(API_URL + caminho, opcoesFetch);
  } catch (erro) {
    // O fetch só "estoura" quando NÃO houve resposta: sem internet, servidor
    // fora do ar, CORS... ou quando nós mesmos cancelamos pelo tempo limite.
    throw new ErroApi(erro.name === "AbortError" ? "tempo" : "rede");
  } finally {
    // finally roda com sucesso OU com erro: é o lugar certo para desligar os
    // relógios, senão o aviso de "acordando" apareceria depois da resposta.
    clearTimeout(relogioLimite);
    clearTimeout(relogioAviso);
  }

  // Atenção: um status 500 NÃO faz o fetch estourar. Ele "dá certo" do ponto de
  // vista da rede, então somos nós que conferimos response.ok (status 200–299).
  // Não repassamos a mensagem técnica do back (ela pode até expor o banco).
  if (!resposta.ok) {
    throw new ErroApi("servidor", resposta.status);
  }

  // Este back às vezes responde texto ("Não encontrado") e às vezes JSON.
  // response.json() quebraria com texto, então lemos SEMPRE como texto e só
  // convertemos quando o próprio servidor diz que é JSON.
  const texto = await resposta.text();
  const tipoConteudo = resposta.headers.get("Content-Type") || "";

  if (texto && tipoConteudo.includes("application/json")) {
    try {
      return JSON.parse(texto);
    } catch {
      throw new ErroApi("servidor", resposta.status);
    }
  }
  return texto;
}

// Cada tipo de erro pede uma ação diferente da pessoa, por isso três frases.
function mensagemDeErro(erro) {
  if (erro instanceof ErroApi && erro.tipo === "rede") {
    return "Não foi possível falar com o servidor. Confira sua internet e tente de novo.";
  }
  if (erro instanceof ErroApi && erro.tipo === "tempo") {
    return "O servidor demorou demais para responder. Espere um pouco e tente de novo.";
  }
  // "servidor" ou qualquer erro inesperado do nosso próprio código.
  return "O servidor teve um problema e não concluiu o pedido. Tente de novo em instantes.";
}

// ---------- mensagens na tela ----------

// tipo: "sucesso" | "erro" | "info"
// Usamos textContent (e nunca innerHTML) porque o texto pode vir do servidor
// ou de outra pessoa. Com innerHTML, um nome como <img onerror=...> viraria
// código rodando no navegador de quem abrir a página (ataque XSS).
function mostrarMensagem(elemento, texto, tipo = "info") {
  elemento.classList.toggle("mensagem--sucesso", tipo === "sucesso");
  elemento.classList.toggle("mensagem--erro", tipo === "erro");
  // role="alert" interrompe o leitor de tela (erro é urgente);
  // role="status" espera ele terminar de falar (sucesso e informação).
  elemento.setAttribute("role", tipo === "erro" ? "alert" : "status");
  elemento.textContent = texto;
}

function limparMensagem(elemento) {
  elemento.classList.remove("mensagem--sucesso", "mensagem--erro");
  elemento.textContent = ""; // vazio = escondido pelo CSS (.mensagem:empty)
}

// ---------- botões ----------

// Desabilitar o botão impede o clique duplo de mandar a mesma requisição duas
// vezes (dois cadastros iguais, por exemplo). Guardamos o texto original no
// data-texto para conseguir voltar ao normal depois.
function ocuparBotao(botao, textoOcupado) {
  botao.dataset.texto = botao.textContent;
  botao.textContent = textoOcupado;
  botao.disabled = true;
}

function liberarBotao(botao) {
  botao.textContent = botao.dataset.texto || botao.textContent;
  botao.disabled = false;
}

// ---------- validação ----------

// aria-invalid faz o leitor de tela dizer "inválido" no campo, e o CSS usa o
// mesmo atributo para pintar a borda: um atributo serve aos dois públicos.
function marcarInvalido(campo) {
  campo.setAttribute("aria-invalid", "true");
  campo.focus(); // leva a pessoa direto ao que precisa corrigir
}

function limparInvalidos(form) {
  form.querySelectorAll("[aria-invalid]").forEach((campo) => campo.removeAttribute("aria-invalid"));
}

// Formato BÁSICO: algo@algo.algo, sem espaços. Não garante que o e-mail
// existe (só o back, mandando um e-mail de confirmação, poderia garantir).
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Aceita o telefone do jeito que a pessoa escreve ("(81) 99999-0000"), mas
// exige de 8 a 15 dígitos e só os símbolos comuns de telefone. O texto vai
// para o banco como foi digitado; só conferimos se parece um telefone.
function telefoneValido(telefone) {
  const digitos = telefone.replace(/\D/g, "");
  return /^[\d\s()+.-]+$/.test(telefone) && digitos.length >= 8 && digitos.length <= 15;
}

// O back aceita qualquer senha, até de 1 letra. Para contas novas (e senhas
// trocadas) pedimos um mínimo. No login NÃO conferimos isso: contas antigas
// podem ter senhas menores e precisam continuar entrando.
const SENHA_MINIMA = 6;

// Converte o texto do campo em um id inteiro positivo, ou null.
// O id vai para dentro da URL (/user/7), então só aceitamos dígitos:
// "7abc", "-1", "1.5" ou "../users" nunca chegam ao servidor.
function lerId(texto) {
  const limpo = String(texto).trim();
  if (!/^\d+$/.test(limpo)) return null;
  const id = Number(limpo);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// ---------- quem está logado ----------
//
// IMPORTANTE: a API não emite token nem sessão. "Estar logado" aqui é só ter
// um nome guardado no navegador. Isso serve para CONVENIÊNCIA (mostrar
// "Olá, Ana" e pular a tela de acesso), NÃO é segurança: qualquer pessoa pode
// escrever um nome no localStorage pelo DevTools, e as rotas da API são abertas.

// Guardamos SÓ o nome, para exibir. Nada de senha, id ou e-mail: qualquer
// script da página (ou extensão do navegador) consegue ler o localStorage.
// O try/catch existe porque o localStorage pode estar bloqueado (aba anônima,
// configurações de privacidade). Devolve true/false para o login saber se deu.
function salvarNomeLogado(nome) {
  try {
    localStorage.setItem(CHAVE_NOME_LOGADO, String(nome).trim().slice(0, 80));
    return true;
  } catch {
    return false;
  }
}

function apagarNomeLogado() {
  try {
    localStorage.removeItem(CHAVE_NOME_LOGADO);
  } catch {
    // localStorage indisponível: não há o que apagar
  }
}

// O localStorage pode ter sido editado à mão (DevTools), então validamos ao
// ler, como faríamos com qualquer dado de fora. Se estiver estranho, descartamos.
function lerNomeLogado() {
  try {
    const nome = (localStorage.getItem(CHAVE_NOME_LOGADO) || "").trim();
    if (nome.length > 0 && nome.length <= 80) return nome;
    localStorage.removeItem(CHAVE_NOME_LOGADO);
  } catch {
    // localStorage indisponível
  }
  return null;
}
