// =========================================================
// painel.js — painel de funcionários (painel.html)
// Rotas:
//   GET    /users      → lista todos
//   POST   /user       → corpo { name, phone, email, password }   (novo funcionário)
//   PUT    /user/:id   → corpo { name, phone, email, password }   (editar)
//   DELETE /user/:id
// =========================================================
//
// MAPA DO ARQUIVO
//   Acesso
//     conferirAcesso() ... sem nome salvo → volta para index.html (conveniência, NÃO segurança)
//     sair() ............. apaga o nome e volta para a tela de acesso
//   Listar
//     limparUsuario() ... copia SÓ os campos que usamos (id, name, phone, email)
//     criarLinha() ...... monta uma <tr> a partir do <template id="modelo-linha">
//     carregarLista() ... GET /users → desenha a tabela, o total e reaplica a busca
//   Buscar (no navegador, sem nova requisição)
//     normalizar() / combina() ... comparação sem acentos e sem diferenciar maiúsculas
//     aplicarBusca() ............. esconde as linhas que não combinam e escreve o resumo
//   Excluir (em duas etapas)
//     pedirConfirmacao() / desarmar() / cancelarConfirmacao() ... 1º clique arma o botão
//     excluir() ................................................. 2º clique: DELETE /user/:id
//   Formulário (um só, dois modos)
//     modoCriar() / modoEditar() ... trocam título, textos de ajuda e botões
//     abrirNovo() .................. botão "Novo funcionário": modo criar + foco no 1º campo
//     levarAoFormulario() .......... rola até o formulário (no celular ele fica embaixo) e foca
//     lerFormulario() / validar() .. leem e conferem os campos
//     salvar() ..................... o "submit": POST ou PUT → mensagem → carregarLista()
//   Cliques na tabela
//     cliqueNaTabela() ... um único "escutador" no tbody decide o que cada botão faz
//
// ORDEM
//   1. Ao abrir: conferirAcesso(). Sem nome salvo, sai daqui. Com nome, mostra a
//      página (o <body> começa com hidden), escreve "Olá, {nome}" e carrega a lista.
//   2. Digitar na busca → aplicarBusca() (só esconde/mostra linhas já carregadas).
//   3. "Novo funcionário" → abrirNovo(); "Editar" na linha → modoEditar().
//      "Cadastrar"/"Salvar" → salvar() → carregarLista().
//   4. "Excluir" → pedirConfirmacao(); de novo em até 5s → excluir() → carregarLista().
//   5. "Sair" → sair().
//
// Depende de api.js (requisitar, mostrarMensagem, ocuparBotao, lerNomeLogado...).

// IIFE: as variáveis deste arquivo ficam só aqui dentro, sem risco de colidir
// com api.js ou com outro script. Explicação completa no topo de acesso.js.
(function () {
  // ---------- acesso ----------

  // ATENÇÃO: isto é CONVENIÊNCIA, não segurança. A API não emite token, então
  // "ter entrado" é só ter um nome no localStorage, que qualquer pessoa pode
  // criar pelo DevTools. E as rotas da API respondem a qualquer um, com ou sem
  // esta página. O redirecionamento só evita que alguém caia aqui por engano.
  function conferirAcesso() {
    const nome = lerNomeLogado();
    if (!nome) location.replace("index.html");
    return nome;
  }

  const nomeLogado = conferirAcesso();
  if (!nomeLogado) return; // a página nem chega a aparecer

  // textContent: o nome foi digitado por alguém e pode conter "<script>".
  document.querySelector("#nome-logado").textContent = nomeLogado;
  document.body.hidden = false;

  // "Voltar" pode reabrir a página da memória (bfcache) depois de "Sair",
  // e "Sair" em outra aba muda o localStorage desta. Nos dois casos, conferimos de novo.
  window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) conferirAcesso();
  });
  window.addEventListener("storage", conferirAcesso);

  function sair() {
    apagarNomeLogado();
    location.replace("index.html");
  }

  // ---------- elementos ----------

  const tbody = document.querySelector("#lista-funcionarios");
  const modeloLinha = document.querySelector("#modelo-linha");
  const secaoLista = document.querySelector(".lista");
  const tabela = secaoLista.querySelector(".tabela");
  const tituloLista = document.querySelector("#titulo-lista");
  const totalFuncionarios = document.querySelector("#total-funcionarios");
  const mensagemLista = document.querySelector("#mensagem-lista");
  const botaoAtualizar = document.querySelector("#botao-atualizar");

  const campoBusca = document.querySelector("#busca-funcionario");
  const resumoBusca = document.querySelector("#resumo-busca");

  const cartaoForm = document.querySelector("#cartao-form");
  const tituloForm = document.querySelector("#titulo-form");
  const form = document.querySelector("#form-funcionario");
  const campoNome = document.querySelector("#campo-nome");
  const campoTelefone = document.querySelector("#campo-telefone");
  const campoEmail = document.querySelector("#campo-email");
  const campoSenha = document.querySelector("#campo-senha");
  const rotuloSenha = document.querySelector("#rotulo-senha");
  const ajudaSenha = document.querySelector("#ajuda-senha");
  const mensagemForm = document.querySelector("#mensagem-form");
  const botaoSalvar = document.querySelector("#botao-salvar");
  const botaoCancelar = document.querySelector("#botao-cancelar");

  // tabIndex = -1 deixa o título receber foco pelo JS (ver excluir()) sem
  // entrar na ordem do Tab, que continua só com links, campos e botões.
  tituloLista.tabIndex = -1;

  // Mensagens em português em vez dos balões do navegador (ver cadastro.js).
  form.noValidate = true;

  // Funcionários da última listagem, por id. "Editar" e a busca leem os dados
  // daqui em vez de "ler de volta" o texto da tabela.
  const funcionariosCarregados = new Map();

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
  // O id fica só no data-id: o sistema precisa dele, a pessoa não.
  function criarLinha(funcionario) {
    const linha = modeloLinha.content.cloneNode(true).querySelector("tr");
    linha.dataset.id = funcionario.id;
    linha.querySelector(".col-nome").textContent = funcionario.name;
    linha.querySelector(".col-telefone").textContent = funcionario.phone;
    linha.querySelector(".col-email").textContent = funcionario.email;

    // Para quem usa leitor de tela, vários botões "Editar" iguais não dizem
    // QUAL funcionário. O aria-label completa com o nome (e continua começando
    // com o texto visível, para quem usa comando de voz).
    linha.querySelector(".botao-editar").setAttribute("aria-label", `Editar ${funcionario.name}`);
    linha.querySelector(".botao-excluir").setAttribute("aria-label", `Excluir ${funcionario.name}`);
    return linha;
  }

  async function carregarLista() {
    // As linhas vão ser recriadas: uma exclusão "armada" perderia o seu botão.
    cancelarConfirmacao();
    ocuparBotao(botaoAtualizar, "Atualizando…");
    // aria-busy avisa o leitor de tela que a região está mudando, e o CSS usa o
    // mesmo atributo para esconder o "Nenhum funcionário" enquanto ainda carrega.
    secaoLista.setAttribute("aria-busy", "true");
    mostrarMensagem(mensagemLista, "Carregando funcionários…", "info");
    totalFuncionarios.textContent = "…";

    try {
      const resposta = await requisitar("/users", {
        aoDemorar: () => mostrarMensagem(mensagemLista, AVISO_SERVIDOR_ACORDANDO, "info"),
      });
      if (!Array.isArray(resposta)) throw new ErroApi("servidor");

      const funcionarios = resposta.map(limparUsuario).filter(Boolean);
      funcionariosCarregados.clear();
      funcionarios.forEach((funcionario) => funcionariosCarregados.set(funcionario.id, funcionario));

      // replaceChildren apaga as linhas antigas e coloca as novas de uma vez.
      // Lista vazia → tbody vazio → o CSS mostra "Nenhum funcionário cadastrado".
      tbody.replaceChildren(...funcionarios.map(criarLinha));
      totalFuncionarios.textContent = funcionarios.length;
      limparMensagem(mensagemLista);
      aplicarBusca(); // quem estava buscando continua vendo só o que buscou
      return true;
    } catch (erro) {
      totalFuncionarios.textContent = "–";
      mostrarMensagem(mensagemLista, `${mensagemDeErro(erro)} Use o botão "Atualizar lista".`, "erro");
      return false;
    } finally {
      secaoLista.removeAttribute("aria-busy");
      liberarBotao(botaoAtualizar);
    }
  }

  // ---------- buscar (no navegador) ----------

  // A lista inteira já está na memória, então filtrar aqui é instantâneo e
  // não gasta requisição (nem acorda o servidor). Tiramos os acentos para
  // "joao" achar "João".
  function normalizar(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  function combina(funcionario, termo) {
    const texto = normalizar(`${funcionario.name} ${funcionario.email} ${funcionario.phone}`);
    if (texto.includes(termo)) return true;
    // Telefone: "81999990000" deve achar "(81) 99999-0000". Só comparamos os
    // dígitos quando a busca parece um telefone; senão "ana2" acharia qualquer "2".
    const digitos = termo.replace(/\D/g, "");
    return /^[\d\s()+.-]+$/.test(termo) && digitos.length > 0
      && funcionario.phone.replace(/\D/g, "").includes(digitos);
  }

  function aplicarBusca() {
    const termo = normalizar(campoBusca.value);
    let visiveis = 0;

    tbody.querySelectorAll("tr").forEach((linha) => {
      const funcionario = funcionariosCarregados.get(lerId(linha.dataset.id));
      const mostrar = !termo || (funcionario && combina(funcionario, termo));
      linha.hidden = !mostrar;
      if (mostrar) visiveis++;
    });

    const total = funcionariosCarregados.size;
    // Sem nenhuma linha visível, o cabeçalho da tabela sozinho só confunde.
    tabela.hidden = Boolean(termo) && visiveis === 0;

    if (!termo || total === 0) {
      resumoBusca.textContent = "";
    } else if (visiveis === 0) {
      resumoBusca.textContent = `Nenhum funcionário encontrado para "${campoBusca.value.trim()}". Confira a grafia ou tente pelo telefone ou e-mail.`;
    } else {
      resumoBusca.textContent = `Mostrando ${visiveis} de ${total} ${total === 1 ? "funcionário" : "funcionários"}.`;
    }
  }

  // ---------- excluir (em duas etapas) ----------

  // Excluir não tem volta, então o primeiro clique só "arma" o botão. Usamos isso
  // em vez de window.confirm porque a confirmação fica no mesmo lugar do clique,
  // não trava a página e segue o visual do site.
  const TEMPO_CONFIRMAR_MS = 5000;

  // Só uma exclusão pode estar esperando confirmação por vez:
  // { botao, relogio, funcionario } enquanto espera, null quando não há nenhuma.
  let confirmacaoPendente = null;

  function pedirConfirmacao(botao, funcionario) {
    cancelarConfirmacao(); // se outro botão estava armado, ele volta ao normal

    botao.dataset.confirmando = "sim";
    botao.textContent = "Confirmar exclusão";
    botao.setAttribute("aria-label", `Confirmar exclusão de ${funcionario.name}`);
    // O texto do botão mudou, mas o leitor de tela nem sempre anuncia isso.
    // A mensagem (role="status") garante que a pessoa saiba o próximo passo.
    mostrarMensagem(mensagemLista, `Clique em "Confirmar exclusão" para apagar o cadastro de ${funcionario.name}. Isso não pode ser desfeito.`, "info");

    const relogio = setTimeout(cancelarConfirmacao, TEMPO_CONFIRMAR_MS);
    confirmacaoPendente = { botao, relogio, funcionario };
  }

  // Desarma a confirmação: desliga o relógio e devolve o botão ao normal.
  function desarmar() {
    const { botao, relogio, funcionario } = confirmacaoPendente;
    clearTimeout(relogio);
    delete botao.dataset.confirmando;
    botao.textContent = "Excluir";
    botao.setAttribute("aria-label", `Excluir ${funcionario.name}`);
    confirmacaoPendente = null;
  }

  // Desistência (passou o tempo, outro botão foi armado, a busca mudou ou a lista recarregou).
  function cancelarConfirmacao() {
    if (!confirmacaoPendente) return;
    desarmar();
    limparMensagem(mensagemLista);
  }

  async function excluir(botao, funcionario) {
    // Desarma ANTES de enviar: o relógio de 5s não pode mexer no botão no meio do DELETE.
    desarmar();
    ocuparBotao(botao, "Excluindo…");

    try {
      // encodeURIComponent garante que o id entre na URL só como um "pedaço" de
      // caminho. Aqui ele já é um número validado, mas o hábito evita surpresas.
      // A resposta ("Usuario com ID: 7, deletado...") não é mostrada: tem o id
      // e o vocabulário do banco. A frase de sucesso é nossa.
      await requisitar(`/user/${encodeURIComponent(funcionario.id)}`, {
        metodo: "DELETE",
        aoDemorar: () => mostrarMensagem(mensagemLista, AVISO_SERVIDOR_ACORDANDO, "info"),
      });

      // Quem estava sendo editado não existe mais: o formulário volta a "Novo".
      if (idEmEdicao === funcionario.id && !salvando) modoCriar();

      // Recarregamos do servidor (em vez de só apagar a linha) para a tabela
      // mostrar a verdade do banco, inclusive mudanças feitas por outras pessoas.
      const recarregou = await carregarLista();
      const texto = `Cadastro de ${funcionario.name} excluído.`;
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

  // ---------- formulário: um só, dois modos ----------

  // null = modo "Novo funcionário"; um número = id de quem está sendo editado.
  let idEmEdicao = null;
  // Durante o envio, trocar de modo mudaria o texto do botão ocupado, e o
  // liberarBotao() depois devolveria o texto antigo. Então esperamos acabar.
  let salvando = false;

  const AJUDA_CRIAR = "O funcionário vai usar este e-mail e esta senha para entrar no sistema.";
  // O back SEMPRE troca a senha no PUT (não dá para salvar sem ela). Melhor
  // dizer isso com todas as letras do que deixar a pessoa descobrir no erro.
  const AJUDA_EDITAR = "Digite a nova senha deste funcionário. Ela é obrigatória para salvar qualquer alteração e substitui a senha atual.";

  function modoCriar() {
    idEmEdicao = null;
    form.reset();
    limparInvalidos(form);
    limparMensagem(mensagemForm);
    tituloForm.textContent = "Novo funcionário";
    rotuloSenha.textContent = "Senha de acesso";
    ajudaSenha.textContent = AJUDA_CRIAR;
    botaoSalvar.textContent = "Cadastrar funcionário";
    botaoCancelar.hidden = true;
  }

  // A senha fica em branco de propósito: nós nunca temos a senha (só o back
  // tem o hash), então a pessoa precisa digitar uma nova.
  function modoEditar(funcionario) {
    modoCriar(); // começa limpo, sem restos de um envio anterior
    idEmEdicao = funcionario.id;
    campoNome.value = funcionario.name;
    campoTelefone.value = funcionario.phone;
    campoEmail.value = funcionario.email;
    tituloForm.textContent = "Editar funcionário";
    rotuloSenha.textContent = "Nova senha de acesso";
    ajudaSenha.textContent = AJUDA_EDITAR;
    botaoSalvar.textContent = "Salvar alterações";
    botaoCancelar.hidden = false;
    // O foco vai para o campo Nome; esta mensagem diz QUEM está sendo editado.
    mostrarMensagem(mensagemForm, `Editando o cadastro de ${funcionario.name}.`, "info");
    levarAoFormulario();
  }

  function abrirNovo() {
    if (salvando) return;
    modoCriar();
    levarAoFormulario();
  }

  // No computador o formulário está sempre à vista (coluna fixa ao lado).
  // No celular ele fica depois da lista, então rolamos até ele, mas só se
  // ele não estiver inteiro na tela, para o computador não dar "pulos".
  function levarAoFormulario() {
    const caixa = cartaoForm.getBoundingClientRect();
    if (caixa.top < 0 || caixa.bottom > window.innerHeight) {
      const semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      cartaoForm.scrollIntoView({ behavior: semAnimacao ? "auto" : "smooth", block: "start" });
    }
    // preventScroll: o focus() sozinho também rolaria, de um jeito brusco.
    campoNome.focus({ preventScroll: true });
  }

  function lerFormulario() {
    return {
      name: campoNome.value.trim().replace(/\s+/g, " "),
      phone: campoTelefone.value.trim(),
      email: campoEmail.value.trim().toLowerCase(),
      password: campoSenha.value, // sem trim, como no cadastro
    };
  }

  function validar(dados) {
    if (!dados.name) return { campo: campoNome, texto: "Digite o nome do funcionário." };
    if (!dados.phone) return { campo: campoTelefone, texto: "Digite o telefone do funcionário." };
    if (!telefoneValido(dados.phone)) {
      return { campo: campoTelefone, texto: "Esse telefone parece incompleto. Digite o número com DDD, como (81) 99999-0000." };
    }
    if (!dados.email) return { campo: campoEmail, texto: "Digite o e-mail do funcionário." };
    if (!emailValido(dados.email)) {
      return { campo: campoEmail, texto: "Esse e-mail parece incompleto. Use o formato nome@empresa.com." };
    }
    if (!dados.password.trim()) {
      const texto = idEmEdicao === null
        ? "Crie uma senha de acesso para o funcionário."
        : "Digite a nova senha deste funcionário. Sem ela não é possível salvar.";
      return { campo: campoSenha, texto };
    }
    if (dados.password.length < SENHA_MINIMA) {
      return { campo: campoSenha, texto: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
    }
    return null;
  }

  async function salvar(evento) {
    evento.preventDefault(); // sem recarregar a página (ver cadastro.js)

    limparInvalidos(form);
    const dados = lerFormulario();
    const problema = validar(dados);
    if (problema) {
      mostrarMensagem(mensagemForm, problema.texto, "erro");
      marcarInvalido(problema.campo);
      return;
    }

    // Guardamos o modo AGORA: é ele que vale para este envio.
    const id = idEmEdicao;
    const editando = id !== null;

    salvando = true;
    ocuparBotao(botaoSalvar, editando ? "Salvando…" : "Cadastrando…");
    limparMensagem(mensagemForm);

    let deuCerto = false;
    try {
      // Criar: POST /user. Editar: o id vai na URL e o resto no corpo.
      // Nos dois casos a resposta é um texto do back que não mostramos.
      await requisitar(editando ? `/user/${encodeURIComponent(id)}` : "/user", {
        metodo: editando ? "PUT" : "POST",
        corpo: dados,
        aoDemorar: () => mostrarMensagem(mensagemForm, AVISO_SERVIDOR_ACORDANDO, "info"),
      });
      deuCerto = true;
    } catch (erro) {
      // O motivo mais comum de erro do servidor é telefone ou e-mail repetido
      // (o banco não aceita dois iguais). Damos a dica sem a mensagem técnica.
      const texto = erro.tipo !== "servidor"
        ? mensagemDeErro(erro)
        : editando
          ? "Não foi possível salvar. Talvez esse telefone ou e-mail já seja de outro funcionário, ou este cadastro tenha sido excluído. Atualize a lista e tente de novo."
          : "Não foi possível cadastrar. Talvez esse telefone ou e-mail já seja de outro funcionário. Confira e tente de novo.";
      mostrarMensagem(mensagemForm, texto, "erro");
    } finally {
      salvando = false;
      liberarBotao(botaoSalvar);
    }

    if (!deuCerto) return;
    // Depois de liberar o botão, para o texto dele ser o do modo novo.
    modoCriar(); // também apaga a senha da tela
    mostrarMensagem(
      mensagemForm,
      editando ? `Alterações salvas: ${dados.name}.` : `Cadastro salvo: ${dados.name}. Você já pode cadastrar outro funcionário.`,
      "sucesso",
    );
    carregarLista(); // a tabela passa a mostrar os dados novos
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
    const funcionario = funcionariosCarregados.get(lerId(linha.dataset.id));
    if (!funcionario) return;

    if (botao.classList.contains("botao-editar")) {
      if (!salvando) modoEditar(funcionario);
    } else if (botao.classList.contains("botao-excluir")) {
      if (botao.dataset.confirmando) {
        excluir(botao, funcionario);
      } else {
        pedirConfirmacao(botao, funcionario);
      }
    }
  }

  // ---------- início ----------

  tbody.addEventListener("click", cliqueNaTabela);
  campoBusca.addEventListener("input", () => {
    cancelarConfirmacao(); // a linha armada pode sumir da vista
    aplicarBusca();
  });
  form.addEventListener("submit", salvar);
  botaoCancelar.addEventListener("click", abrirNovo);
  document.querySelector("#botao-novo").addEventListener("click", abrirNovo);
  document.querySelector("#botao-primeiro").addEventListener("click", abrirNovo);
  document.querySelector("#botao-sair").addEventListener("click", sair);
  botaoAtualizar.addEventListener("click", carregarLista);

  carregarLista();
})();
