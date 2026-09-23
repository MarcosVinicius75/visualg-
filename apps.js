(function(){
'use strict';

// ---------------------------------------------------------------- Mode Portugol CodeMirror
CodeMirror.defineSimpleMode('portugol', {
  start: [
    { regex: /\/\/.*/, token: 'comment' },
    { regex: /\{[^}]*\}/, token: 'comment' },
    { regex: /"(?:[^"\\]|\\.)*"?/, token: 'string' },
    { regex: /'(?:[^'\\]|\\.)*'?/, token: 'string' },
    { regex: /\b\d+\.?\d*\b/, token: 'number' },
    { regex: /\b(algoritmo|var|const|inicio|fimalgoritmo|se|entao|senao|fimse|enquanto|faca|fimenquanto|para|ate|passo|fimpara|repita|escolha|caso|outrocaso|fimescolha|funcao|fimfuncao|procedimento|fimprocedimento|retorne|leia|escreva|escreval|verdadeiro|falso|e|ou|nao|div|mod|de)\b/i, token: 'keyword' },
    { regex: /\b(inteiro|real|caractere|literal|logico|vetor)\b/i, token: 'type-esp' },
    { regex: /\b(abs|arred|trunc|quad|raizq|exp|logn|log10|pi|sen|cos|tan|grauprad|radpgrau|rand|randi|compr|copia|pos|maiusc|minusc|asc|carac|numpc)(?=\s*\()/i, token: 'builtin' },
    { regex: /<-|<=|>=|<>|[=+\-*/^<>]/, token: 'operator' },
    { regex: /[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*/, token: null },
  ],
  meta: { lineComment: '//' }
});

const PALAVRAS = ['algoritmo','var','const','inicio','fimalgoritmo','se','entao','senao','fimse',
  'enquanto','faca','fimenquanto','para','ate','passo','fimpara','repita','escolha','caso',
  'outrocaso','fimescolha','funcao','fimfuncao','procedimento','fimprocedimento','retorne',
  'leia','escreva','escreval','verdadeiro','falso','e','ou','nao','div','mod','vetor','de'];
const TIPOS = ['inteiro','real','caractere','logico'];
const FUNCOES_LIB = ['abs','arred','trunc','quad','raizq','exp','logn','log10','pi','sen','cos','tan',
  'grauprad','radpgrau','rand','randi','compr','copia','pos','maiusc','minusc','asc','carac','numpc'];

const SNIPPETS = [
  { nome:'se/fimse', texto:'se ${1:condicao} entao\n\t${0}\nfimse' },
  { nome:'se/senao/fimse', texto:'se ${1:condicao} entao\n\t${2}\nsenao\n\t${0}\nfimse' },
  { nome:'enquanto/fimenquanto', texto:'enquanto ${1:condicao} faca\n\t${0}\nfimenquanto' },
  { nome:'para/fimpara', texto:'para ${1:i} de ${2:1} ate ${3:10} faca\n\t${0}\nfimpara' },
  { nome:'repita/ate', texto:'repita\n\t${0}\nate ${1:condicao}' },
  { nome:'escolha/fimescolha', texto:'escolha ${1:variavel}\n\tcaso ${2:valor}\n\t\t${0}\nfimescolha' },
  { nome:'funcao', texto:'funcao ${1:nome}(${2:parametro}: ${3:inteiro}): ${4:inteiro}\ninicio\n\t${0}\n\tretorne ${5:0}\nfimfuncao' },
  { nome:'procedimento', texto:'procedimento ${1:nome}(${2:parametro}: ${3:inteiro})\ninicio\n\t${0}\nfimprocedimento' },
  { nome:'algoritmo (modelo)', texto:'algoritmo "${1:Nome do algoritmo}"\nvar\n\t${2}\ninicio\n\t${0}\nfimalgoritmo' },
];

const AJUDA = {
  se: { sintaxe:'se <condição> entao\n   <comandos>\nsenao\n   <comandos>\nfimse', desc:'Executa um bloco de comandos apenas quando a condição é verdadeira; "senao" é opcional.', exemplo:'Ex.: se idade >= 18 entao escreval("Maior") fimse' },
  enquanto: { sintaxe:'enquanto <condição> faca\n   <comandos>\nfimenquanto', desc:'Repete o bloco enquanto a condição permanecer verdadeira. Testada antes de cada repetição.', exemplo:'Ex.: enquanto x < 10 faca x <- x + 1 fimenquanto' },
  para: { sintaxe:'para <var> de <inicio> ate <fim> [passo <p>] faca\n   <comandos>\nfimpara', desc:'Repete o bloco variando <var> de <inicio> até <fim>, de 1 em 1 (ou pelo valor de "passo").', exemplo:'Ex.: para i de 1 ate 10 faca escreva(i) fimpara' },
  repita: { sintaxe:'repita\n   <comandos>\nate <condição>', desc:'Repete o bloco pelo menos uma vez, até que a condição se torne verdadeira (testada no fim).', exemplo:'Ex.: repita x <- x + 1 ate x >= 5' },
  escolha: { sintaxe:'escolha <expressão>\n   caso <valor1>, <valor2>\n      <comandos>\n   outrocaso\n      <comandos>\nfimescolha', desc:'Compara o valor da expressão com cada "caso" e executa o bloco correspondente.', exemplo:'Ex.: escolha opcao / caso 1 / escreval("um") / fimescolha' },
  funcao: { sintaxe:'funcao <nome>(<param>: <tipo>): <tipoRetorno>\n   <declarações>\ninicio\n   <comandos>\n   retorne <valor>\nfimfuncao', desc:'Bloco reutilizável que devolve um valor através de "retorne".', exemplo:'' },
  procedimento: { sintaxe:'procedimento <nome>(<param>: <tipo>)\ninicio\n   <comandos>\nfimprocedimento', desc:'Bloco reutilizável que não devolve valor.', exemplo:'' },
  leia: { sintaxe:'leia(<variavel1>, <variavel2>, ...)', desc:'Lê um valor digitado pelo usuário e guarda na variável indicada.', exemplo:'Ex.: leia(idade)' },
  escreva: { sintaxe:'escreva(<expr1>, <expr2>, ...)', desc:'Escreve na tela sem pular linha ao final.', exemplo:'Ex.: escreva("Idade: ", idade)' },
  escreval: { sintaxe:'escreval(<expr1>, <expr2>, ...)', desc:'Escreve na tela e pula uma linha ao final.', exemplo:'Ex.: escreval("Ola, mundo!")' },
  vetor: { sintaxe:'<nome>: vetor[<ini>..<fim>] de <tipo>', desc:'Declara uma variável composta (array) indexada de <ini> até <fim>.', exemplo:'Ex.: notas: vetor[1..10] de real' },
  inteiro: { sintaxe:'<nome>: inteiro', desc:'Tipo numérico sem casas decimais.', exemplo:'' },
  real: { sintaxe:'<nome>: real', desc:'Tipo numérico com casas decimais.', exemplo:'' },
  caractere: { sintaxe:'<nome>: caractere', desc:'Tipo texto (cadeia de caracteres).', exemplo:'' },
  logico: { sintaxe:'<nome>: logico', desc:'Tipo lógico: verdadeiro ou falso.', exemplo:'' },
  retorne: { sintaxe:'retorne <valor>', desc:'Encerra uma função devolvendo um valor ao ponto onde ela foi chamada.', exemplo:'' },
};

const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

const TEMPLATE_PADRAO =
'algoritmo "Primeiro Programa"\n' +
'var\n' +
'   nome: caractere\n' +
'inicio\n' +
'   escreval("Digite seu nome: ")\n' +
'   leia(nome)\n' +
'   escreva("Ola, ", nome, "!")\n' +
'fimalgoritmo\n';

const State = {
  tabs: [],
  activeId: null,
  nextId: 1,
  zoom: 14,
  exec: null,
  varsPrev: new Map(),
  lintTimer: null,
};

let cm;

function initEditor() {
  cm = CodeMirror.fromTextArea($('#editor-textarea'), {
    mode: 'portugol',
    theme: 'portugolplus',
    lineNumbers: true,
    indentUnit: 3,
    tabSize: 3,
    indentWithTabs: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    gutters: ['CodeMirror-linenumbers', 'gutter-breakpoints', 'gutter-problems'],
    extraKeys: {
      'Ctrl-Space': 'autocomplete',
      'Tab': (cmi) => { if (cmi.somethingSelected()) cmi.indentSelection('add'); else cmi.replaceSelection('   ', 'end'); },
    },
  });
  cm.getWrapperElement().style.fontSize = State.zoom + 'px';

  cm.on('gutterClick', (cmi, line, gutterId) => {
    if (gutterId === 'gutter-breakpoints') toggleBreakpointAtLine(line);
  });
  cm.on('cursorActivity', updateStatusPos);
  cm.on('change', () => { markDirtyActive(); scheduleLint(); scheduleAutoSave(); });
}

function novaAba(nome, conteudo, activate) {
  const doc = new CodeMirror.Doc(conteudo, 'portugol');
  const tab = { id: State.nextId++, name: nome, doc, bpHandles: new Set(), dirty: false };
  State.tabs.push(tab);
  if (activate !== false) ativarAba(tab.id);
  renderTabs();
  return tab;
}
function abaAtiva() { return State.tabs.find(t => t.id === State.activeId); }
function ativarAba(id) {
  if (State.exec) pararExecucao(true);
  State.activeId = id;
  const tab = abaAtiva();
  cm.swapDoc(tab.doc);
  cm.focus();
  renderTabs();
  renderBreakpointsPanel();
  scheduleLint(true);
  updateStatusPos();
}
function fecharAba(id) {
  const idx = State.tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  State.tabs.splice(idx, 1);
  if (State.tabs.length === 0) { novaAba('sem-titulo-1.alg', TEMPLATE_PADRAO); return; }
  if (State.activeId === id) ativarAba(State.tabs[Math.max(0, idx - 1)].id);
  renderTabs();
}
function markDirtyActive() {
  const tab = abaAtiva(); if (!tab) return;
  if (!tab.dirty) { tab.dirty = true; renderTabs(); }
}
function renderTabs() {
  const tabbar = $('#tabbar'); tabbar.innerHTML = '';
  const flist = $('#file-list'); flist.innerHTML = '';
  State.tabs.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === State.activeId ? ' active' : '');
    el.innerHTML = `<span class="dirty"></span><span>${escapeHtml(t.name)}</span><span class="tclose">✕</span>`;
    el.addEventListener('click', (e) => { if (e.target.classList.contains('tclose')) fecharAba(t.id); else ativarAba(t.id); });
    tabbar.appendChild(el);

    const fi = document.createElement('div');
    fi.className = 'file-item' + (t.id === State.activeId ? ' active' : '');
    fi.innerHTML = `<span class="dot"></span><span class="fname">${escapeHtml(t.name)}</span><span class="fclose">✕</span>`;
    fi.addEventListener('click', (e) => { if (e.target.classList.contains('fclose')) fecharAba(t.id); else ativarAba(t.id); });
    flist.appendChild(fi);
  });
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function scheduleAutoSave() { clearTimeout(State._saveTimer); State._saveTimer = setTimeout(salvarEstadoLocal, 600); }
function salvarEstadoLocal() {
  try {
    const dump = {
      tabs: State.tabs.map(t => ({ name: t.name, content: t.doc.getValue(), bps: Array.from(t.bpHandles).map(h => t.doc.getLineNumber(h)).filter(n => n !== null) })),
      activeIndex: State.tabs.findIndex(t => t.id === State.activeId),
      theme: document.body.dataset.theme,
      zoom: State.zoom,
    };
    localStorage.setItem('visualgplus_v1', JSON.stringify(dump));
  } catch (e) {}
}
function carregarEstadoLocal() {
  try {
    const raw = localStorage.getItem('visualgplus_v1');
    if (!raw) return false;
    const dump = JSON.parse(raw);
    if (dump.theme) setTheme(dump.theme);
    if (dump.zoom) { State.zoom = dump.zoom; }
    if (Array.isArray(dump.tabs) && dump.tabs.length) {
      dump.tabs.forEach((t) => {
        const tab = novaAba(t.name, t.content, false);
        (t.bps || []).forEach(ln => tab.bpHandles.add(tab.doc.getLineHandle(ln)));
      });
      const idx = dump.activeIndex >= 0 ? dump.activeIndex : 0;
      ativarAba(State.tabs[idx] ? State.tabs[idx].id : State.tabs[0].id);
      return true;
    }
  } catch (e) {}
  return false;
}

function cmdNovo() { novaAba(`sem-titulo-${State.nextId}.alg`, TEMPLATE_PADRAO); }
function cmdAbrir() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.alg,.txt,.por';
  input.onchange = () => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => novaAba(file.name, reader.result);
    reader.readAsText(file, 'utf-8');
  };
  input.click();
}
function cmdSalvar(comoNovo) {
  const tab = abaAtiva(); if (!tab) return;
  let nome = tab.name;
  if (comoNovo || !/\.alg$/i.test(nome)) {
    const sugestao = nome.replace(/\.(alg|txt|por)$/i, '') + '.alg';
    const resp = prompt('Salvar como (nome do arquivo):', sugestao);
    if (!resp) return;
    nome = resp;
  }
  const blob = new Blob([tab.doc.getValue()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
  tab.name = nome; tab.dirty = false; renderTabs();
  showToast(`Salvo como "${nome}"`);
}

function scheduleLint(immediate) {
  clearTimeout(State.lintTimer);
  State.lintTimer = setTimeout(lintAgora, immediate ? 0 : 450);
}
function coletarIdentificadoresDeclarados(ast) {
  const nomes = new Set();
  const addDecls = (decls) => {
    (decls.vars || []).forEach(v => nomes.add(v.nome.toLowerCase()));
    (decls.consts || []).forEach(c => nomes.add(c.nome.toLowerCase()));
    (decls.subs || []).forEach(s => { nomes.add(s.nome.toLowerCase()); s.params.forEach(p => nomes.add(p.nome.toLowerCase())); addDecls(s.decls); });
  };
  addDecls(ast.decls);
  return nomes;
}
function percorrerExpr(node, usados) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'Id' || node.type === 'Indice' || node.type === 'Chamada') usados.push(node);
  for (const k in node) { const v = node[k]; if (Array.isArray(v)) v.forEach(x => percorrerExpr(x, usados)); else if (v && typeof v === 'object') percorrerExpr(v, usados); }
}
function lintAgora() {
  const tab = abaAtiva(); if (!tab) return;
  const src = tab.doc.getValue();
  const problems = [];
  let ast = null;
  try {
    ast = PORTUGOL.parse(src);
  } catch (e) {
    if (e && e.isLangError) problems.push({ line: e.line, msg: e.message, sev: 'err' });
    else problems.push({ line: 1, msg: 'Erro inesperado ao analisar o código.', sev: 'err' });
  }
  if (ast) {
    const declarados = coletarIdentificadoresDeclarados(ast);
    const funcsConhecidas = new Set([...FUNCOES_LIB]);
    const usados = [];
    percorrerExpr(ast.corpo, usados);
    (ast.decls.subs || []).forEach(s => percorrerExpr(s.corpo, usados));
    const vistos = new Set();
    usados.forEach(u => {
      const chave = u.nome.toLowerCase();
      if (declarados.has(chave) || funcsConhecidas.has(chave) || vistos.has(chave + u.line)) return;
      vistos.add(chave + u.line);
      if (u.type === 'Chamada' && !declarados.has(chave)) problems.push({ line: u.line, msg: `função/procedimento "${u.nome}" não foi declarado`, sev: 'warn' });
      else if (u.type !== 'Chamada' && !declarados.has(chave)) problems.push({ line: u.line, msg: `variável "${u.nome}" usada sem ter sido declarada`, sev: 'warn' });
    });
  }
  renderProblemas(problems);
}
function renderProblemas(problems) {
  problems.sort((a,b) => a.line - b.line);
  cm.clearGutter('gutter-problems');
  if (cm._lintMarks) cm._lintMarks.forEach(m => m.clear());
  cm._lintMarks = [];
  problems.forEach(p => {
    const marker = document.createElement('div');
    marker.className = p.sev === 'err' ? 'gutter-err' : 'gutter-warn';
    marker.textContent = p.sev === 'err' ? '●' : '▲';
    marker.title = p.msg;
    cm.setGutterMarker(p.line - 1, 'gutter-problems', marker);
    const mark = cm.markText({ line: p.line - 1, ch: 0 }, { line: p.line - 1, ch: cm.getLine(p.line - 1) ? cm.getLine(p.line-1).length : 0 }, { className: p.sev === 'err' ? 'line-erro-bg' : '' });
    cm._lintMarks.push(mark);
  });
  const list = $('#problems-list');
  if (!problems.length) { list.innerHTML = '<div id="problems-empty">✓ Nenhum problema encontrado neste algoritmo.</div>'; }
  else {
    list.innerHTML = '';
    problems.forEach(p => {
      const el = document.createElement('div');
      el.className = 'problem-item ' + p.sev;
      el.innerHTML = `<span class="picon">${p.sev === 'err' ? '🐞' : '⚠'}</span><span>${escapeHtml(p.msg)} <span class="ploc">— linha ${p.line}</span></span>`;
      el.addEventListener('click', () => { cm.setCursor({ line: p.line - 1, ch: 0 }); cm.focus(); });
      list.appendChild(el);
    });
  }
  const nerr = problems.filter(p => p.sev === 'err').length;
  const nwarn = problems.filter(p => p.sev === 'warn').length;
  $('#problem-count').textContent = String(problems.length);
  $('#sb-problems').textContent = problems.length ? `${nerr} erro(s), ${nwarn} aviso(s)` : '✓ Sem erros';
}

function toggleBreakpointAtLine(line) {
  const tab = abaAtiva(); if (!tab) return;
  const handle = tab.doc.getLineHandle(line);
  let found = null;
  tab.bpHandles.forEach(h => { if (h === handle) found = h; });
  if (found) tab.bpHandles.delete(found); else tab.bpHandles.add(handle);
  renderBreakpointGutter();
  renderBreakpointsPanel();
}
function renderBreakpointGutter() {
  const tab = abaAtiva(); if (!tab) return;
  cm.clearGutter('gutter-breakpoints');
  tab.bpHandles.forEach(h => {
    const n = tab.doc.getLineNumber(h);
    if (n === null) return;
    const marker = document.createElement('div'); marker.className = 'gutter-bp'; marker.textContent = '●';
    cm.setGutterMarker(n, 'gutter-breakpoints', marker);
  });
}
function renderBreakpointsPanel() {
  renderBreakpointGutter();
  const tab = abaAtiva();
  const body = $('#bp-body');
  const linhas = tab ? Array.from(tab.bpHandles).map(h => tab.doc.getLineNumber(h)).filter(n => n !== null).sort((a,b) => a-b) : [];
  if (!linhas.length) { body.innerHTML = '<div class="dp-empty">Clique na régua de linhas para adicionar.</div>'; return; }
  body.innerHTML = '';
  linhas.forEach(n => {
    const row = document.createElement('div'); row.className = 'bp-row';
    row.innerHTML = `<span class="bpdot"></span><span>Linha ${n + 1}</span>`;
    row.addEventListener('click', () => { cm.setCursor({ line: n, ch: 0 }); cm.focus(); });
    body.appendChild(row);
  });
}

function consoleEscrever(texto, cls) {
  const out = $('#console-out');
  if (out.dataset.empty) { out.textContent = ''; delete out.dataset.empty; }
  if (cls) { const span = document.createElement('span'); span.className = cls; span.textContent = texto; out.appendChild(span); }
  else out.appendChild(document.createTextNode(texto));
  out.scrollTop = out.scrollHeight;
}
function consoleLimpar() { const out = $('#console-out'); out.textContent = ''; out.dataset.empty = '1'; }

function iniciarExecucao() {
  const tab = abaAtiva(); if (!tab) return false;
  lintAgora();
  const src = tab.doc.getValue();
  let ast;
  try { ast = PORTUGOL.parse(src); }
  catch (e) {
    showToast('Há erros de sintaxe — veja o painel "Problemas".');
    setBottomTab('problemas');
    return false;
  }
  consoleLimpar();
  const io = {
    escrever: (t) => consoleEscrever(t),
    ler: (label) => {
      const v = window.prompt('Entrada de dados — ' + label, '');
      consoleEscrever(label + (v ?? '') + '\n', 'in-line');
      return v ?? '';
    },
  };
  const interp = new PORTUGOL.Interpretador(ast, io);
  State.exec = { interp, gen: interp.executar(), tab, paused: false, currentMark: null };
  State.varsPrev = new Map();
  setBottomTab('saida');
  atualizarBarraExecucao(true);
  return true;
}

function limparMarcacaoLinhaAtual() {
  if (State.exec && State.exec.currentMark) { State.exec.currentMark.clear(); State.exec.currentMark = null; }
}
function marcarLinhaAtual(line) {
  limparMarcacaoLinhaAtual();
  State.exec.currentMark = cm.markText({ line, ch: 0 }, { line, ch: cm.getLine(line) ? cm.getLine(line).length : 0 }, { className: 'line-atual-bg' });
  cm.scrollIntoView({ line, ch: 0 }, 60);
}

function linhaTemBreakpoint(tab, lineIdx) {
  for (const h of tab.bpHandles) { if (tab.doc.getLineNumber(h) === lineIdx) return true; }
  return false;
}

function avancar(pararEmBreakpoint, umPasso) {
  const ex = State.exec; if (!ex) return;
  try {
    let r = ex.gen.next();
    if (!umPasso) {
      while (!r.done) {
        if (pararEmBreakpoint && linhaTemBreakpoint(ex.tab, r.value.line - 1)) break;
        r = ex.gen.next();
      }
    }
    if (r.done) { finalizarExecucao(true); return; }
    marcarLinhaAtual(r.value.line - 1);
    atualizarPainelVariaveis(r.value.escopo);
    atualizarPilha(r.value.pilha);
    ex.paused = true;
    atualizarBarraExecucao(true, true);
  } catch (err) {
    if (err && err.isLangError) {
      consoleEscrever(`\nErro em tempo de execução (linha ${err.line}): ${err.message}\n`, 'err');
      showToast('Erro em tempo de execução — veja a Saída.');
    } else {
      consoleEscrever('\nErro inesperado: ' + (err && err.message || err) + '\n', 'err');
    }
    finalizarExecucao(false);
  }
}
function finalizarExecucao(sucesso) {
  limparMarcacaoLinhaAtual();
  if (sucesso) consoleEscrever('\n[Execução concluída]\n', 'sys');
  State.exec = null;
  atualizarBarraExecucao(false);
  $('#vars-body').innerHTML = '<div class="dp-empty">Execute ou avance um passo para inspecionar variáveis.</div>';
  $('#stack-body').innerHTML = '<div class="dp-empty">—</div>';
}
function pararExecucao(silencioso) {
  if (!State.exec) return;
  limparMarcacaoLinhaAtual();
  State.exec = null;
  atualizarBarraExecucao(false);
  if (!silencioso) consoleEscrever('\n[Execução interrompida pelo usuário]\n', 'sys');
}
function atualizarBarraExecucao(rodando, pausado) {
  $('#btn-run').style.display = rodando ? 'none' : '';
  $('#btn-step').style.display = (rodando && !pausado) ? 'none' : '';
  $('#btn-continue').style.display = pausado ? '' : 'none';
  $('#btn-stop').disabled = !rodando;
  const bar = $('#statusbar');
  bar.classList.toggle('paused', !!pausado);
  bar.classList.toggle('running', rodando && !pausado);
  $('#sb-status').textContent = pausado ? 'Pausado (breakpoint)' : (rodando ? 'Executando…' : 'Pronto');
}
function atualizarPainelVariaveis(escopo) {
  const body = $('#vars-body'); body.innerHTML = '';
  const linhas = escopo.snapshotLocal();
  if (!linhas.length) { body.innerHTML = '<div class="dp-empty">Sem variáveis neste escopo.</div>'; return; }
  linhas.forEach(v => {
    const key = v.nome;
    const changed = State.varsPrev.has(key) && State.varsPrev.get(key) !== v.valor;
    State.varsPrev.set(key, v.valor);
    const row = document.createElement('div'); row.className = 'var-row' + (changed ? ' changed' : '');
    row.innerHTML = `<span class="vn">${escapeHtml(v.nome)}</span><span class="vt">${v.tipo}</span><span class="vv">${escapeHtml(v.valor)}</span>`;
    body.appendChild(row);
  });
}
function atualizarPilha(pilha) {
  const body = $('#stack-body');
  if (!pilha.length) { body.innerHTML = '<div class="stack-row"><span class="si">▸</span> algoritmo principal</div>'; return; }
  body.innerHTML = '<div class="stack-row"><span class="si">▸</span> algoritmo principal</div>' +
    pilha.map((n, i) => `<div class="stack-row" style="padding-left:${16 + i*12}px"><span class="si">↳</span> ${escapeHtml(n)}()</div>`).reverse().join('');
}

function cmdExecutar() {
  if (State.exec) { avancar(true, false); return; }
  if (!iniciarExecucao()) return;
  avancar(true, false);
}
function cmdPasso() {
  if (!State.exec) { if (!iniciarExecucao()) return; }
  avancar(false, true);
}
function cmdContinuar() { if (State.exec) avancar(true, false); }
function cmdParar() { pararExecucao(false); }

function setBottomTab(pane) {
  $all('.bt-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === pane));
  $all('.bt-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + pane));$('#bottom-panel').classList.remove('collapsed');
}

function cmdComentar() { cm.toggleComment({ lineComment: '//' }); }

function cmdFormatar() {
  const src = cm.getValue();
  const linhas = src.split('\n');
  const IND = '   ';
  const abreDepois = new Set(['se','enquanto','para','repita','escolha','funcao','procedimento']);
  const fecham = new Set(['fimse','fimenquanto','fimpara','fimescolha','fimfuncao','fimprocedimento','fimalgoritmo']);
  const dedentTemp = new Set(['senao','caso','outrocaso']);
  let nivel = 0;
  const saida = linhas.map(linhaBruta => {
    const linha = linhaBruta.trim();
    if (linha === '') return '';
    const primeira = (linha.match(/^[a-zA-ZÀ-ÿ_]+/) || [''])[0].toLowerCase();
    let nivelLinha = nivel;
    if (fecham.has(primeira)) nivelLinha = Math.max(0, nivel - 1);
    else if (dedentTemp.has(primeira)) nivelLinha = Math.max(0, nivel - 1);
    else if (primeira === 'ate' && !linha.toLowerCase().startsWith('ate ')) nivelLinha = nivel;
    else if (primeira === 'algoritmo') nivelLinha = 0;
    const texto = IND.repeat(nivelLinha) + linha;
    if (fecham.has(primeira)) { nivel = Math.max(0, nivel - 1); }
    else if (dedentTemp.has(primeira)) { nivel = nivel; }
    else if (abreDepois.has(primeira) || primeira === 'senao' || primeira === 'caso' || primeira === 'outrocaso' || primeira === 'algoritmo') {
      if (primeira === 'algoritmo') nivel = 1;
      else if (dedentTemp.has(primeira)) nivel = nivelLinha + 1;
      else nivel = nivel + 1;
    }
    return texto;
  });
  const cursor = cm.getCursor();
  cm.setValue(saida.join('\n'));
  cm.setCursor(cursor);
  showToast('Código formatado.');
}

function cmdSelecionarProximaOcorrencia() {
  const sels = cm.listSelections();
  const last = sels[sels.length - 1];
  let termo = cm.getRange(last.anchor, last.head);
  let from = last.head;
  if (!termo) { const w = cm.findWordAt(last.head); termo = cm.getRange(w.anchor, w.head); from = w.head; if (!cm.somethingSelected()) cm.addSelection(w.anchor, w.head); }
  if (!termo) return;
  const sc = cm.getSearchCursor(termo, from, { caseFold: false });
  if (sc.findNext()) cm.addSelection(sc.from(), sc.to());
  else showToast(`Nenhuma outra ocorrência de "${termo}".`);
}
function cmdAdicionarCursor(dir) {
  const sels = cm.listSelections();
  const novas = sels.slice();
  sels.forEach(s => {
    const nl = s.head.line + dir;
    if (nl >= 0 && nl < cm.lineCount()) novas.push({ anchor: { line: nl, ch: s.head.ch }, head: { line: nl, ch: s.head.ch } });
  });
  cm.setSelections(novas);
}

function customHint(cmi) {
  const cur = cmi.getCursor();
  const line = cmi.getLine(cur.line);
  const start = (line.slice(0, cur.ch).match(/[A-Za-zÀ-ÿ0-9_]*$/) || [''])[0];
  const from = CodeMirror.Pos(cur.line, cur.ch - start.length);
  const to = CodeMirror.Pos(cur.line, cur.ch);
  const lower = start.toLowerCase();
  const decls = [];
  try {
    const ast = PORTUGOL.parse(cmi.getValue());
    coletarIdentificadoresDeclarados(ast).forEach(n => decls.push(n));
  } catch (e) {}

  const candidatos = [];
  PALAVRAS.forEach(p => candidatos.push({ text: p, displayText: p, tag: 'palavra-chave' }));
  TIPOS.forEach(p => candidatos.push({ text: p, displayText: p, tag: 'tipo' }));
  FUNCOES_LIB.forEach(p => candidatos.push({ text: p + '(', displayText: p, tag: 'função' }));
  decls.forEach(p => candidatos.push({ text: p, displayText: p, tag: 'seu código' }));
  SNIPPETS.forEach(s => candidatos.push({ text: s.texto, displayText: s.nome, tag: 'snippet', snippet: true }));

  const filtrados = (lower ? candidatos.filter(c => c.displayText.toLowerCase().startsWith(lower)) : candidatos.filter(c => c.tag !== 'snippet'));
  const vistos = new Set();
  const lista = filtrados.filter(c => { const k = c.displayText + c.tag; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 40);

  return {
    list: lista.map(c => ({
      text: c.text, displayText: c.displayText,
      render: (el) => { el.innerHTML = `${escapeHtml(c.displayText)}<span class="hint-tag">${c.tag}</span>`; },
      hint: (cmi2, data, completion) => aplicarConclusao(cmi2, data, completion, c.snippet),
    })),
    from, to,
  };
}
function aplicarConclusao(cmi, data, completion, isSnippet) {
  if (!isSnippet) { cmi.replaceRange(completion.text, data.from, data.to); return; }
  let texto = completion.text;
  const primeiraTag = texto.match(/\$\{1:([^}]*)\}|\$\{0\}/);
  texto = texto.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{0\}/g, '');
  const linhasAntes = completion.text.slice(0, primeiraTag ? primeiraTag.index : 0).split('\n');
  cmi.replaceRange(texto, data.from, data.to);
  if (primeiraTag) {
    const linha = data.from.line + linhasAntes.length - 1;
    const ch = (linhasAntes.length === 1 ? data.from.ch : 0) + linhasAntes[linhasAntes.length - 1].length;
    const tam = (primeiraTag[1] || '').length;
    cmi.setSelection({ line: linha, ch }, { line: linha, ch: ch + tam });
  }
}
CodeMirror.registerHelper('hint', 'portugol', customHint);

function abrirLocalizar(comSubstituir) {
  $('#findpanel').classList.add('show');
  $('#replace-row').style.display = comSubstituir ? 'flex' : 'none';
  const sel = cm.getSelection();
  if (sel) $('#find-input').value = sel;
  $('#find-input').focus(); $('#find-input').select();
  atualizarBusca();
}
function fecharLocalizar() { $('#findpanel').classList.remove('show'); cm.focus(); }
function atualizarBusca() {
  const termo = $('#find-input').value;
  if (!termo) { $('#find-count').textContent = ''; return; }
  let n = 0; const sc = cm.getSearchCursor(termo, { line: 0, ch: 0 }, { caseFold: true });
  while (sc.findNext()) n++;
  $('#find-count').textContent = n + (n === 1 ? ' ocorrência' : ' ocorrências');
}
function buscarProx(voltar) {
  const termo = $('#find-input').value; if (!termo) return;
  const from = cm.getCursor(voltar ? 'from' : 'to');
  let sc = cm.getSearchCursor(termo, from, { caseFold: true });
  let achou = voltar ? sc.findPrevious() : sc.findNext();
  if (!achou) { sc = cm.getSearchCursor(termo, voltar ? { line: cm.lineCount(), ch: 0 } : { line: 0, ch: 0 }, { caseFold: true }); achou = voltar ? sc.findPrevious() : sc.findNext(); }
  if (achou) { cm.setSelection(sc.from(), sc.to()); cm.scrollIntoView(sc.from(), 80); }
}
function substituirUma() {
  const termo = $('#find-input').value; const novo = $('#replace-input').value; if (!termo) return;
  if (cm.getSelection().toLowerCase() === termo.toLowerCase()) cm.replaceSelection(novo);
  buscarProx(false);
}
function substituirTodas() {
  const termo = $('#find-input').value; const novo = $('#replace-input').value; if (!termo) return;
  const sc = cm.getSearchCursor(termo, { line: 0, ch: 0 }, { caseFold: true });
  let n = 0;
  while (sc.findNext()) { sc.replace(novo); n++; }
  showToast(`${n} substituição(ões) realizada(s).`);
  atualizarBusca();
}

const COMANDOS = [
  { id:'run', label:'Executar algoritmo', cat:'executar', key:'F9 / F5' },
  { id:'step', label:'Executar passo a passo', cat:'executar', key:'F8' },
  { id:'stop', label:'Parar execução', cat:'executar', key:'Ctrl+F2' },
  { id:'toggle-bp', label:'Alternar breakpoint na linha atual', cat:'executar', key:'Shift+F5' },
  { id:'clear-bp', label:'Remover todos os breakpoints', cat:'executar' },
  { id:'novo', label:'Novo algoritmo', cat:'arquivo', key:'Ctrl+N' },
  { id:'abrir', label:'Abrir arquivo…', cat:'arquivo', key:'Ctrl+O' },
  { id:'salvar', label:'Salvar', cat:'arquivo', key:'Ctrl+S' },
  { id:'salvarcomo', label:'Salvar como…', cat:'arquivo', key:'Ctrl+Shift+S' },
  { id:'localizar', label:'Localizar', cat:'editar', key:'Ctrl+F' },
  { id:'substituir', label:'Substituir', cat:'editar', key:'Ctrl+H' },
  { id:'comentar', label:'Comentar/descomentar linha', cat:'editar', key:'Ctrl+/' },
  { id:'formatar', label:'Formatar código', cat:'editar', key:'Shift+Alt+F' },
  { id:'sel-proxima', label:'Selecionar próxima ocorrência', cat:'seleção', key:'Ctrl+D' },
  { id:'tema-claro', label:'Tema: Claro', cat:'tema' },
  { id:'tema-escuro', label:'Tema: Escuro', cat:'tema' },
  { id:'zoom-in', label:'Aumentar zoom do editor', cat:'visualizar', key:'Ctrl+=' },
  { id:'zoom-out', label:'Diminuir zoom do editor', cat:'visualizar', key:'Ctrl+-' },
  { id:'ir-linha', label:'Ir para linha…', cat:'navegação', key:'Ctrl+G' },
  { id:'ajuda-contextual', label:'Ajuda contextual (palavra sob o cursor)', cat:'ajuda', key:'F1' },
  { id:'atalhos', label:'Ver lista de atalhos', cat:'ajuda' },
  { id:'sobre', label:'Sobre o VisuAlg+', cat:'ajuda' },
];
function abrirPaleta() {
  $('#cmdpalette-bg').classList.remove('hidden');
  const input = $('#cmdpalette-input'); input.value = ''; input.focus();
  renderPaleta(''); 
}
function fecharPaleta() { $('#cmdpalette-bg').classList.add('hidden'); cm.focus(); }
function renderPaleta(query) {
  const q = query.trim().toLowerCase();
  const lista = COMANDOS.filter(c => !q || c.label.toLowerCase().includes(q) || c.cat.includes(q));
  const el = $('#cmdpalette-list'); el.innerHTML = '';
  if (!lista.length) { el.innerHTML = '<div class="hint-list">Nenhum comando encontrado.</div>'; return; }
  lista.forEach((c, i) => {
    const item = document.createElement('div'); item.className = 'cmd-item' + (i === 0 ? ' sel' : '');
    item.innerHTML = `<span>${escapeHtml(c.label)} <span class="cat">${c.cat}</span></span>${c.key ? `<kbd>${c.key}</kbd>` : ''}`;
    item.addEventListener('click', () => { fecharPaleta(); executarComando(c.id); });
    el.appendChild(item);
  });
}
function executarComando(id) {
  switch (id) {
    case 'run': cmdExecutar(); break;
    case 'step': cmdPasso(); break;
    case 'stop': cmdParar(); break;
    case 'toggle-bp': toggleBreakpointAtLine(cm.getCursor().line); break;
    case 'clear-bp': { const t = abaAtiva(); if (t) { t.bpHandles.clear(); renderBreakpointsPanel(); } break; }
    case 'novo': cmdNovo(); break;
    case 'abrir': cmdAbrir(); break;
    case 'salvar': cmdSalvar(false); break;
    case 'salvarcomo': cmdSalvar(true); break;
    case 'fechar-aba': fecharAba(State.activeId); break;
    case 'desfazer': cm.undo(); break;
    case 'refazer': cm.redo(); break;
    case 'localizar': abrirLocalizar(false); break;
    case 'substituir': abrirLocalizar(true); break;
    case 'comentar': cmdComentar(); break;
    case 'formatar': cmdFormatar(); break;
    case 'sel-tudo': cm.execCommand('selectAll'); break;
    case 'sel-proxima': cmdSelecionarProximaOcorrencia(); break;
    case 'cursor-acima': cmdAdicionarCursor(-1); break;
    case 'cursor-abaixo': cmdAdicionarCursor(1); break;
    case 'tema-claro': setTheme('light'); break;
    case 'tema-escuro': setTheme('dark'); break;
    case 'zoom-in': ajustarZoom(1); break;
    case 'zoom-out': ajustarZoom(-1); break;
    case 'ir-linha': { const l = prompt('Ir para linha:'); if (l) { cm.setCursor({ line: Math.max(0, parseInt(l,10)-1), ch:0 }); cm.focus(); } break; }
    case 'ajuda-contextual': mostrarAjudaContextual(); break;
    case 'atalhos': mostrarAtalhos(); break;
    case 'sobre': mostrarSobre(); break;
  }
}

function abrirModalAjuda(titulo, sintaxe, desc, exemplo) {
  $('#help-title').textContent = titulo.toUpperCase();
  $('#help-syntax').textContent = sintaxe;
  $('#help-desc').textContent = desc;
  $('#help-example').textContent = exemplo || '';
  $('#helpmodal-bg').classList.remove('hidden');
}
function mostrarAjudaContextual() {
  const cur = cm.getCursor();
  const w = cm.findWordAt(cur);
  const palavra = cm.getRange(w.anchor, w.head).toLowerCase();
  const doc = AJUDA[palavra];
  if (doc) abrirModalAjuda(palavra, doc.sintaxe, doc.desc, doc.exemplo);
  else showToast(`Sem ajuda contextual para "${palavra || '—'}".`);
}
function mostrarAtalhos() {
  abrirModalAjuda('Atalhos principais',
`F9 / F5  Executar        F8  Passo a passo
Ctrl+F2  Parar          Shift+F5  Alternar breakpoint
Ctrl+N  Novo            Ctrl+O  Abrir
Ctrl+S  Salvar          Ctrl+Shift+S  Salvar como
Ctrl+F  Localizar       Ctrl+H  Substituir
Ctrl+/  Comentar        Shift+Alt+F  Formatar
Ctrl+Space  Autocomplete   F1  Ajuda contextual
Ctrl+D  Próxima ocorrência
Ctrl+Alt+↑/↓  Multi-cursor
Ctrl+Shift+P  Paleta de comandos`, '', '');
}
function mostrarSobre() {
  abrirModalAjuda('VisuAlg+', 'Projeto do curso de Desenvolvimento de Sistemas',
    'Ambiente de aprendizagem de Portugol inspirado no VisuAlg 3.0.7 e no Visual Studio Code — construído para uso interno da turma.', 'Fase 1 (em desenvolvimento): editor, execução, depurador básico e análise de erros em tempo real.');
}

function setTheme(t) { document.body.dataset.theme = t; $('#btn-theme').textContent = t === 'dark' ? '◐' : '◑'; scheduleAutoSave(); }
function alternarTema() { setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'); }
function ajustarZoom(delta) {
  State.zoom = Math.max(10, Math.min(28, State.zoom + delta));
  cm.getWrapperElement().style.fontSize = State.zoom + 'px';
  cm.refresh(); scheduleAutoSave();
}
let toastTimer;
function showToast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function updateStatusPos() {
  const c = cm.getCursor();
  $('#sb-pos').textContent = `Linha ${c.line + 1}, Coluna ${c.ch + 1}`;
}

function initMenus() {
  $all('.menu-item').forEach(mi => {
    const btn = mi.querySelector('.menu-btn'); const dd = mi.querySelector('.menu-dropdown');
    btn.addEventListener('click', (e) => { e.stopPropagation(); const abrir = !dd.classList.contains('show'); fecharTodosMenus(); if (abrir) { dd.classList.add('show'); btn.classList.add('open'); } });
    dd.querySelectorAll('.mi').forEach(item => item.addEventListener('click', () => { fecharTodosMenus(); executarComando(item.dataset.cmd); }));
  });
  document.addEventListener('click', fecharTodosMenus);
}
function fecharTodosMenus() { $all('.menu-dropdown').forEach(d => d.classList.remove('show'));$all('.menu-btn').forEach(b => b.classList.remove('open')); }

function initUI() {
  $('#btn-run').addEventListener('click', cmdExecutar);
  $('#btn-step').addEventListener('click', cmdPasso);
  $('#btn-continue').addEventListener('click', cmdContinuar);
  $('#btn-stop').addEventListener('click', cmdParar);
  $('#btn-toggle-explorer').addEventListener('click', () => { $('#explorer').classList.toggle('collapsed'); $('#btn-toggle-explorer').classList.toggle('active'); });
  $('#btn-toggle-debug').addEventListener('click', () => { $('#debugpanel').classList.toggle('collapsed'); $('#btn-toggle-debug').classList.toggle('active'); });
  $('#zoom-in').addEventListener('click', () => ajustarZoom(1));
  $('#zoom-out').addEventListener('click', () => ajustarZoom(-1));
  $('#btn-cmdpalette').addEventListener('click', abrirPaleta);
  $('#btn-theme').addEventListener('click', alternarTema);
  $('#explorer-newfile').addEventListener('click', cmdNovo);

  $('#cmdpalette-input').addEventListener('input', (e) => renderPaleta(e.target.value));
  $('#cmdpalette-input').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharPaleta();
    if (e.key === 'Enter') { const sel = $('.cmd-item.sel') \vert{}\vert{}$('.cmd-item'); if (sel) sel.click(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = $all('.cmd-item'); let idx = items.findIndex(i => i.classList.contains('sel'));
      if (idx === -1) idx = 0; items[idx] && items[idx].classList.remove('sel');
      idx = e.key === 'ArrowDown' ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
      items[idx] && items[idx].classList.add('sel'); items[idx] && items[idx].scrollIntoView({ block: 'nearest' });
    }
  });
  $('#cmdpalette-bg').addEventListener('click', (e) => { if (e.target.id === 'cmdpalette-bg') fecharPaleta(); });

  $all('.bt-tab').forEach(t => t.addEventListener('click', () => setBottomTab(t.dataset.pane)));$('#btn-clear-console').addEventListener('click', consoleLimpar);
  $('#btn-collapse-bottom').addEventListener('click', () => $('#bottom-panel').classList.toggle('collapsed'));

  $('#find-input').addEventListener('input', atualizarBusca);
  $('#find-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarProx(e.shiftKey); if (e.key === 'Escape') fecharLocalizar(); });
  $('#find-next').addEventListener('click', () => buscarProx(false));
  $('#find-prev').addEventListener('click', () => buscarProx(true));
  $('#find-close').addEventListener('click', fecharLocalizar);
  $('#replace-one').addEventListener('click', substituirUma);
  $('#replace-all').addEventListener('click', substituirTodas);

  $('#help-close').addEventListener('click', () => $('#helpmodal-bg').classList.add('hidden'));
  $('#helpmodal-bg').addEventListener('click', (e) => { if (e.target.id === 'helpmodal-bg') $('#helpmodal-bg').classList.add('hidden'); });

  const quick = $('#help-quicklist');
  Object.keys(AJUDA).forEach(k => {
    const el = document.createElement('div'); el.className = 'help-item'; el.textContent = k;
    el.addEventListener('click', () => abrirModalAjuda(k, AJUDA[k].sintaxe, AJUDA[k].desc, AJUDA[k].exemplo));
    quick.appendChild(el);
  });

  // Ouvinte de evento IPC do Electron para execução por atalhos globais (F5 / F9)
  if (typeof require !== 'undefined') {
    try {
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('executar-algoritmo', () => {
        cmdExecutar();
      });
    } catch (e) {}
  }

  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!$('#cmdpalette-bg').classList.contains('hidden')) return;
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); abrirPaleta(); return; }
    if (e.key === 'Escape') { fecharLocalizar(); $('#helpmodal-bg').classList.add('hidden'); return; }
    if (e.key === 'F9' || (e.key === 'F5' && !e.shiftKey)) { e.preventDefault(); cmdExecutar(); return; }
    if (e.key === 'F8') { e.preventDefault(); cmdPasso(); return; }
    if (e.key === 'F5' && e.shiftKey) { e.preventDefault(); toggleBreakpointAtLine(cm.getCursor().line); return; }
    if (ctrl && e.key === 'F2') { e.preventDefault(); cmdParar(); return; }
    if (e.key === 'F1') { e.preventDefault(); mostrarAjudaContextual(); return; }
    if (ctrl && e.key.toLowerCase() === 'n') { e.preventDefault(); cmdNovo(); return; }
    if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); cmdAbrir(); return; }
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); cmdSalvar(true); return; }
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); cmdSalvar(false); return; }
    if (ctrl && e.key.toLowerCase() === 'w') { e.preventDefault(); fecharAba(State.activeId); return; }
    if (ctrl && e.key.toLowerCase() === 'f' && !e.shiftKey) { e.preventDefault(); abrirLocalizar(false); return; }
    if (ctrl && e.key.toLowerCase() === 'h') { e.preventDefault(); abrirLocalizar(true); return; }
    if (ctrl && e.key.toLowerCase() === 'g') { e.preventDefault(); executarComando('ir-linha'); return; }
    if (ctrl && e.key === '/') { e.preventDefault(); cmdComentar(); return; }
    if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); cmdFormatar(); return; }
    if (ctrl && e.key.toLowerCase() === 'd' && !e.shiftKey) { e.preventDefault(); cmdSelecionarProximaOcorrencia(); return; }
    if (ctrl && e.altKey && e.key === 'ArrowUp') { e.preventDefault(); cmdAdicionarCursor(-1); return; }
    if (ctrl && e.altKey && e.key === 'ArrowDown') { e.preventDefault(); cmdAdicionarCursor(1); return; }
    if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); ajustarZoom(1); return; }
    if (ctrl && e.key === '-') { e.preventDefault(); ajustarZoom(-1); return; }
    if (ctrl && e.key === '0') { e.preventDefault(); State.zoom = 14; cm.getWrapperElement().style.fontSize='14px'; cm.refresh(); return; }
  });
}

function boot() {
  initEditor();
  initMenus();
  initUI();
  const restaurou = carregarEstadoLocal();
  if (!restaurou) novaAba('sem-titulo-1.alg', TEMPLATE_PADRAO);
  lintAgora();
  updateStatusPos();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();