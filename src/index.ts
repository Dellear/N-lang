import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createInterface } from 'readline'
import { lex } from './lexer'
import { parse } from './parser'
import { interpret, Env } from './interpreter'
import { TT } from './lexer'

function run(src: string, env?: Env, filePath?: string) {
  try {
    interpret(parse(lex(src)), env, filePath)
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

// Check if input is complete by counting delimiter balance
function isComplete(src: string): boolean {
  try {
    const tokens = lex(src)
    let depth = 0
    for (const token of tokens) {
      if (token.type === TT.LBRACE || token.type === TT.LBRACKET || token.type === TT.LPAREN) {
        depth++
      }
      if (token.type === TT.RBRACE || token.type === TT.RBRACKET || token.type === TT.RPAREN) {
        depth--
      }
    }
    return depth === 0
  } catch (e) {
    // Lex error means incomplete input
    return false
  }
}

const file = process.argv[2]
if (file) {
  run(readFileSync(file, 'utf8'), undefined, resolve(file))
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'N> ' })
  const env = new Env()
  let buffer = ''
  let lineCount = 0

  rl.prompt()
  rl.on('line', line => {
    buffer += (lineCount > 0 ? '\n' : '') + line
    lineCount++

    if (isComplete(buffer)) {
      run(buffer, env)
      buffer = ''
      lineCount = 0
      rl.setPrompt('N> ')
    } else {
      rl.setPrompt('... ')
    }
    rl.prompt()
  })
}
