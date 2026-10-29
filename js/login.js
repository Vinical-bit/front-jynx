// =========================================================
// login.js — aba "Entrar" da tela de acesso (index.html)
// Rota: POST /login  →  corpo { email, senha }   (aqui é "senha", não "password")
// =========================================================
//
// MAPA DO ARQUIVO
//   validar() ......... confere e-mail e senha e devolve o primeiro problema (ou null)
//   entrar() .......... o "submit": valida → envia → interpreta a resposta → vai ao painel
//   aoCriarConta() .... depois do cadastro: preenche o e-mail e avisa que já pode entrar
//
// ORDEM
//   1. A pessoa clica em "Entrar" → o navegador dispara "submit" no form.
//   2. entrar() valida. Se algo estiver errado, mostra o erro e foca o campo.
//   3. Chama requisitar() (api.js) com POST /login.
//   4. O back responde 200 nos dois casos, mudando só o FORMATO do corpo:
//        objeto { menssagem, nome, ... } → login certo: guarda o nome e abre o painel
//        texto ("Não encontrado" / "usuario ou senha incorreta") → login errado
//   5. O botão volta ao normal no finally.
//
// Depende de api.js (requisitar, mostrarMensagem, salvarNomeLogado...).

// IIFE: este arquivo divide a página com cadastro.js, e os dois usam nomes
// como `mensagem` e `validar`. Ver a explicação completa no topo de acesso.js.
(function () {
  const formLogin = document.querySelector("#form-login");
  const campoEmail = document.querySelector("#login-email");
  const campoSenha = document.querySelector("#login-senha");
  const mensagem = document.querySelector("#login-mensagem");
  const botaoEntrar = document.querySelector("#botao-entrar");

  // Desliga só os balões nativos do navegador; as mensagens são nossas (ver cadastro.js).
  formLogin.noValidate = true;

  function validar(email, senha) {
    if (!email) return { campo: campoEmail, texto: "Digite seu e-mail." };
    if (!emailValido(email)) {
      return { campo: campoEmail, texto: "Esse e-mail parece incompleto. Use o formato voce@email.com." };
    }
    if (!senha) return { campo: campoSenha, texto: "Digite sua senha." };
    return null;
  }

  async function entrar(evento) {
    // Impede o envio "antigo" do form, que recarregaria a página (ver cadastro.js).
    evento.preventDefault();

    limparInvalidos(formLogin);
    // Mesmo tratamento do cadastro (trim + minúsculas) para o e-mail bater com o salvo.
    const email = campoEmail.value.trim().toLowerCase();
    const senha = campoSenha.value; // sem trim: espaço pode ser parte da senha

    const problema = validar(email, senha);
    if (problema) {
      mostrarMensagem(mensagem, problema.texto, "erro");
      marcarInvalido(problema.campo);
      return;
    }

    ocuparBotao(botaoEntrar, "Entrando…");
    limparMensagem(mensagem);

    try {
      // A senha vai no CORPO da requisição (POST), nunca na URL: URLs ficam
      // gravadas no histórico do navegador e nos logs dos servidores.
      const resposta = await requisitar("/login", {
        metodo: "POST",
        corpo: { email, senha },
        aoDemorar: () => mostrarMensagem(mensagem, AVISO_SERVIDOR_ACORDANDO, "info"),
      });

      // Como o back devolve 200 até no login errado, é o formato do corpo que
      // diz se deu certo: só o sucesso é um objeto com "menssagem" (com dois "s",
      // do jeito que está escrito no back).
      if (resposta && typeof resposta === "object" && resposta.menssagem) {
        campoSenha.value = ""; // a senha não precisa ficar na tela depois de usada
        // Sem nome no cadastro, o painel cumprimenta com "Olá, você".
        const nome = String(resposta.nome ?? "").trim() || "você";
        // Se o navegador bloqueia o localStorage, o painel não saberia que a
        // pessoa entrou e a mandaria de volta para cá. Melhor explicar agora.
        if (!salvarNomeLogado(nome) || !lerNomeLogado()) {
          mostrarMensagem(mensagem, "Seu navegador está bloqueando o armazenamento de dados deste site. Libere essa opção (ou saia da aba anônima) e tente de novo.", "erro");
          return;
        }
        // Direto para o painel, sem mensagem intermediária. replace: o "Voltar"
        // não cai de novo na tela de acesso.
        location.replace("painel.html");
      } else {
        // "Não encontrado" e "usuario ou senha incorreta" viram a MESMA frase:
        // assim a tela não confirma para um curioso quais e-mails têm conta.
        mostrarMensagem(mensagem, "E-mail ou senha incorretos. Confira e tente de novo.", "erro");
        campoSenha.value = "";
        campoSenha.focus();
      }
    } catch (erro) {
      mostrarMensagem(mensagem, mensagemDeErro(erro), "erro");
    } finally {
      liberarBotao(botaoEntrar);
    }
  }

  // cadastro.js avisa com o e-mail usado. A aba "Entrar" já está visível
  // (acesso.js reage antes), então dá para focar a senha: é o único campo
  // que falta. Nada de redirecionar por tempo: a pessoa entra quando quiser.
  function aoCriarConta(evento) {
    limparInvalidos(formLogin);
    campoEmail.value = evento.detail.email;
    campoSenha.value = "";
    mostrarMensagem(mensagem, "Conta criada! Agora é só entrar.", "sucesso");
    campoSenha.focus();
  }

  formLogin.addEventListener("submit", entrar);
  document.addEventListener(EVENTO_CONTA_CRIADA, aoCriarConta);
})();
