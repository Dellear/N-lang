import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import { lex } from './lexer'
import { parse } from './parser'
import { interpret, Env } from './interpreter'

function run(src: string, env?: Env) {
  try {
    interpret(parse(lex(src)), env)
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

const file = process.argv[2]
if (file) {
  run(readFileSync(file, 'utf8'))
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'N> ' })
  const env = new Env()
  rl.prompt()
  rl.on('line', line => { run(line, env); rl.prompt() })
}
