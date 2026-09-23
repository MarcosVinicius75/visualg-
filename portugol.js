'use strict';

const KEYWORDS = new Set([
  'algoritmo','var','const','inicio','fimalgoritmo',
  'inteiro','real','caractere','literal','logico','vetor','de',
  'se','entao','senao','fimse',
  'enquanto','faca','fimenquanto',
  'para','ate','passo','fimpara',
  'repita',
  'escolha','caso','outrocaso','fimescolha',
  'funcao','fimfuncao','procedimento','fimprocedimento','retorne',
  'leia','escreva','escreval',
  'verdadeiro','falso','e','ou','nao','div','mod'
]);

const BLOCK_OPENERS = ['se','enquanto','para','repita','escolha','funcao','procedimento'];
const BLOCK_CLOSERS = ['fimse','fimenquanto','fimpara','fimescolha','fimfuncao','fimprocedimento'];

class LangError extends Error {
  constructor(msg, line) { super(msg); this.line = line; this.isLangError = true; }
}

// ---------------------------------------------------------------- LEXER
function tokenize(source) {
  const tokens = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && line[i+1] === '/') break;
      if (c === '{' ) { const j = line.indexOf('}', i); if (j === -1) break; i = j+1; continue; }
      if (c === '"' || c === "'") {
        const quote = c; let j = i + 1; let str = '';
        while (j < line.length && line[j] !== quote) {
          if (line[j] === '\\' && line[j+1] === quote) { str += quote; j += 2; continue; }
          str += line[j]; j++;
        }
        tokens.push({ type: quote === '"' ? 'STRING' : 'CHAR', value: str, line: li+1, col: i+1 });
        i = j + 1; continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i; let num = '';
        while (j < line.length && /[0-9]/.test(line[j])) { num += line[j]; j++; }
        if (line[j] === '.' && /[0-9]/.test(line[j+1])) {
          num += '.'; j++;
          while (j < line.length && /[0-9]/.test(line[j])) { num += line[j]; j++; }
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(num), line: li+1, col: i+1 });
        i = j; continue;
      }
      if (/[A-Za-zÀ-ÿ_]/.test(c)) {
        let j = i; let id = '';
        while (j < line.length && /[A-Za-zÀ-ÿ0-9_]/.test(line[j])) { id += line[j]; j++; }
        const lower = id.toLowerCase();
        if (KEYWORDS.has(lower)) tokens.push({ type: 'KW', value: lower, raw: id, line: li+1, col: i+1 });
        else tokens.push({ type: 'ID', value: id, line: li+1, col: i+1 });
        i = j; continue;
      }
      const two = line.substr(i, 2);
      if (['<-','<=','>=','<>',':='].includes(two)) {
        tokens.push({ type: 'OP', value: two === ':=' ? '<-' : two, line: li+1, col: i+1 });
        i += 2; continue;
      }
      if ('+-*/^=<>(),[]:;.'.includes(c)) { tokens.push({ type: 'OP', value: c, line: li+1, col: i+1 }); i++; continue; }
      tokens.push({ type: 'UNKNOWN', value: c, line: li+1, col: i+1 }); i++;
    }
    tokens.push({ type: 'EOL', value: '\\n', line: li+1, col: line.length+1 });
  }
  tokens.push({ type: 'EOF', value: null, line: lines.length+1, col: 1 });
  return tokens;
}

// ---------------------------------------------------------------- PARSER
class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.pos = 0;
  }
  skipEol() { while (this.cur().type === 'EOL') this.pos++; }
  cur() { let p = this.pos; while (this.toks[p] && this.toks[p].type === 'EOL') p++; return this.toks[p]; }
  curLine() { return this.cur().line; }
  advance() { const t = this.cur(); while (this.toks[this.pos].type === 'EOL') this.pos++; this.pos++; return t; }
  isKw(v) { const t = this.cur(); return t.type === 'KW' && t.value === v; }
  isOp(v) { const t = this.cur(); return t.type === 'OP' && t.value === v; }
  expectKw(v) { if (!this.isKw(v)) this.err(`esperado "${v}"`); return this.advance(); }
  expectOp(v) { if (!this.isOp(v)) this.err(`esperado "${v}"`); return this.advance(); }
  expectId() { if (this.cur().type !== 'ID') this.err('esperado um identificador'); return this.advance(); }
  err(msg) { throw new LangError(msg, this.curLine()); }

  parsePrograma() {
    this.expectKw('algoritmo');
    const nomeTok = this.cur();
    if (nomeTok.type !== 'STRING') this.err('esperado o nome do algoritmo entre aspas');
    this.advance();
    const decls = { vars: [], consts: [], subs: [] };
    this.parseDeclaracoes(decls, true);
    this.expectKw('inicio');
    const corpo = this.parseBlocoAte(['fimalgoritmo']);
    this.expectKw('fimalgoritmo');
    return { type: 'Programa', nome: nomeTok.value, decls, corpo };
  }

  parseDeclaracoes(decls, topLevel) {
    for (;;) {
      if (this.isKw('var')) { this.advance(); this.parseVarBlock(decls.vars); continue; }
      if (this.isKw('const')) { this.advance(); this.parseConstBlock(decls.consts); continue; }
      if (topLevel && (this.isKw('funcao') || this.isKw('procedimento'))) { decls.subs.push(this.parseSub()); continue; }
      break;
    }
  }

  parseVarBlock(out) {
    while (this.cur().type === 'ID') {
      const nomes = [this.advance().value];
      while (this.isOp(',')) { this.advance(); nomes.push(this.expectId().value); }
      this.expectOp(':');
      const tipo = this.parseTipo();
      nomes.forEach(n => out.push({ nome: n, tipo }));
    }
  }

  parseTipo() {
    if (this.isKw('vetor')) {
      this.advance();
      this.expectOp('[');
      const dims = [];
      for (;;) {
        const ini = this.parseExpr();
        this.expectOp2Dots();
        const fim = this.parseExpr();
        dims.push({ ini, fim });
        if (this.isOp(',')) { this.advance(); continue; }
        break;
      }
      this.expectOp(']');
      this.expectKw('de');
      const base = this.expectTipoBase();
      return { kind: 'vetor', dims, base };
    }
    return { kind: 'escalar', base: this.expectTipoBase() };
  }
  expectOp2Dots() {
    this.expectOp('.'); this.expectOp('.');
  }
  expectTipoBase() {
    const t = this.cur();
    if (t.type === 'KW' && ['inteiro','real','caractere','literal','logico'].includes(t.value)) { this.advance(); return t.value === 'literal' ? 'caractere' : t.value; }
    this.err('tipo esperado (inteiro, real, caractere ou logico)');
  }

  parseConstBlock(out) {
    while (this.cur().type === 'ID') {
      const nome = this.advance().value;
      this.expectOp('=');
      const expr = this.parseExpr();
      out.push({ nome, expr });
    }
  }

  parseSub() {
    const isFunc = this.isKw('funcao');
    this.advance();
    const nome = this.expectId().value;
    this.expectOp('(');
    const params = [];
    if (!this.isOp(')')) {
      for (;;) {
        const nomes = [this.expectId().value];
        while (this.isOp(',')) { this.advance(); nomes.push(this.expectId().value); }
        this.expectOp(':');
        const tipo = this.parseTipo();
        nomes.forEach(n => params.push({ nome: n, tipo }));
        if (this.isOp(',')) { this.advance(); continue; }
        break;
      }
    }
    this.expectOp(')');
    let tipoRetorno = null;
    if (isFunc) { this.expectOp(':'); tipoRetorno = this.parseTipo(); }
    const decls = { vars: [], consts: [], subs: [] };
    this.parseDeclaracoes(decls, false);
    this.expectKw('inicio');
    const fimKw = isFunc ? 'fimfuncao' : 'fimprocedimento';
    const corpo = this.parseBlocoAte([fimKw]);
    this.expectKw(fimKw);
    return { type: isFunc ? 'Funcao' : 'Procedimento', nome, params, tipoRetorno, decls, corpo };
  }

  parseBlocoAte(enders) {
    const stmts = [];
    while (!this.matchesAny(enders)) {
      if (this.cur().type === 'EOF') this.err(`fim de arquivo inesperado, esperava "${enders.join('/')}"`);
      stmts.push(this.parseStmt());
    }
    return stmts;
  }
  matchesAny(kws) { const t = this.cur(); return t.type === 'KW' && kws.includes(t.value); }

  parseStmt() {
    const line = this.curLine();
    if (this.isKw('se')) return this.parseSe();
    if (this.isKw('enquanto')) return this.parseEnquanto();
    if (this.isKw('para')) return this.parsePara();
    if (this.isKw('repita')) return this.parseRepita();
    if (this.isKw('escolha')) return this.parseEscolha();
    if (this.isKw('leia')) return this.parseLeia();
    if (this.isKw('escreva') || this.isKw('escreval')) return this.parseEscreva();
    if (this.isKw('retorne')) { this.advance(); let e = null; if (!this.matchesAny(['fimfuncao','fimprocedimento']) && this.cur().type!=='EOF') e = this.parseExpr(); return { type:'Retorne', expr:e, line }; }
    if (this.cur().type === 'ID') return this.parseAtribOuChamada();
    this.err(`comando inesperado: "${this.cur().value}"`);
  }

  parseSe() {
    const line = this.curLine();
    this.advance();
    const cond = this.parseExpr();
    this.expectKw('entao');
    const thenB = this.parseBlocoAte(['senao','fimse']);
    let elseB = [];
    if (this.isKw('senao')) { this.advance(); elseB = this.parseBlocoAte(['fimse']); }
    this.expectKw('fimse');
    return { type: 'Se', cond, thenB, elseB, line };
  }
  parseEnquanto() {
    const line = this.curLine(); this.advance();
    const cond = this.parseExpr();
    this.expectKw('faca');
    const corpo = this.parseBlocoAte(['fimenquanto']);
    this.expectKw('fimenquanto');
    return { type: 'Enquanto', cond, corpo, line };
  }
  parsePara() {
    const line = this.curLine(); this.advance();
    const varName = this.expectId().value;
    this.expectKw('de');
    const de = this.parseExpr();
    this.expectKw('ate');
    const ate = this.parseExpr();
    let passo = null;
    if (this.isKw('passo')) { this.advance(); passo = this.parseExpr(); }
    this.expectKw('faca');
    const corpo = this.parseBlocoAte(['fimpara']);
    this.expectKw('fimpara');
    return { type: 'Para', varName, de, ate, passo, corpo, line };
  }
  parseRepita() {
    const line = this.curLine(); this.advance();
    const corpo = this.parseBlocoAte(['ate']);
    this.expectKw('ate');
    const cond = this.parseExpr();
    return { type: 'Repita', corpo, cond, line };
  }
  parseEscolha() {
    const line = this.curLine(); this.advance();
    const alvo = this.parseExpr();
    const casos = [];
    while (this.isKw('caso')) {
      this.advance();
      const valores = [this.parseExpr()];
      while (this.isOp(',')) { this.advance(); valores.push(this.parseExpr()); }
      const corpo = this.parseBlocoAte(['caso','outrocaso','fimescolha']);
      casos.push({ valores, corpo });
    }
    let outro = null;
    if (this.isKw('outrocaso')) { this.advance(); outro = this.parseBlocoAte(['fimescolha']); }
    this.expectKw('fimescolha');
    return { type: 'Escolha', alvo, casos, outro, line };
  }
  parseLeia() {
    const line = this.curLine(); this.advance();
    this.expectOp('(');
    const alvos = [this.parseLValue()];
    while (this.isOp(',')) { this.advance(); alvos.push(this.parseLValue()); }
    this.expectOp(')');
    return { type: 'Leia', alvos, line };
  }
  parseEscreva() {
    const line = this.curLine();
    const nl = this.cur().value === 'escreval';
    this.advance();
    this.expectOp('(');
    const args = [];
    if (!this.isOp(')')) {
      args.push(this.parseExpr());
      while (this.isOp(',')) { this.advance(); args.push(this.parseExpr()); }
    }
    this.expectOp(')');
    return { type: 'Escreva', args, nl, line };
  }
  parseLValue() {
    const nome = this.expectId().value;
    let indices = null;
    if (this.isOp('[')) {
      this.advance();
      indices = [this.parseExpr()];
      while (this.isOp(',')) { this.advance(); indices.push(this.parseExpr()); }
      this.expectOp(']');
    }
    return { nome, indices };
  }
  parseAtribOuChamada() {
    const line = this.curLine();
    const lv = this.parseLValue();
    if (this.isOp('<-')) {
      this.advance();
      const expr = this.parseExpr();
      return { type: 'Atrib', alvo: lv, expr, line };
    }
    if (this.isOp('(')) {
      this.advance();
      const args = [];
      if (!this.isOp(')')) { args.push(this.parseExpr()); while (this.isOp(',')) { this.advance(); args.push(this.parseExpr()); } }
      this.expectOp(')');
      return { type: 'ChamadaStmt', nome: lv.nome, args, line };
    }
    this.err('esperado "<-" ou "(" após identificador');
  }

  parseExpr() { return this.parseOu(); }
  parseOu() { let e = this.parseE(); while (this.isKw('ou')) { const line=this.curLine(); this.advance(); e = { type:'Bin', op:'ou', l:e, r:this.parseE(), line }; } return e; }
  parseE() { let e = this.parseNao(); while (this.isKw('e')) { const line=this.curLine(); this.advance(); e = { type:'Bin', op:'e', l:e, r:this.parseNao(), line }; } return e; }
  parseNao() { if (this.isKw('nao')) { const line=this.curLine(); this.advance(); return { type:'Un', op:'nao', e:this.parseNao(), line }; } return this.parseRel(); }
  parseRel() {
    let e = this.parseAdd();
    const ops = ['=','<>','>','<','>=','<='];
    if (this.cur().type==='OP' && ops.includes(this.cur().value)) {
      const op = this.advance().value; const line=this.curLine();
      e = { type:'Bin', op, l:e, r:this.parseAdd(), line };
    }
    return e;
  }
  parseAdd() {
    let e = this.parseMul();
    while (this.cur().type==='OP' && (this.cur().value==='+'||this.cur().value==='-')) {
      const op = this.advance().value; const line=this.curLine();
      e = { type:'Bin', op, l:e, r:this.parseMul(), line };
    }
    return e;
  }
  parseMul() {
    let e = this.parsePot();
    while ((this.cur().type==='OP' && (this.cur().value==='*'||this.cur().value==='/')) || this.isKw('div') || this.isKw('mod')) {
      const op = this.advance().value; const line=this.curLine();
      e = { type:'Bin', op, l:e, r:this.parsePot(), line };
    }
    return e;
  }
  parsePot() {
    let e = this.parseUnario();
    if (this.cur().type==='OP' && this.cur().value==='^') { const line=this.curLine(); this.advance(); e = { type:'Bin', op:'^', l:e, r:this.parsePot(), line }; }
    return e;
  }
  parseUnario() {
    if (this.cur().type==='OP' && this.cur().value==='-') { const line=this.curLine(); this.advance(); return { type:'Un', op:'-', e:this.parseUnario(), line }; }
    if (this.cur().type==='OP' && this.cur().value==='+') { this.advance(); return this.parseUnario(); }
    return this.parsePrim();
  }
  parsePrim() {
    const t = this.cur(); const line = t.line;
    if (t.type === 'NUMBER') { this.advance(); return { type:'Num', value:t.value, line }; }
    if (t.type === 'STRING') { this.advance(); return { type:'Str', value:t.value, line }; }
    if (t.type === 'CHAR') { this.advance(); return { type:'Str', value:t.value, line }; }
    if (t.type === 'KW' && t.value === 'verdadeiro') { this.advance(); return { type:'Bool', value:true, line }; }
    if (t.type === 'KW' && t.value === 'falso') { this.advance(); return { type:'Bool', value:false, line }; }
    if (this.isOp('(')) { this.advance(); const e = this.parseExpr(); this.expectOp(')'); return e; }
    if (t.type === 'ID') {
      this.advance();
      if (this.isOp('(')) {
        this.advance();
        const args = [];
        if (!this.isOp(')')) { args.push(this.parseExpr()); while (this.isOp(',')) { this.advance(); args.push(this.parseExpr()); } }
        this.expectOp(')');
        return { type:'Chamada', nome:t.value, args, line };
      }
      if (this.isOp('[')) {
        this.advance();
        const idx = [this.parseExpr()];
        while (this.isOp(',')) { this.advance(); idx.push(this.parseExpr()); }
        this.expectOp(']');
        return { type:'Indice', nome:t.value, idx, line };
      }
      return { type:'Id', nome:t.value, line };
    }
    this.err(`expressão inválida perto de "${t.value ?? t.type}"`);
  }
}

function parse(source) {
  const toks = tokenize(source);
  const p = new Parser(toks);
  return p.parsePrograma();
}

// ---------------------------------------------------------------- VALORES / TIPOS
function defaultValue(tipo) {
  if (tipo.kind === 'vetor') {
    return { __vetor: true, tipo, data: new Map() };
  }
  switch (tipo.base) {
    case 'inteiro': case 'real': return 0;
    case 'caractere': return '';
    case 'logico': return false;
    default: return null;
  }
}
function tipoNome(tipo) { return tipo.kind === 'vetor' ? `vetor de ${tipo.base}` : tipo.base; }
function coerce(base, v) {
  if (base === 'inteiro') return Math.trunc(Number(v) || 0);
  if (base === 'real') return Number(v) || 0;
  if (base === 'caractere') return v === null || v === undefined ? '' : String(v);
  if (base === 'logico') return !!v;
  return v;
}
function formatValor(v) {
  if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e6) / 1e6).replace('.', ',');
  }
  return String(v);
}

// ---------------------------------------------------------------- AMBIENTE (escopo)
class Escopo {
  constructor(pai) { this.pai = pai; this.vars = new Map(); this.tipos = new Map(); }
  declarar(nome, tipo) { this.tipos.set(nome.toLowerCase(), tipo); this.vars.set(nome.toLowerCase(), defaultValue(tipo)); }
  existeLocal(nome) { return this.vars.has(nome.toLowerCase()); }
  resolver(nome) {
    let e = this;
    while (e) { if (e.vars.has(nome.toLowerCase())) return e; e = e.pai; }
    return null;
  }
  get(nome, line) {
    const e = this.resolver(nome);
    if (!e) throw new LangError(`variável "${nome}" não foi declarada`, line);
    return e.vars.get(nome.toLowerCase());
  }
  getTipo(nome) { const e = this.resolver(nome); return e ? e.tipos.get(nome.toLowerCase()) : null; }
  set(nome, valor, line) {
    const e = this.resolver(nome);
    if (!e) throw new LangError(`variável "${nome}" não foi declarada`, line);
    const tipo = e.tipos.get(nome.toLowerCase());
    e.vars.set(nome.toLowerCase(), tipo.kind === 'vetor' ? valor : coerce(tipo.base, valor));
  }
  snapshotLocal() {
    const out = [];
    for (const [k, v] of this.vars.entries()) {
      const tipo = this.tipos.get(k);
      if (tipo && tipo.kind === 'vetor') out.push({ nome: k, tipo: tipoNome(tipo), valor: '(vetor)' });
      else out.push({ nome: k, tipo: tipo ? tipo.base : '?', valor: formatValor(v) });
    }
    return out;
  }
}

class RetornoSignal { constructor(valor) { this.valor = valor; } }

// ---------------------------------------------------------------- BIBLIOTECA PADRÃO
function stdlib(interp) {
  const num = x => Number(x) || 0;
  return {
    abs: (a) => Math.abs(num(a)),
    arred: (a) => Math.round(num(a)),
    trunc: (a) => Math.trunc(num(a)),
    quad: (a) => num(a) * num(a),
    raizq: (a) => Math.sqrt(num(a)),
    exp: (a,b) => Math.pow(num(a), num(b)),
    logn: (a) => Math.log(num(a)),
    log10: (a) => Math.log10(num(a)),
    pi: () => Math.PI,
    sen: (a) => Math.sin(num(a)),
    cos: (a) => Math.cos(num(a)),
    tan: (a) => Math.tan(num(a)),
    grauprad: (a) => num(a) * Math.PI / 180,
    radpgrau: (a) => num(a) * 180 / Math.PI,
    rand: () => Math.random(),
    randi: (a,b) => Math.floor(Math.random() * (num(b) - num(a) + 1)) + num(a),
    compr: (s) => String(s).length,
    copia: (s, ini, tam) => String(s).substr(num(ini) - 1, num(tam)),
    pos: (sub, s) => String(s).indexOf(String(sub)) + 1,
    maiusc: (s) => String(s).toUpperCase(),
    minusc: (s) => String(s).toLowerCase(),
    asc: (s) => String(s).charCodeAt(0) || 0,
    carac: (n) => String.fromCharCode(num(n)),
    numpc: (s) => parseFloat(String(s).replace(',', '.')) || 0,
  };
}

// ---------------------------------------------------------------- INTERPRETADOR
class Interpretador {
  constructor(ast, io) {
    this.ast = ast;
    this.io = io;
    this.global = new Escopo(null);
    this.lib = stdlib(this);
    this.subs = new Map();
    (ast.decls.subs || []).forEach(s => this.subs.set(s.nome.toLowerCase(), s));
    this.pilha = [];
    this.passos = 0;
    this.LIMITE_PASSOS = 4_000_000;
  }

  declararBloco(escopo, decls) {
    (decls.vars || []).forEach(v => escopo.declarar(v.nome, v.tipo));
    (decls.consts || []).forEach(c => {
      const val = this.avaliarSync(c.expr, escopo);
      escopo.vars.set(c.nome.toLowerCase(), val);
      escopo.tipos.set(c.nome.toLowerCase(), { kind: 'escalar', base: typeof val === 'number' ? 'real' : (typeof val === 'boolean' ? 'logico' : 'caractere') });
    });
  }

  *executar() {
    this.declararBloco(this.global, this.ast.decls);
    yield* this.execBloco(this.ast.corpo, this.global);
  }

  *execBloco(stmts, escopo) {
    for (const st of stmts) yield* this.execStmt(st, escopo);
  }

  *tick(line, escopo) {
    if (++this.passos > this.LIMITE_PASSOS) throw new LangError('Execução interrompida: limite de passos excedido.', line);
    yield { line, escopo, pilha: this.pilha.slice() };
  }

  *execStmt(st, escopo) {
    switch (st.type) {
      case 'Atrib': {
        const valor = this.avaliarSync(st.expr, escopo);
        if (st.alvo.indices) this.setIndice(escopo, st.alvo.nome, st.alvo.indices.map(i => this.avaliarSync(i, escopo)), valor, st.line);
        else escopo.set(st.alvo.nome, valor, st.line);
        yield* this.tick(st.line, escopo);
        break;
      }
      case 'Leia': {
        for (const alvo of st.alvos) {
          const tipo = escopo.getTipo(alvo.nome) || { base: 'caractere' };
          const texto = this.io.ler(`${alvo.nome}: `);
          let val;
          if (tipo.base === 'inteiro' || tipo.base === 'real') val = Number(String(texto).replace(',', '.'));
          else if (tipo.base === 'logico') val = /^(v|verdadeiro|true)$/i.test(String(texto).trim());
          else val = texto;
          if (alvo.indices) this.setIndice(escopo, alvo.nome, alvo.indices.map(i => this.avaliarSync(i, escopo)), val, st.line);
          else escopo.set(alvo.nome, val, st.line);
        }
        yield* this.tick(st.line, escopo);
        break;
      }
      case 'Escreva': {
        const partes = st.args.map(a => formatValor(this.avaliarSync(a, escopo)));
        this.io.escrever(partes.join('') + (st.nl ? '\n' : ''));
        yield* this.tick(st.line, escopo);
        break;
      }
      case 'Se': {
        yield* this.tick(st.line, escopo);
        const c = this.avaliarSync(st.cond, escopo);
        if (c) yield* this.execBloco(st.thenB, escopo); else yield* this.execBloco(st.elseB, escopo);
        break;
      }
      case 'Enquanto': {
        for (;;) {
          yield* this.tick(st.line, escopo);
          if (!this.avaliarSync(st.cond, escopo)) break;
          yield* this.execBloco(st.corpo, escopo);
        }
        break;
      }
      case 'Repita': {
        for (;;) {
          yield* this.execBloco(st.corpo, escopo);
          yield* this.tick(st.line, escopo);
          if (this.avaliarSync(st.cond, escopo)) break;
        }
        break;
      }
      case 'Para': {
        const de = this.avaliarSync(st.de, escopo);
        const ate = this.avaliarSync(st.ate, escopo);
        const passo = st.passo ? this.avaliarSync(st.passo, escopo) : 1;
        if (!escopo.existeLocal(st.varName) && !escopo.resolver(st.varName)) escopo.declarar(st.varName, { kind:'escalar', base:'inteiro' });
        for (let v = de; passo > 0 ? v <= ate : v >= ate; v += passo) {
          escopo.set(st.varName, v, st.line);
          yield* this.tick(st.line, escopo);
          yield* this.execBloco(st.corpo, escopo);
        }
        break;
      }
      case 'Escolha': {
        yield* this.tick(st.line, escopo);
        const alvo = this.avaliarSync(st.alvo, escopo);
        let feito = false;
        for (const c of st.casos) {
          if (c.valores.some(v => this.avaliarSync(v, escopo) === alvo)) { yield* this.execBloco(c.corpo, escopo); feito = true; break; }
        }
        if (!feito && st.outro) yield* this.execBloco(st.outro, escopo);
        break;
      }
      case 'ChamadaStmt': {
        yield* this.tick(st.line, escopo);
        this.chamarSub(st.nome, st.args, escopo, st.line);
        break;
      }
      case 'Retorne': {
        yield* this.tick(st.line, escopo);
        throw new RetornoSignal(st.expr ? this.avaliarSync(st.expr, escopo) : null);
      }
      default:
        throw new LangError(`comando não suportado: ${st.type}`, st.line);
    }
  }

  setIndice(escopo, nome, idx, valor, line) {
    const e = escopo.resolver(nome);
    if (!e) throw new LangError(`variável "${nome}" não foi declarada`, line);
    const v = e.vars.get(nome.toLowerCase());
    const tipo = e.tipos.get(nome.toLowerCase());
    v.data.set(idx.join(','), coerce(tipo.base, valor));
  }
  getIndice(escopo, nome, idx, line) {
    const e = escopo.resolver(nome);
    if (!e) throw new LangError(`variável "${nome}" não foi declarada`, line);
    const v = e.vars.get(nome.toLowerCase());
    if (!v || !v.__vetor) throw new LangError(`"${nome}" não é um vetor`, line);
    const key = idx.join(',');
    return v.data.has(key) ? v.data.get(key) : defaultValue({ kind:'escalar', base: v.tipo.base });
  }

  chamarSub(nome, argExprs, escopoChamador, line) {
    const sub = this.subs.get(nome.toLowerCase());
    if (!sub) {
      const fn = this.lib[nome.toLowerCase()];
      if (fn) return fn(...argExprs.map(a => this.avaliarSync(a, escopoChamador)));
      throw new LangError(`função/procedimento "${nome}" não foi declarado`, line);
    }
    const escopoSub = new Escopo(this.global);
    sub.params.forEach((p, i) => {
      escopoSub.declarar(p.nome, p.tipo);
      const val = i < argExprs.length ? this.avaliarSync(argExprs[i], escopoChamador) : defaultValue(p.tipo);
      escopoSub.vars.set(p.nome.toLowerCase(), p.tipo.kind === 'vetor' ? val : coerce(p.tipo.base, val));
    });
    this.declararBloco(escopoSub, sub.decls);
    this.pilha.push(sub.nome);
    let retorno = null;
    try {
      const it = this.execBloco(sub.corpo, escopoSub);
      let r = it.next();
      while (!r.done) r = it.next();
    } catch (sig) {
      if (sig instanceof RetornoSignal) retorno = sig.valor;
      else { this.pilha.pop(); throw sig; }
    }
    this.pilha.pop();
    return retorno;
  }

  avaliarSync(node, escopo) {
    switch (node.type) {
      case 'Num': return node.value;
      case 'Str': return node.value;
      case 'Bool': return node.value;
      case 'Id': return escopo.get(node.nome, node.line);
      case 'Indice': return this.getIndice(escopo, node.nome, node.idx.map(i => this.avaliarSync(i, escopo)), node.line);
      case 'Chamada': return this.chamarSub(node.nome, node.args, escopo, node.line);
      case 'Un': {
        const v = this.avaliarSync(node.e, escopo);
        if (node.op === '-') return -v;
        if (node.op === 'nao') return !v;
        break;
      }
      case 'Bin': {
        const op = node.op;
        const l = this.avaliarSync(node.l, escopo);
        if (op === 'e' && !l) return false;
        if (op === 'ou' && l) return true;
        const r = this.avaliarSync(node.r, escopo);
        switch (op) {
          case '+': return (typeof l === 'string' || typeof r === 'string') ? formatValor(l) + formatValor(r) : l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
          case 'div': return Math.trunc(l / r);
          case 'mod': return l % r;
          case '^': return Math.pow(l, r);
          case '=': return l === r;
          case '<>': return l !== r;
          case '>': return l > r;
          case '<': return l < r;
          case '>=': return l >= r;
          case '<=': return l <= r;
          case 'e': return !!(l && r);
          case 'ou': return !!(l || r);
        }
      }
    }
    throw new LangError(`expressão inválida (${node.type})`, node.line);
  }
}

const PORTUGOL_API = { tokenize, parse, LangError, Interpretador, formatValor, KEYWORDS, BLOCK_OPENERS, BLOCK_CLOSERS };
if (typeof module !== 'undefined' && module.exports) module.exports = PORTUGOL_API;
if (typeof window !== 'undefined') window.PORTUGOL = PORTUGOL_API;