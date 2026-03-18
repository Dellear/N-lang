import { TT, Token, lex } from './lexer'
import { Node } from './ast'

export function parse(tokens: Token[]): Node {
  let i = 0

  const peek = () => tokens[i]
  const eat = (t?: TT) => {
    if (t !== undefined && tokens[i].type !== t)
      throw new Error(`Expected ${TT[t]}, got '${tokens[i].val}' at line ${tokens[i].line}`)
    return tokens[i++]
  }
  const skip = () => { while (peek().type === TT.NEWLINE) i++ }

  function parseBlock(): Node[] {
    eat(TT.LBRACE); skip()
    const stmts: Node[] = []
    while (peek().type !== TT.RBRACE && peek().type !== TT.EOF) {
      stmts.push(parseStmt()); skip()
    }
    eat(TT.RBRACE)
    return stmts
  }

  function parseStmt(): Node {
    skip()
    const t = peek()
    if (t.type === TT.IMPORT) {
      eat(); eat(TT.LBRACE)
      const names: string[] = []
      while (peek().type !== TT.RBRACE) {
        names.push(eat(TT.IDENT).val)
        if (peek().type === TT.COMMA) eat()
      }
      eat(TT.RBRACE); eat(TT.FROM)
      const path = eat(TT.STR).val
      return { kind: 'Import', names, path }
    }
    if (t.type === TT.EXPORT) {
      eat()
      const next = peek()
      if (next.type !== TT.LET && next.type !== TT.FN && next.type !== TT.CLASS)
        throw new Error(`export must be followed by let, fn, or class at line ${next.line}`)
      const stmt = parseStmt()
      return { kind: 'Export', stmt }
    }
    if (t.type === TT.LET) {
      eat(); const name = eat(TT.IDENT).val; eat(TT.EQ)
      return { kind: 'Let', name, value: parseExpr() }
    }
    if (t.type === TT.FN) {
      eat(); const name = eat(TT.IDENT).val; eat(TT.LPAREN)
      const params: string[] = []
      while (peek().type !== TT.RPAREN) {
        params.push(eat(TT.IDENT).val)
        if (peek().type === TT.COMMA) eat()
      }
      eat(TT.RPAREN)
      return { kind: 'Fn', name, params, body: parseBlock() }
    }
    if (t.type === TT.CLASS) {
      eat()
      const name = eat(TT.IDENT).val
      let parent: string | null = null
      if (peek().type === TT.EXTENDS) {
        eat()
        parent = eat(TT.IDENT).val
      }
      eat(TT.LBRACE); skip()
      const methods: { name: string; params: string[]; body: Node[] }[] = []
      while (peek().type !== TT.RBRACE && peek().type !== TT.EOF) {
        const methodName = eat(TT.IDENT).val
        eat(TT.LPAREN)
        const params: string[] = []
        while (peek().type !== TT.RPAREN) {
          params.push(eat(TT.IDENT).val)
          if (peek().type === TT.COMMA) eat()
        }
        eat(TT.RPAREN)
        const body = parseBlock()
        methods.push({ name: methodName, params, body })
        skip()
      }
      eat(TT.RBRACE)
      return { kind: 'Class', name, parent, methods }
    }
    if (t.type === TT.RETURN) {
      eat()
      const value = peek().type === TT.NEWLINE || peek().type === TT.RBRACE ? null : parseExpr()
      return { kind: 'Return', value }
    }
    if (t.type === TT.BREAK) { eat(); return { kind: 'Break' } }
    if (t.type === TT.CONTINUE) { eat(); return { kind: 'Continue' } }
    if (t.type === TT.THROW) {
      eat()
      return { kind: 'Throw', value: parseExpr() }
    }
    if (t.type === TT.TRY) {
      eat()
      const tryBody = parseBlock()
      skip()
      let catchClause: { param: string; body: Node[] } | null = null
      let finallyBody: Node[] | null = null
      if (peek().type === TT.CATCH) {
        eat(); eat(TT.LPAREN)
        const param = eat(TT.IDENT).val
        eat(TT.RPAREN)
        catchClause = { param, body: parseBlock() }
        skip()
      }
      if (peek().type === TT.FINALLY) {
        eat()
        finallyBody = parseBlock()
      }
      if (!catchClause && !finallyBody) throw new Error(`try requires catch or finally at line ${t.line}`)
      return { kind: 'Try', tryBody, catchClause, finallyBody }
    }
    if (t.type === TT.IF) {
      eat(); const cond = parseExpr(); const then = parseBlock()
      skip()
      const else_ = peek().type === TT.ELSE ? (eat(), parseBlock()) : []
      return { kind: 'If', cond, then, else_ }
    }
    if (t.type === TT.WHILE) {
      eat(); const cond = parseExpr()
      return { kind: 'While', cond, body: parseBlock() }
    }
    if (t.type === TT.FOR) {
      eat()
      const varName = eat(TT.IDENT).val
      eat(TT.IN)
      const iter = parseExpr()
      return { kind: 'For', var: varName, iter, body: parseBlock() }
    }
    // assignment or expression
    const expr = parseExpr()
    if (peek().type === TT.EQ) {
      eat()
      const value = parseExpr()
      if (expr.kind === 'Ident') return { kind: 'Assign', name: expr.name, value }
      if (expr.kind === 'Index') return { kind: 'IndexAssign', obj: expr.obj, index: expr.index, value }
      if (expr.kind === 'Member') return { kind: 'MemberAssign', obj: expr.obj, prop: expr.prop, value }
      throw new Error('Invalid assignment target')
    }
    return expr
  }

  function parseExpr(): Node { return parseTernary() }

  function parseTernary(): Node {
    const cond = parseOr()
    if (peek().type === TT.QUESTION) {
      eat()
      const then = parseOr()
      eat(TT.COLON)
      const else_ = parseTernary()
      return { kind: 'Ternary', cond, then, else_ }
    }
    return cond
  }

  function parseOr(): Node {
    let left = parseAnd()
    while (peek().type === TT.OR) { eat(); left = { kind: 'Binary', op: '||', left, right: parseAnd() } }
    return left
  }

  function parseAnd(): Node {
    let left = parseEq()
    while (peek().type === TT.AND) { eat(); left = { kind: 'Binary', op: '&&', left, right: parseEq() } }
    return left
  }

  function parseEq(): Node {
    let left = parseCmp()
    while ([TT.EQEQ, TT.NEQ].includes(peek().type)) {
      const op = eat().val; left = { kind: 'Binary', op, left, right: parseCmp() }
    }
    return left
  }

  function parseCmp(): Node {
    let left = parseAdd()
    while ([TT.LT, TT.GT, TT.LTE, TT.GTE].includes(peek().type)) {
      const op = eat().val; left = { kind: 'Binary', op, left, right: parseAdd() }
    }
    return left
  }

  function parseAdd(): Node {
    let left = parseMul()
    while ([TT.PLUS, TT.MINUS].includes(peek().type)) {
      const op = eat().val; left = { kind: 'Binary', op, left, right: parseMul() }
    }
    return left
  }

  function parseMul(): Node {
    let left = parseUnary()
    while ([TT.STAR, TT.SLASH, TT.MOD].includes(peek().type)) {
      const op = eat().val; left = { kind: 'Binary', op, left, right: parseUnary() }
    }
    return left
  }

  function parseUnary(): Node {
    if (peek().type === TT.BANG) { eat(); return { kind: 'Unary', op: '!', expr: parseUnary() } }
    if (peek().type === TT.MINUS) { eat(); return { kind: 'Unary', op: '-', expr: parseUnary() } }
    if (peek().type === TT.TYPEOF) { eat(); return { kind: 'Unary', op: 'typeof', expr: parseUnary() } }
    return parsePostfix()
  }

  function parsePostfix(): Node {
    let expr = parsePrimary()
    while (true) {
      if (peek().type === TT.LPAREN) {
        eat()
        const args: Node[] = []
        while (peek().type !== TT.RPAREN) {
          args.push(parseExpr())
          if (peek().type === TT.COMMA) eat()
        }
        eat(TT.RPAREN)
        expr = { kind: 'Call', callee: expr, args }
      } else if (peek().type === TT.LBRACKET) {
        eat(); const index = parseExpr(); eat(TT.RBRACKET)
        expr = { kind: 'Index', obj: expr, index }
      } else if (peek().type === TT.DOT) {
        eat(); const prop = eat(TT.IDENT).val
        if (peek().type === TT.LPAREN) {
          eat()
          const args: Node[] = []
          while (peek().type !== TT.RPAREN) {
            args.push(parseExpr())
            if (peek().type === TT.COMMA) eat()
          }
          eat(TT.RPAREN)
          expr = { kind: 'MethodCall', obj: expr, method: prop, args }
        } else {
          expr = { kind: 'Member', obj: expr, prop }
        }
      } else break
    }
    return expr
  }

  function parsePrimary(): Node {
    const t = peek()
    if (t.type === TT.NEW) {
      eat()
      const className = parsePrimary()
      eat(TT.LPAREN)
      const args: Node[] = []
      while (peek().type !== TT.RPAREN) {
        args.push(parseExpr())
        if (peek().type === TT.COMMA) eat()
      }
      eat(TT.RPAREN)
      return { kind: 'New', className, args }
    }
    if (t.type === TT.THIS) { eat(); return { kind: 'Ident', name: 'this' } }
    if (t.type === TT.SUPER) { eat(); return { kind: 'Ident', name: 'super' } }
    if (t.type === TT.FN) {
      eat(); eat(TT.LPAREN)
      const params: string[] = []
      while (peek().type !== TT.RPAREN) {
        params.push(eat(TT.IDENT).val)
        if (peek().type === TT.COMMA) eat()
      }
      eat(TT.RPAREN)
      return { kind: 'Lambda', params, body: parseBlock() }
    }
    if (t.type === TT.NUM) { eat(); return { kind: 'Num', value: Number(t.val) } }
    if (t.type === TT.STR) { eat(); return { kind: 'Str', value: t.val } }
    if (t.type === TT.TRUE) { eat(); return { kind: 'Bool', value: true } }
    if (t.type === TT.FALSE) { eat(); return { kind: 'Bool', value: false } }
    if (t.type === TT.NULL) { eat(); return { kind: 'Null' } }
    if (t.type === TT.IDENT) { eat(); return { kind: 'Ident', name: t.val } }
    if (t.type === TT.LBRACKET) {
      eat()
      const elements: Node[] = []
      skip()
      while (peek().type !== TT.RBRACKET) {
        elements.push(parseExpr())
        skip()
        if (peek().type === TT.COMMA) { eat(); skip() }
      }
      eat(TT.RBRACKET)
      return { kind: 'Array', elements }
    }
    if (t.type === TT.LBRACE) {
      eat(); skip()
      const pairs: { key: string; value: Node }[] = []
      while (peek().type !== TT.RBRACE && peek().type !== TT.EOF) {
        const key = peek().type === TT.STR ? eat().val : eat(TT.IDENT).val
        eat(TT.COLON)
        const value = parseExpr()
        pairs.push({ key, value })
        skip()
        if (peek().type === TT.COMMA) { eat(); skip() }
      }
      eat(TT.RBRACE)
      return { kind: 'Object', pairs }
    }
    if (t.type === TT.TEMPLATE) {
      eat()
      const parts: (string | Node)[] = []
      const raw = t.val
      let j = 0
      while (j < raw.length) {
        const start = raw.indexOf('${', j)
        if (start === -1) { if (j < raw.length) parts.push(raw.slice(j)); break }
        if (start > j) parts.push(raw.slice(j, start))
        let depth = 1, k = start + 2
        while (k < raw.length && depth > 0) {
          if (raw[k] === '{') depth++
          else if (raw[k] === '}') depth--
          k++
        }
        const exprSrc = raw.slice(start + 2, k - 1)
        const exprAst = parse(lex(exprSrc))
        if (exprAst.kind === 'Program' && exprAst.body.length > 0) parts.push(exprAst.body[0])
        j = k
      }
      return { kind: 'Template', parts }
    }
    if (t.type === TT.LPAREN) {
      eat(); const expr = parseExpr(); eat(TT.RPAREN); return expr
    }
    throw new Error(`Unexpected token '${t.val}' at line ${t.line}`)
  }

  skip()
  const body: Node[] = []
  while (peek().type !== TT.EOF) { body.push(parseStmt()); skip() }
  return { kind: 'Program', body }
}
