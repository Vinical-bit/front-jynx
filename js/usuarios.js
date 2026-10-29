// =========================================================
// usuarios.js — painel de usuários (usuarios.html)
// Rotas:
//   GET    /users      → lista todos
//   GET    /user/:id   → um usuário
//   PUT    /user/:id   → corpo { name, phone, email, password }
//   DELETE /user/:id
// =========================================================
//
// MAPA DO ARQUIVO
//   Listar
//     limparUsuario() ... copia SÓ os campos que usamos (id, name, phone, email)
//     criarLinha() ...... monta uma <tr> a partir do <template id="modelo-linha">
//     carregarLista() ... GET /users → desenha a tabela e o total
//   Excluir (em duas etapas)
//     pedirConfirmacao() / cancelarConfirmacao() ... 1º clique: o botão vira "Confirmar exclusão"
//     excluir() ......................................... 2º clique: DELETE /user/:id
//   Editar
//     preencherEdicao() ... "Editar" na tabela copia os dados para o formulário
//     lerEdicao() / validarEdicao() ... leem e conferem o formulário
//     salvarEdicao() ...... o "submit": PUT /user/:id → mensagem → carregarLista()
//     limparEdicao() ...... botão "Limpar" (reset) também apaga mensagem e destaques
//   Buscar por ID
//     buscarPorId() ...... o "submit": GET /user/:id → mostra em #resultado-busca
//     textoDoUsuario() ... monta o texto do resultado, um campo por linha
//   Cliques na tabela
//     cliqueNaTabela() ... um único "escutador" no tbody decide o que cada botão faz
//
// ORDEM
//   1. Ao abrir a página: troca "visitante" pelo nome salvo, liga os
//      "escutadores" de eventos e chama carregarLista().
//   2. "Atualizar lista" chama carregarLista() de novo.
//   3. Clique em "Excluir" → cliqueNaTabela() → pedirConfirmacao();
//      clique de novo em até 5s → excluir() → carregarLista().
//   4. Clique em "Editar" → cliqueNaTabela() → preencherEdicao();
//      "Salvar alterações" → salvarEdicao() → carregarLista().
//   5. "Buscar" → buscarPorId().
//
// Depende de api.js (requisitar, mostrarMensagem, ocuparBotao...).

const tbody = document.querySelector("#lista-usuarios");
const modeloLinha = document.querySelector("#modelo-linha");
const secaoLista = document.querySelector(".lista");
const totalUsuarios = document.querySelector("#total-usuarios");
const mensagemLista = document.querySelector("#mensagem-lista");
const botaoAtualizar = document.querySelector("#botao-atualizar");
const tituloLista = secaoLista.querySelector(".cartao__titulo");

const formBusca = document.querySelector("#form-busca");
const buscaId = document.querySelector("#busca-id");
const botaoBuscar = document.querySelector("#botao-buscar");
const resultadoBusca = document.querySelector("#resultado-busca");

const formEditar = document.querySelector("#form-editar");
const editarId = document.querySelector("#editar-id");
const editarNome = document.querySelector("#editar-name");
const editarTelefone = document.querySelector("#editar-phone");
const editarEmail = document.querySelector("#editar-email");
const editarSenha = document.querySelector("#editar-password");
const mensagemEditar = document.querySelector("#mensagem-editar");
const botaoSalvar = document.querySelector("#botao-salvar");

// tabIndex = -1 deixa o título receber foco pelo JS (ver excluir()) sem
// entrar na ordem do Tab, que continua só com links, campos e botões.
tituloLista.tabIndex = -1;

// Mensagens em português em vez dos balões do navegador (ver cadastro.js).
formEditar.noValidate = true;
formBusca.noValidate = true;

// Este formulário edita OUTRA pessoa. Sem isto, o navegador poderia
// preencher sozinho o nome/e-mail de quem está usando o computador.
[editarNome, editarTelefone, editarEmail].forEach((campo) => (campo.autocomplete = "off"));

// Usuários da última listagem, por id. O botão "Editar" busca os dados aqui
// em vez de "ler de volta" o texto da tabela.
const usuariosCarregados = new Map();

// ---------- listar ----------

// O GET /users devolve também o hash da senha. Criamos um objeto NOVO com só
// o que a tela precisa, assim o hash nunca é guardado, mostrado nem logado.
// Devolve null se o id não for um inteiro positivo: esse id vai para dentro
// da URL do DELETE/PUT, então não aceitamos nada estranho.
function limparUsuario(bruto) {
  const id = lerId(bruto?.id);
  if (id === null) return null;
  return {
    id,
    name: String(bruto.name ?? ""),
    phone: String(bruto.phone ?? ""),
    email: String(bruto.email ?? ""),
  };
}

// O <template> é HTML "pronto e parado": cloneNode(true) faz uma cópia que
// preenchemos com textContent. Assim o HTML da linha fica no .html (fácil de
// mudar o visual) e os dados entram sempre como texto, nunca como código.
function criarLinha(usuario) {
  const linha = modeloLinha.content.cloneNode(true).querySelector("tr");
  linha.dataset.id = usuario.id;
  linha.querySelector(".col-id").textContent = `#${usuario.id}`;
  linha.querySelector(".col-nome").textContent = usuario.name;
  linha.querySelector(".col-telefone").textContent = usuario.phone;
  linha.querySelector(".col-email").textContent = usuario.email;

  // Para quem usa leitor de tela, vários botões "Editar" iguais não dizem
  // QUAL usuário. O aria-label completa com o nome (e continua começando com
  // o texto visível, para quem usa comando de voz).
  linha.querySelector(".botao-editar").setAttribute("aria-label", `Editar ${usuario.name}`);
  linha.querySelector(".botao-excluir").setAttribute("aria-label", `Excluir ${usuario.name}`);
  return linha;
}

async function carregarLista() {
  // As linhas vão ser recriadas: uma exclusão "armada" perderia o seu botão.
  cancelarConfirmacao();
  ocuparBotao(botaoAtualizar, "Atualizando…");
  // aria-busy avisa o leitor de tela que a região está mudando, e o CSS usa o
  // mesmo atributo para esconder o "Nenhum usuário" enquanto ainda carrega.
  secaoLista.setAttribute("aria-busy", "true");
  mostrarMensagem(mensagemLista, "Carregando usuários…", "info");
  totalUsuarios.textContent = "…";

  try {
    const resposta = await requisitar("/users", {
      aoDemorar: () => mostrarMensagem(mensagemLista, AVISO_SERVIDOR_ACORDANDO, "info"),
    });
    if (!Array.isArray(resposta)) throw new ErroApi("servidor");

    const usuarios = resposta.map(limparUsuario).filter(Boolean);
    usuariosCarregados.clear();
    usuarios.forEach((usuario) => usuariosCarregados.set(usuario.id, usuario));

    // replaceChildren apaga as linhas antigas e coloca as novas de uma vez.
    // Lista vazia → tbody vazio → o CSS mostra "Nenhum usuário por aqui".
    tbody.replaceChildren(...usuarios.map(criarLinha));
    totalUsuarios.textContent = usuarios.length;
    limparMensagem(mensagemLista);
    return true;
  } catch (erro) {
    totalUsuarios.textContent = "–";
    mostrarMensagem(mensagemLista, `${mensagemDeErro(erro)} Use o botão "Atualizar lista".`, "erro");
    return false;
  } finally {
    secaoLista.removeAttribute("aria-busy");
    liberarBotao(botaoAtualizar);
  }
}

// ---------- excluir (em duas etapas) ----------

// Excluir não tem volta, então o primeiro clique só "arma" o botão. Usamos isso
// em vez de window.confirm porque a confirmação fica no mesmo lugar do clique,
// não trava a página e segue o visual do site.
const TEMPO_CONFIRMAR_MS = 5000;

// Só uma exclusão pode estar esperando confirmação por vez:
// { botao, relogio } enquanto espera, null quando não há nenhuma.
let confirmacaoPendente = null;

function pedirConfirmacao(botao, usuario) {
  cancelarConfirmacao(); // se outro botão estava armado, ele volta ao normal

  botao.dataset.confirmando = "sim";
  botao.textContent = "Confirmar exclusão";
  botao.setAttribute("aria-label", `Confirmar exclusão de ${usuario.name}`);
  // O texto do botão mudou, mas o leitor de tela nem sempre anuncia isso.
  // A mensagem (role="status") garante que a pessoa saiba o próximo passo.
  mostrarMensagem(mensagemLista, `Clique de novo em "Confirmar exclusão" para excluir ${usuario.name}.`, "info");

  const relogio = setTimeout(cancelarConfirmacao, TEMPO_CONFIRMAR_MS);
  confirmacaoPendente = { botao, relogio, usuario };
}

// Desarma a confirmação: desliga o relógio e devolve o botão ao normal.
function desarmar() {
  const { botao, relogio, usuario } = confirmacaoPendente;
  clearTimeout(relogio);
  delete botao.dataset.confirmando;
  botao.textContent = "Excluir";
  botao.setAttribute("aria-label", `Excluir ${usuario.name}`);
  confirmacaoPendente = null;
}

// Desistência (passou o tempo, outro botão foi armado ou a lista recarregou).
function cancelarConfirmacao() {
  if (!confirmacaoPendente) return;
  desarmar();
  limparMensagem(mensagemLista);
}

async function excluir(botao, usuario) {
  // Desarma ANTES de enviar: o relógio de 5s não pode mexer no botão no meio do DELETE.
  desarmar();
  ocuparBotao(botao, "Excluindo…");

  try {
    // encodeURIComponent garante que o id entre na URL só como um "pedaço" de
    // caminho. Aqui ele já é um número validado, mas o hábito evita surpresas.
    const resposta = await requisitar(`/user/${encodeURIComponent(usuario.id)}`, {
      metodo: "DELETE",
      aoDemorar: () => mostrarMensagem(mensagemLista, AVISO_SERVIDOR_ACORDANDO, "info"),
    });
    // Recarregamos do servidor (em vez de só apagar a linha) para a tabela
    // mostrar a verdade do banco, inclusive mudanças feitas por outras pessoas.
    const recarregou = await carregarLista();
    const texto = typeof resposta === "string" && resposta ? resposta : "Usuário excluído.";
    if (recarregou) {
      mostrarMensagem(mensagemLista, texto, "sucesso");
    } else {
      mostrarMensagem(mensagemLista, `${texto} Mas não deu para atualizar a lista: use o botão "Atualizar lista".`, "erro");
    }
    // O botão clicado sumiu junto com a linha, e o foco do teclado iria parar
    // no começo da página. Levamos o foco para o título da lista.
    tituloLista.focus();
  } catch (erro) {
    mostrarMensagem(mensagemLista, mensagemDeErro(erro), "erro");
    // Se deu erro, a linha continua na tela: o botão precisa voltar a funcionar.
    liberarBotao(botao);
  }
}

// ---------- editar ----------

// "Editar" na tabela só copia os dados para o formulário ao lado. A senha
// fica em branco de propósito: nós nunca temos a senha (só o back tem o hash).
function preencherEdicao(usuario) {
  formEditar.reset();
  limparInvalidos(formEditar);
  limparMensagem(mensagemEditar);
  editarId.value = usuario.id;
  editarNome.value = usuario.name;
  editarTelefone.value = usuario.phone;
  editarEmail.value = usuario.email;
  // No celular o formulário fica embaixo da lista: focar o campo já rola a
  // página até ele, e quem usa teclado continua de onde precisa.
  editarNome.focus();
}

function lerEdicao() {
  return {
    id: lerId(editarId.value),
    name: editarNome.value.trim(),
    phone: editarTelefone.value.trim(),
    email: editarEmail.value.trim().toLowerCase(),
    password: editarSenha.value, // sem trim, como no cadastro
  };
}

function validarEdicao(dados) {
  if (dados.id === null) return { campo: editarId, texto: "Escolha um usuário na lista (botão Editar) ou digite um ID válido." };
  if (!dados.name) return { campo: editarNome, texto: "Digite o nome." };
  if (!dados.phone) return { campo: editarTelefone, texto: "Digite o telefone." };
  if (!dados.email) return { campo: editarEmail, texto: "Digite o e-mail." };
  if (!emailValido(dados.email)) {
    return { campo: editarEmail, texto: "Esse e-mail parece incompleto. Use o formato voce@email.com." };
  }
  // O back sempre troca a senha no PUT, então ela é obrigatória aqui.
  if (!dados.password.trim()) return { campo: editarSenha, texto: "Digite uma nova senha (o servidor sempre troca a senha ao salvar)." };
  return null;
}

async function salvarEdicao(evento) {
  evento.preventDefault(); // sem recarregar a página (ver cadastro.js)

  limparInvalidos(formEditar);
  const dados = lerEdicao();
  const problema = validarEdicao(dados);
  if (problema) {
    mostrarMensagem(mensagemEditar, problema.texto, "erro");
    marcarInvalido(problema.campo);
    return;
  }

  ocuparBotao(botaoSalvar, "Salvando…");
  limparMensagem(mensagemEditar);

  try {
    // O id vai na URL e o resto no corpo, como o back espera.
    const { id, ...corpo } = dados;
    const resposta = await requisitar(`/user/${encodeURIComponent(id)}`, {
      metodo: "PUT",
      corpo,
      aoDemorar: () => mostrarMensagem(mensagemEditar, AVISO_SERVIDOR_ACORDANDO, "info"),
    });
    editarSenha.value = ""; // a senha não fica na tela depois de enviada
    mostrarMensagem(mensagemEditar, typeof resposta === "string" && resposta ? resposta : "Alterações salvas.", "sucesso");
    carregarLista(); // a tabela passa a mostrar os dados novos
  } catch (erro) {
    // O back responde erro, por exemplo, quando o ID não existe ou quando o
    // telefone/e-mail já é de outra pessoa. Damos a dica sem a mensagem técnica.
    const texto = erro.tipo === "servidor"
      ? "Não foi possível salvar. Confira se o ID existe e se o telefone ou e-mail não são de outra pessoa."
      : mensagemDeErro(erro);
    mostrarMensagem(mensagemEditar, texto, "erro");
  } finally {
    liberarBotao(botaoSalvar);
  }
}

// O botão "Limpar" é um type="reset" nativo: ele já apaga os campos.
// Só completamos apagando a mensagem e os destaques de erro.
function limparEdicao() {
  limparInvalidos(formEditar);
  limparMensagem(mensagemEditar);
}

// ---------- buscar por ID ----------

// Texto simples, uma informação por linha: o CSS do .resultado usa
// white-space: pre-wrap, então o "\n" vira quebra de linha na tela.
function textoDoUsuario(usuario) {
  return [
    `ID: ${usuario.id}`,
    `Nome: ${usuario.name}`,
    `Telefone: ${usuario.phone}`,
    `E-mail: ${usuario.email}`,
  ].join("\n");
}

async function buscarPorId(evento) {
  evento.preventDefault(); // sem recarregar a página (ver cadastro.js)

  limparInvalidos(formBusca);
  const id = lerId(buscaId.value);
  if (id === null) {
    mostrarMensagem(resultadoBusca, "Digite um ID válido: um número inteiro maior que zero.", "erro");
    marcarInvalido(buscaId);
    return;
  }

  ocuparBotao(botaoBuscar, "Buscando…");
  limparMensagem(resultadoBusca);

  try {
    const resposta = await requisitar(`/user/${encodeURIComponent(id)}`, {
      aoDemorar: () => mostrarMensagem(resultadoBusca, AVISO_SERVIDOR_ACORDANDO, "info"),
    });
    // Para um ID que não existe, o back responde 200 com o corpo VAZIO
    // (e não 404). Por isso "não achou" é decidido aqui, olhando o conteúdo.
    const usuario = typeof resposta === "object" ? limparUsuario(resposta) : null;
    if (usuario) {
      mostrarMensagem(resultadoBusca, textoDoUsuario(usuario), "info");
    } else {
      mostrarMensagem(resultadoBusca, `Nenhum usuário com o ID ${id}. Confira o número na lista abaixo.`, "erro");
    }
  } catch (erro) {
    mostrarMensagem(resultadoBusca, mensagemDeErro(erro), "erro");
  } finally {
    liberarBotao(botaoBuscar);
  }
}

// ---------- cliques na tabela ----------

// Um único listener no <tbody>, e não um em cada botão ("delegação de eventos").
// Motivo: as linhas são criadas e recriadas a cada carregarLista(). Botões novos
// não teriam listener, e teríamos que religar tudo sempre. O clique "sobe" do
// botão até o tbody, e lá descobrimos qual botão e qual linha foram clicados.
function cliqueNaTabela(evento) {
  const botao = evento.target.closest("button");
  if (!botao || botao.disabled) return;

  const linha = botao.closest("tr");
  const usuario = usuariosCarregados.get(lerId(linha.dataset.id));
  if (!usuario) return;

  if (botao.classList.contains("botao-editar")) {
    preencherEdicao(usuario);
  } else if (botao.classList.contains("botao-excluir")) {
    if (botao.dataset.confirmando) {
      excluir(botao, usuario);
    } else {
      pedirConfirmacao(botao, usuario);
    }
  }
}

tbody.addEventListener("click", cliqueNaTabela);
// ---------- início ----------

// Nome salvo no login (api.js já validou). Sem nome, fica o "visitante" do HTML.
// textContent de novo: o nome foi digitado por alguém e pode conter "<script>".
const nomeLogado = lerNomeLogado();
if (nomeLogado) {
  document.querySelector("#usuario-logado").textContent = nomeLogado;
}

formBusca.addEventListener("submit", buscarPorId);
formEditar.addEventListener("submit", salvarEdicao);
formEditar.addEventListener("reset", limparEdicao);
botaoAtualizar.addEventListener("click", carregarLista);

carregarLista();
