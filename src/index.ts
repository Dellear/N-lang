import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import { lex } from './lexer'
import { parse } from './parser'
import { interpret } from './interpreter'

function run(src: string) {
  try {
    interpret(parse(lex(src)))
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}

const file = process.argv[2]
if (file) {
  run(readFileSync(file, 'utf8'))
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'N> ' })
  rl.prompt()
  rl.on('line', line => { run(line); rl.prompt() })
}
