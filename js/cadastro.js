// =========================================================
// cadastro.js — aba "Criar conta" da tela de acesso (index.html)
// Rota: POST /user  →  corpo { name, phone, email, password }
// =========================================================
//
// MAPA DO ARQUIVO
//   lerFormulario() ... pega os valores dos campos já limpos (trim)
//   validar() ......... confere os dados e devolve o primeiro problema (ou null)
//   cadastrar() ....... o "submit": valida → envia → avisa que a conta foi criada
//
// ORDEM
//   1. A pessoa clica em "Criar conta" → o navegador dispara "submit" no form.
//   2. cadastrar() valida. Se algo estiver errado, mostra o erro e foca o campo.
//   3. Se estiver tudo certo, chama requisitar() (api.js) com POST /user.
//   4. Sucesso: limpa o form e dispara EVENTO_CONTA_CRIADA. acesso.js troca para
//      a aba "Entrar" e login.js preenche o e-mail. Erro: mostra uma mensagem.
//      Nos dois casos o botão volta ao normal.
//
// Depende de api.js (requisitar, mostrarMensagem, ocuparBotao...).

// IIFE: este arquivo divide a página com login.js, e os dois usam nomes
// como `mensagem` e `validar`. Ver a explicação completa no topo de acesso.js.
(function () {
  const formCadastro = document.querySelector("#form-cadastro");
  const campoNome = document.querySelector("#cadastro-nome");
  const campoTelefone = document.querySelector("#cadastro-telefone");
  const campoEmail = document.querySelector("#cadastro-email");
  const campoSenha = document.querySelector("#cadastro-senha");
  const mensagem = document.querySelector("#cadastro-mensagem");
  const botaoCadastrar = document.querySelector("#botao-cadastrar");

  // Os inputs têm "required" e type="email". Isso é ótimo SEM JavaScript, mas com
  // JS preferimos nossas mensagens (em português, num lugar fixo, lidas pelo
  // leitor de tela). noValidate desliga só os balões do navegador.
  formCadastro.noValidate = true;

  function lerFormulario() {
    return {
      // Espaços repetidos no meio do nome viram um só ("Ana   Paula" → "Ana Paula").
      name: campoNome.value.trim().replace(/\s+/g, " "),
      phone: campoTelefone.value.trim(),
      email: campoEmail.value.trim().toLowerCase(),
      // A senha NÃO leva trim: um espaço pode ser parte da senha de propósito.
      password: campoSenha.value,
    };
  }

  // Devolve { campo, texto } do PRIMEIRO problema, ou null se está tudo certo.
  // Só o primeiro, para a pessoa corrigir uma coisa de cada vez.
  function validar(dados) {
    if (!dados.name) return { campo: campoNome, texto: "Digite seu nome." };
    if (!dados.phone) return { campo: campoTelefone, texto: "Digite seu telefone." };
    if (!telefoneValido(dados.phone)) {
      return { campo: campoTelefone, texto: "Esse telefone parece incompleto. Digite o número com DDD, como (81) 99999-0000." };
    }
    if (!dados.email) return { campo: campoEmail, texto: "Digite seu e-mail." };
    if (!emailValido(dados.email)) {
      return { campo: campoEmail, texto: "Esse e-mail parece incompleto. Use o formato voce@email.com." };
    }
    if (!dados.password.trim()) return { campo: campoSenha, texto: "Crie uma senha." };
    if (dados.password.length < SENHA_MINIMA) {
      return { campo: campoSenha, texto: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
    }
    return null;
  }

  async function cadastrar(evento) {
    // Sem isso o navegador faria o envio "antigo" do formulário: recarregaria a
    // página e perderíamos o controle (e a mensagem) antes do fetch terminar.
    evento.preventDefault();

    limparInvalidos(formCadastro);
    const dados = lerFormulario();
    const problema = validar(dados);
    if (problema) {
      mostrarMensagem(mensagem, problema.texto, "erro");
      marcarInvalido(problema.campo);
      return;
    }

    ocuparBotao(botaoCadastrar, "Criando conta…");
    limparMensagem(mensagem);

    try {
      // A resposta é um texto ("O Usuario: Ana foi cadastrado...") que não
      // mostramos: a frase de sucesso é nossa, escrita na aba "Entrar".
      await requisitar("/user", {
        metodo: "POST",
        corpo: dados,
        aoDemorar: () => mostrarMensagem(mensagem, AVISO_SERVIDOR_ACORDANDO, "info"),
      });
      formCadastro.reset();
      limparMensagem(mensagem);
      // CustomEvent leva o e-mail junto ("detail") para quem estiver ouvindo.
      document.dispatchEvent(new CustomEvent(EVENTO_CONTA_CRIADA, { detail: { email: dados.email } }));
    } catch (erro) {
      // No cadastro, o motivo mais comum de erro do servidor é telefone ou e-mail
      // repetido (o banco não aceita dois iguais). O back não diz isso de forma
      // amigável, então damos a dica sem mostrar a mensagem técnica dele.
      const texto = erro.tipo === "servidor"
        ? "Não foi possível criar a conta. Talvez esse telefone ou e-mail já esteja cadastrado. Confira e tente de novo."
        : mensagemDeErro(erro);
      mostrarMensagem(mensagem, texto, "erro");
    } finally {
      // finally roda tanto no sucesso quanto no erro: assim o botão nunca fica
      // preso em "Criando conta…" se algo der errado no meio do caminho.
      liberarBotao(botaoCadastrar);
    }
  }

  formCadastro.addEventListener("submit", cadastrar);
})();
