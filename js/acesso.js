// =========================================================
// acesso.js — tela de acesso (index.html): as abas "Entrar" e "Criar conta"
// =========================================================
//
// MAPA DO ARQUIVO
//   conferirSeJaEntrou() ... quem já entrou vai direto para o painel
//   ativarAba() ............ mostra um painel, esconde o outro e ajusta a URL
//   abaDoEndereco() ........ #criar-conta abre "Criar conta"; o resto abre "Entrar"
//   navegarComTeclado() .... setas, Home e End entre as abas
//
// ORDEM
//   1. Se já existe um nome salvo, vai para painel.html e para por aqui.
//   2. Abre a aba que a URL pede (index.html#criar-conta → "Criar conta").
//   3. Liga os cliques, as setas, a troca de #endereço e o aviso de conta criada.
//
// Depende de api.js (lerNomeLogado, EVENTO_CONTA_CRIADA).

// POR QUE TUDO ESTÁ DENTRO DE (function () { ... })();
// Scripts comuns dividem UM escopo global. Se login.js e cadastro.js declaram
// os dois `const mensagem` no topo, o navegador dá SyntaxError e o segundo
// arquivo nem roda; com `function validar`, o segundo apaga o primeiro sem
// avisar. A função autoexecutável (IIFE) cria um escopo só deste arquivo:
// o que é declarado aqui dentro não vaza nem colide com os outros.
(function () {
  // Conveniência, não segurança: é só um nome no localStorage (ver api.js).
  function conferirSeJaEntrou() {
    if (!lerNomeLogado()) return false;
    // replace (e não href) para a tela de acesso não ficar no histórico:
    // o "Voltar" do navegador não cai de novo aqui só para ser redirecionado.
    location.replace("painel.html");
    return true;
  }

  if (conferirSeJaEntrou()) return;

  // O "Voltar" pode reabrir esta página da memória do navegador (bfcache),
  // sem rodar o script de novo. O pageshow avisa quando isso acontece.
  window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) conferirSeJaEntrou();
  });

  const listaAbas = document.querySelector('[role="tablist"]');
  const abaEntrar = document.querySelector("#aba-entrar");
  const abaCriarConta = document.querySelector("#aba-criar-conta");
  const abas = [abaEntrar, abaCriarConta];

  function painelDa(aba) {
    return document.getElementById(aba.getAttribute("aria-controls"));
  }

  // Padrão de abas acessíveis: só a aba ativa fica na ordem do Tab
  // (tabindex 0); as outras são alcançadas pelas setas (tabindex -1).
  function ativarAba(aba, { focarAba = false, focarCampo = false } = {}) {
    abas.forEach((outra) => {
      const ativa = outra === aba;
      outra.setAttribute("aria-selected", String(ativa));
      outra.tabIndex = ativa ? 0 : -1;
      painelDa(outra).hidden = !ativa;
    });

    // A URL acompanha a aba, para "recarregar" ou compartilhar o link abrir
    // no mesmo lugar. replaceState não cria uma entrada nova no histórico.
    const hash = aba === abaCriarConta ? "#criar-conta" : "";
    if (location.hash !== hash) {
      history.replaceState(null, "", hash || location.pathname + location.search);
    }

    if (focarAba) aba.focus();
    if (focarCampo) painelDa(aba).querySelector("input").focus();
  }

  function abaDoEndereco() {
    return location.hash === "#criar-conta" ? abaCriarConta : abaEntrar;
  }

  function navegarComTeclado(evento) {
    const atual = abas.indexOf(document.activeElement);
    if (atual === -1) return;

    const destinos = {
      ArrowRight: (atual + 1) % abas.length,
      ArrowLeft: (atual - 1 + abas.length) % abas.length,
      Home: 0,
      End: abas.length - 1,
    };
    if (!(evento.key in destinos)) return;

    evento.preventDefault(); // Home/End rolariam a página
    ativarAba(abas[destinos[evento.key]], { focarAba: true });
  }

  abas.forEach((aba) => aba.addEventListener("click", () => ativarAba(aba)));
  listaAbas.addEventListener("keydown", navegarComTeclado);

  // Os links "Criar conta" / "Entrar" do rodapé de cada aba só mudam o #.
  // Quem clicou num link quer preencher, então o foco vai para o 1º campo.
  window.addEventListener("hashchange", () => ativarAba(abaDoEndereco(), { focarCampo: true }));

  // Conta criada: volta para "Entrar". O foco fica por conta do login.js,
  // que roda DEPOIS deste arquivo (ordem dos <script>) e já acha a aba visível.
  document.addEventListener(EVENTO_CONTA_CRIADA, () => ativarAba(abaEntrar));

  ativarAba(abaDoEndereco());
})();
