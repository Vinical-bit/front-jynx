// =========================================================
// cadastro.js — página "Criar conta" (cadastro.html)
// Rota: POST /user  →  corpo { name, phone, email, password }
// =========================================================
//
// MAPA DO ARQUIVO
//   lerFormulario() ... pega os valores dos campos já limpos (trim)
//   validar() ......... confere os dados e devolve o primeiro problema (ou null)
//   cadastrar() ....... o "submit": valida → envia → mostra a resposta → redireciona
//   irParaLogin() ..... mostra o sucesso com um link "Ir agora" e agenda a ida para index.html
//
// ORDEM
//   1. A pessoa clica em "Criar conta" → o navegador dispara "submit" no form.
//   2. cadastrar() valida. Se algo estiver errado, mostra o erro e foca o campo.
//   3. Se estiver tudo certo, chama requisitar() (api.js) com POST /user.
//   4. Sucesso: limpa o form e leva para o login depois de alguns segundos.
//      Erro: mostra uma mensagem simples. Nos dois casos o botão volta ao normal.
//
// Depende de api.js (requisitar, mostrarMensagem, ocuparBotao...).

const formCadastro = document.querySelector("#form-cadastro");
const campoNome = document.querySelector("#name");
const campoTelefone = document.querySelector("#phone");
const campoEmail = document.querySelector("#email");
const campoSenha = document.querySelector("#password");
const mensagem = document.querySelector("#mensagem");
const botaoCadastrar = document.querySelector("#botao-cadastrar");

// Tempo para ler a mensagem de sucesso antes de ir para o login.
const ESPERA_REDIRECIONAR_MS = 6000;

// Os inputs têm "required" e type="email". Isso é ótimo SEM JavaScript, mas com
// JS preferimos nossas mensagens (em português, num lugar fixo, lidas pelo
// leitor de tela). noValidate desliga só os balões do navegador.
formCadastro.noValidate = true;

function lerFormulario() {
  return {
    name: campoNome.value.trim(),
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
  if (!dados.email) return { campo: campoEmail, texto: "Digite seu e-mail." };
  if (!emailValido(dados.email)) {
    return { campo: campoEmail, texto: "Esse e-mail parece incompleto. Use o formato voce@email.com." };
  }
  if (!dados.password.trim()) return { campo: campoSenha, texto: "Crie uma senha." };
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
    const resposta = await requisitar("/user", {
      metodo: "POST",
      corpo: dados,
      aoDemorar: () => mostrarMensagem(mensagem, AVISO_SERVIDOR_ACORDANDO, "info"),
    });
    formCadastro.reset();
    // O back responde um texto como "O Usuario: Ana foi cadastrado com sucesso!".
    // Se por algum motivo vier vazio, usamos uma frase nossa.
    irParaLogin(typeof resposta === "string" && resposta ? resposta : "Conta criada com sucesso!");
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

// O link "Ir agora" é criado com createElement (e não innerHTML) pelo mesmo
// motivo de sempre: o texto do servidor contém o nome que a pessoa digitou.
function irParaLogin(textoSucesso) {
  mostrarMensagem(mensagem, `${textoSucesso} Em instantes você vai para a página de entrar. `, "sucesso");

  const link = document.createElement("a");
  link.href = "index.html";
  link.textContent = "Ir agora";
  mensagem.append(link);

  setTimeout(() => {
    location.href = "index.html";
  }, ESPERA_REDIRECIONAR_MS);
}

formCadastro.addEventListener("submit", cadastrar);
