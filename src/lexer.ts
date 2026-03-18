export enum TT {
  NUM, STR, IDENT, TRUE, FALSE, NULL,
  LET, FN, RETURN, IF, ELSE, WHILE, FOR, IN,
  BREAK, CONTINUE, TYPEOF,
  CLASS, EXTENDS, NEW, SUPER, THIS,
  TRY, CATCH, FINALLY, THROW,
  IMPORT, EXPORT, FROM,
  PLUS, MINUS, STAR, SLASH, MOD,
  EQ, EQEQ, NEQ, LT, GT, LTE, GTE,
  BANG, AND, OR,
  QUESTION, COLON,
  LPAREN, RPAREN, LBRACE, RBRACE, LBRACKET, RBRACKET,
  COMMA, DOT,
  TEMPLATE,
  NEWLINE, EOF
}

export interface Token { type: TT; val: string; line: number }

const KW: Record<string, TT> = Object.create(null)
KW['let'] = TT.LET; KW['fn'] = TT.FN; KW['return'] = TT.RETURN
KW['if'] = TT.IF; KW['else'] = TT.ELSE; KW['while'] = TT.WHILE
KW['for'] = TT.FOR; KW['in'] = TT.IN
KW['break'] = TT.BREAK; KW['continue'] = TT.CONTINUE; KW['typeof'] = TT.TYPEOF
KW['class'] = TT.CLASS; KW['extends'] = TT.EXTENDS; KW['new'] = TT.NEW; KW['super'] = TT.SUPER; KW['this'] = TT.THIS
KW['try'] = TT.TRY; KW['catch'] = TT.CATCH; KW['finally'] = TT.FINALLY; KW['throw'] = TT.THROW
KW['import'] = TT.IMPORT; KW['export'] = TT.EXPORT; KW['from'] = TT.FROM
KW['true'] = TT.TRUE; KW['false'] = TT.FALSE; KW['null'] = TT.NULL

export function lex(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0, line = 1

  while (i < src.length) {
    const c = src[i]
    if (c === '\n') { tokens.push({ type: TT.NEWLINE, val: '\n', line }); line++; i++; continue }
    if (' \t\r'.includes(c)) { i++; continue }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }

    if (c === '`') {
      const startLine = line
      let raw = ''; i++
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\n') line++
        if (src[i] === '\\') {
          i++
          raw += src[i] === 'n' ? '\n' : src[i] === 't' ? '\t' : src[i]
        } else {
          raw += src[i]
        }
        i++
      }
      if (i >= src.length) throw new Error(`Unclosed template literal at line ${startLine}`)
      i++; tokens.push({ type: TT.TEMPLATE, val: raw, line }); continue
    }

    if (c === '"') {
      const startLine = line
      let s = ''; i++
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') { i++; s += src[i] === 'n' ? '\n' : src[i] === 't' ? '\t' : src[i] }
        else s += src[i]
        i++
      }
      if (i >= src.length) throw new Error(`Unclosed string at line ${startLine}`)
      i++; tokens.push({ type: TT.STR, val: s, line }); continue
    }

    if (/\d/.test(c)) {
      let n = ''
      while (i < src.length && /[\d.]/.test(src[i])) n += src[i++]
      tokens.push({ type: TT.NUM, val: n, line }); continue
    }

    if (/[a-zA-Z_]/.test(c)) {
      let id = ''
      while (i < src.length && /\w/.test(src[i])) id += src[i++]
      tokens.push({ type: KW[id] ?? TT.IDENT, val: id, line }); continue
    }

    const two = src.slice(i, i + 2)
    const twoMap: Record<string, TT> = { '==': TT.EQEQ, '!=': TT.NEQ, '<=': TT.LTE, '>=': TT.GTE, '&&': TT.AND, '||': TT.OR }
    if (twoMap[two] !== undefined) { tokens.push({ type: twoMap[two], val: two, line }); i += 2; continue }

    const oneMap: Record<string, TT> = {
      '+': TT.PLUS, '-': TT.MINUS, '*': TT.STAR, '/': TT.SLASH, '%': TT.MOD,
      '=': TT.EQ, '<': TT.LT, '>': TT.GT, '!': TT.BANG,
      '?': TT.QUESTION, ':': TT.COLON,
      '(': TT.LPAREN, ')': TT.RPAREN, '{': TT.LBRACE, '}': TT.RBRACE,
      '[': TT.LBRACKET, ']': TT.RBRACKET, ',': TT.COMMA, '.': TT.DOT
    }
    if (oneMap[c] !== undefined) { tokens.push({ type: oneMap[c], val: c, line }); i++; continue }

    throw new Error(`Unknown character '${c}' at line ${line}`)
  }

  tokens.push({ type: TT.EOF, val: '', line })
  return tokens
}
