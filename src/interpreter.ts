import { Node } from './ast'

class NArray { constructor(public items: Value[]) {} }
class NObject { constructor(public props: Map<string, Value>) {} }
class NMath {}
class NDateCtor {}
class NDate { constructor(public value: Date) {} }
class NClass { constructor(public name: string, public parent: NClass | null, public methods: Map<string, { params: string[]; body: Node[] }>, public env: Env) {} }
class NInstance { constructor(public klass: NClass, public props: Map<string, Value>) {} }
type Value = number | string | boolean | null | NFunc | NArray | NObject | NMath | NDateCtor | NDate | NClass | NInstance
interface NFunc { params: string[]; body: Node[]; env: Env }
class ReturnSignal { constructor(public value: Value) {} }
class BreakSignal {}
class ContinueSignal {}

export class Env {
  vars = new Map<string, Value>()
  constructor(public parent?: Env) {}
  get(name: string): Value {
    if (this.vars.has(name)) return this.vars.get(name)!
    if (this.parent) return this.parent.get(name)
    throw new Error(`Undefined variable '${name}'`)
  }
  set(name: string, val: Value) {
    if (this.vars.has(name)) { this.vars.set(name, val); return }
    if (this.parent?.has(name)) { this.parent.set(name, val); return }
    throw new Error(`Undefined variable '${name}'`)
  }
  has(name: string): boolean { return this.vars.has(name) || (this.parent?.has(name) ?? false) }
  def(name: string, val: Value) { this.vars.set(name, val) }
}

function display(v: Value): string {
  if (v === null) return 'null'
  if (v instanceof NArray) return '[' + v.items.map(display).join(', ') + ']'
  if (v instanceof NObject) {
    const entries = Array.from(v.props.entries()).map(([k, val]) => `${k}: ${display(val)}`)
    return '{' + entries.join(', ') + '}'
  }
  if (v instanceof NMath) return '[Math]'
  if (v instanceof NDateCtor) return '[Date]'
  if (v instanceof NDate) return v.value.toISOString()
  if (v instanceof NClass) return `[Class ${v.name}]`
  if (v instanceof NInstance) return `[${v.klass.name} instance]`
  if (typeof v === 'object') return '<fn>'
  return String(v)
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime())
}

function createDate(args: Value[]): NDate {
  if (args.length === 0) return new NDate(new Date())
  if (args.length !== 1) throw new Error('Date() accepts at most one argument')

  const input = args[0]
  let value: Date
  if (typeof input === 'string') value = new Date(input)
  else if (typeof input === 'number') value = new Date(input)
  else throw new Error('Date() requires a string, number, or no arguments')

  if (!isValidDate(value)) throw new Error('Invalid date input')
  return new NDate(value)
}

function dateTimestamp(value: Value): number | null {
  return value instanceof NDate ? value.value.getTime() : null
}

export function interpret(program: Node, env?: Env) {
  const global = env ?? new Env()

  function findMethod(klass: NClass | null, name: string): { params: string[]; body: Node[]; env: Env } | null {
    if (!klass) return null
    if (klass.methods.has(name)) {
      const method = klass.methods.get(name)!
      return { params: method.params, body: method.body, env: klass.env }
    }
    return findMethod(klass.parent, name)
  }

  function callFn(fn: NFunc, args: Value[]): Value {
    const local = new Env(fn.env)
    fn.params.forEach((p, i) => local.def(p, args[i] ?? null))
    try {
      let result: Value = null
      for (const s of fn.body) result = exec(s, local)
      return result
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value
      throw e
    }
  }

  function callMethod(obj: Value, method: string, args: Value[]): Value {
    if (obj instanceof NInstance) {
      const methodDef = findMethod(obj.klass, method)
      if (!methodDef) throw new Error(`${obj.klass.name} has no method '${method}'`)
      const local = new Env(methodDef.env)
      local.def('this', obj)
      local.def('__class__', obj.klass)
      methodDef.params.forEach((p, i) => local.def(p, args[i] ?? null))
      try {
        let result: Value = null
        for (const s of methodDef.body) result = exec(s, local)
        return result
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value
        throw e
      }
    }
    if (typeof obj === 'string') {
      switch (method) {
        case 'len': return obj.length
        case 'upper': return obj.toUpperCase()
        case 'lower': return obj.toLowerCase()
        case 'trim': return obj.trim()
        case 'split': return new NArray(obj.split((args[0] as string) ?? '').map(s => s as Value))
        case 'includes': return obj.includes(args[0] as string)
        case 'startsWith': return obj.startsWith(args[0] as string)
        case 'endsWith': return obj.endsWith(args[0] as string)
        case 'replace': return obj.replace(args[0] as string, args[1] as string)
        case 'slice': return obj.slice(args[0] as number, args[1] as number | undefined)
        case 'indexOf': return obj.indexOf(args[0] as string)
        case 'repeat': return obj.repeat(args[0] as number)
        case 'padStart': return obj.padStart(args[0] as number, (args[1] as string) ?? ' ')
        case 'padEnd': return obj.padEnd(args[0] as number, (args[1] as string) ?? ' ')
        default: throw new Error(`String has no method '${method}'`)
      }
    }
    if (obj instanceof NArray) {
      const fn = args[0] as NFunc
      switch (method) {
        case 'len': return obj.items.length
        case 'push': obj.items.push(args[0]); return null
        case 'pop': return obj.items.pop() ?? null
        case 'shift': return obj.items.shift() ?? null
        case 'unshift': obj.items.unshift(args[0]); return null
        case 'includes': return obj.items.some(x => x === args[0])
        case 'indexOf': return obj.items.findIndex(x => x === args[0])
        case 'join': return obj.items.map(display).join((args[0] as string) ?? ',')
        case 'reverse': obj.items.reverse(); return null
        case 'slice': return new NArray(obj.items.slice(args[0] as number, args[1] as number | undefined))
        case 'concat': {
          const other = args[0]
          const extra = other instanceof NArray ? other.items : [other]
          return new NArray([...obj.items, ...extra])
        }
        case 'sort': {
          const copy = [...obj.items]
          if (fn) copy.sort((a, b) => callFn(fn, [a, b]) as number)
          else copy.sort((a, b) => display(a) < display(b) ? -1 : display(a) > display(b) ? 1 : 0)
          return new NArray(copy)
        }
        case 'flat': {
          const depth = (args[0] as number) ?? 1
          const flatten = (arr: Value[], d: number): Value[] =>
            d === 0 ? arr : arr.reduce<Value[]>((acc, x) =>
              x instanceof NArray ? [...acc, ...flatten(x.items, d - 1)] : [...acc, x], [])
          return new NArray(flatten(obj.items, depth))
        }
        case 'map': return new NArray(obj.items.map(item => callFn(fn, [item])))
        case 'filter': return new NArray(obj.items.filter(item => callFn(fn, [item])))
        case 'reduce': {
          const init = args[1]
          const rfn = args[0] as NFunc
          return obj.items.reduce((acc, item) => callFn(rfn, [acc, item]), init)
        }
        case 'find': return obj.items.find(item => callFn(fn, [item])) ?? null
        case 'every': return obj.items.every(item => callFn(fn, [item]))
        case 'some': return obj.items.some(item => callFn(fn, [item]))
        default: throw new Error(`Array has no method '${method}'`)
      }
    }
    if (obj instanceof NObject) {
      switch (method) {
        case 'keys': return new NArray(Array.from(obj.props.keys()) as Value[])
        case 'values': return new NArray(Array.from(obj.props.values()))
        case 'entries': return new NArray(
          Array.from(obj.props.entries()).map(([k, v]) => new NArray([k, v]))
        )
        case 'has': return obj.props.has(args[0] as string)
        case 'delete': obj.props.delete(args[0] as string); return null
        default: throw new Error(`Object has no method '${method}'`)
      }
    }
    if (obj instanceof NMath) {
      switch (method) {
        case 'floor': return Math.floor(args[0] as number)
        case 'ceil': return Math.ceil(args[0] as number)
        case 'round': return Math.round(args[0] as number)
        case 'abs': return Math.abs(args[0] as number)
        case 'sqrt': return Math.sqrt(args[0] as number)
        case 'pow': return Math.pow(args[0] as number, args[1] as number)
        case 'max': return Math.max(...args as number[])
        case 'min': return Math.min(...args as number[])
        case 'random': return Math.random()
        case 'log': return Math.log(args[0] as number)
        default: throw new Error(`Math has no method '${method}'`)
      }
    }
    if (obj instanceof NDateCtor) {
      switch (method) {
        case 'now': return Date.now()
        case 'parse': {
          const input = args[0]
          if (typeof input !== 'string') throw new Error('Date.parse() requires a string')
          return Date.parse(input)
        }
        default: throw new Error(`Date has no method '${method}'`)
      }
    }
    if (obj instanceof NDate) {
      switch (method) {
        case 'format': return obj.value.toISOString()
        case 'toString': return obj.value.toString()
        case 'getTime': return obj.value.getTime()
        case 'getFullYear': return obj.value.getFullYear()
        case 'getMonth': return obj.value.getMonth() + 1
        case 'getDate': return obj.value.getDate()
        case 'getHours': return obj.value.getHours()
        case 'getMinutes': return obj.value.getMinutes()
        case 'getSeconds': return obj.value.getSeconds()
        case 'addDays': {
          const amount = args[0]
          if (typeof amount !== 'number') throw new Error('date.addDays() requires a number')
          obj.value.setDate(obj.value.getDate() + amount)
          return obj
        }
        default: throw new Error(`Date has no method '${method}'`)
      }
    }
    throw new Error(`Value has no method '${method}'`)
  }

  global.def('Math', new NMath())
  global.def('Date', new NDateCtor())

  function exec(node: Node, env: Env): Value {
    switch (node.kind) {
      case 'Program': { let v: Value = null; for (const s of node.body) v = exec(s, env); return v }
      case 'Num': return node.value
      case 'Str': return node.value
      case 'Bool': return node.value
      case 'Null': return null
      case 'Array': return new NArray(node.elements.map(e => exec(e, env)))
      case 'Object': {
        const props = new Map<string, Value>()
        for (const { key, value } of node.pairs) props.set(key, exec(value, env))
        return new NObject(props)
      }
      case 'Template': {
        return node.parts.map(p => typeof p === 'string' ? p : display(exec(p, env))).join('')
      }
      case 'Ident': return env.get(node.name)
      case 'Let': { const v = exec(node.value, env); env.def(node.name, v); return v }
      case 'Assign': { const v = exec(node.value, env); env.set(node.name, v); return v }
      case 'IndexAssign': {
        const obj = exec(node.obj, env)
        const idx = exec(node.index, env) as number
        const val = exec(node.value, env)
        if (obj instanceof NArray) { obj.items[idx] = val; return val }
        if (obj instanceof NObject) { obj.props.set(String(idx), val); return val }
        throw new Error('Index assignment only supported on arrays/objects')
      }
      case 'MemberAssign': {
        const obj = exec(node.obj, env)
        const val = exec(node.value, env)
        if (obj instanceof NObject) { obj.props.set(node.prop, val); return val }
        if (obj instanceof NInstance) { obj.props.set(node.prop, val); return val }
        throw new Error('Member assignment only supported on objects')
      }
      case 'Index': {
        const obj = exec(node.obj, env)
        const idx = exec(node.index, env)
        if (obj instanceof NArray) return obj.items[idx as number] ?? null
        if (obj instanceof NObject) return obj.props.get(String(idx)) ?? null
        if (typeof obj === 'string') return (obj as string)[idx as number] ?? null
        throw new Error('Index only supported on arrays, objects and strings')
      }
      case 'Member': {
        const obj = exec(node.obj, env)
        if (node.prop === 'len') {
          if (typeof obj === 'string') return obj.length
          if (obj instanceof NArray) return obj.items.length
        }
        if (obj instanceof NObject) return obj.props.get(node.prop) ?? null
        if (obj instanceof NInstance) return obj.props.get(node.prop) ?? null
        if (obj instanceof NMath) {
          if (node.prop === 'PI') return Math.PI
          if (node.prop === 'E') return Math.E
          throw new Error(`Math.${node.prop} is not a property`)
        }
        if (obj instanceof NDate) {
          switch (node.prop) {
            case 'timestamp': return obj.value.getTime()
            case 'year': return obj.value.getFullYear()
            case 'month': return obj.value.getMonth() + 1
            case 'day': return obj.value.getDate()
            case 'hours': return obj.value.getHours()
            case 'minutes': return obj.value.getMinutes()
            case 'seconds': return obj.value.getSeconds()
            default: throw new Error(`Date.${node.prop} is not a property`)
          }
        }
        throw new Error(`Unknown property '${node.prop}'`)
      }
      case 'MethodCall': {
        const obj = exec(node.obj, env)
        const args = node.args.map(a => exec(a, env))
        return callMethod(obj, node.method, args)
      }
      case 'Lambda': return { params: node.params, body: node.body, env }
      case 'Fn': {
        const fn: NFunc = { params: node.params, body: node.body, env }
        env.def(node.name, fn); return fn
      }
      case 'Class': {
        const parent = node.parent ? env.get(node.parent) as NClass : null
        const methods = new Map<string, { params: string[]; body: Node[] }>()
        for (const m of node.methods) {
          methods.set(m.name, { params: m.params, body: m.body })
        }
        const klass = new NClass(node.name, parent, methods, env)
        env.def(node.name, klass)
        return klass
      }
      case 'New': {
        const klass = exec(node.className, env) as NClass
        const instance = new NInstance(klass, new Map())
        const ctor = findMethod(klass, 'constructor')
        if (ctor) {
          const args = node.args.map(a => exec(a, env))
          const local = new Env(ctor.env)
          local.def('this', instance)
          local.def('__class__', klass)
          ctor.params.forEach((p, i) => local.def(p, args[i] ?? null))
          try {
            for (const s of ctor.body) exec(s, local)
          } catch (e) {
            if (!(e instanceof ReturnSignal)) throw e
          }
        }
        return instance
      }
      case 'Return': throw new ReturnSignal(node.value ? exec(node.value, env) : null)
      case 'Break': throw new BreakSignal()
      case 'Continue': throw new ContinueSignal()
      case 'If': {
        const cond = exec(node.cond, env)
        const branch = cond ? node.then : node.else_
        const local = new Env(env)
        for (const s of branch) exec(s, local)
        return null
      }
      case 'While': {
        outer: while (exec(node.cond, env)) {
          const local = new Env(env)
          try { for (const s of node.body) exec(s, local) }
          catch (e) {
            if (e instanceof BreakSignal) break outer
            if (e instanceof ContinueSignal) continue outer
            throw e
          }
        }
        return null
      }
      case 'For': {
        const iter = exec(node.iter, env)
        const items = iter instanceof NArray ? iter.items
          : typeof iter === 'string' ? iter.split('') as Value[]
          : (() => { throw new Error('for..in requires array or string') })()
        outer: for (const item of items) {
          const local = new Env(env)
          local.def(node.var, item)
          try { for (const s of node.body) exec(s, local) }
          catch (e) {
            if (e instanceof BreakSignal) break outer
            if (e instanceof ContinueSignal) continue outer
            throw e
          }
        }
        return null
      }
      case 'Ternary': {
        const cond = exec(node.cond, env)
        return exec(cond ? node.then : node.else_, env)
      }
      case 'Unary': {
        if (node.op === 'typeof') {
          const v = exec(node.expr, env)
          if (v === null) return 'null'
          if (v instanceof NArray) return 'array'
          if (v instanceof NObject) return 'object'
          if (v instanceof NDate) return 'date'
          if (v instanceof NClass) return 'class'
          if (v instanceof NInstance) return 'object'
          if (typeof v === 'object') return 'function'
          return typeof v
        }
        const v = exec(node.expr, env)
        if (node.op === '!') return !v
        if (node.op === '-') return -(v as number)
        return null
      }
      case 'Binary': {
        const l = exec(node.left, env), r = exec(node.right, env)
        const lDate = dateTimestamp(l)
        const rDate = dateTimestamp(r)
        switch (node.op) {
          case '+': return typeof l === 'string' || typeof r === 'string'
            ? display(l) + display(r) : (l as number) + (r as number)
          case '-': {
            if (lDate !== null && rDate !== null) return lDate - rDate
            return (l as number) - (r as number)
          }
          case '*': return (l as number) * (r as number)
          case '/': return (l as number) / (r as number)
          case '%': return (l as number) % (r as number)
          case '==': return lDate !== null && rDate !== null ? lDate === rDate : l === r
          case '!=': return lDate !== null && rDate !== null ? lDate !== rDate : l !== r
          case '<': return lDate !== null && rDate !== null ? lDate < rDate : (l as number) < (r as number)
          case '>': return lDate !== null && rDate !== null ? lDate > rDate : (l as number) > (r as number)
          case '<=': return lDate !== null && rDate !== null ? lDate <= rDate : (l as number) <= (r as number)
          case '>=': return lDate !== null && rDate !== null ? lDate >= rDate : (l as number) >= (r as number)
          case '&&': return l && r
          case '||': return l || r
        }
        return null
      }
      case 'Call': {
        if (node.callee.kind === 'Ident') {
          const name = node.callee.name
          if (name === 'super') {
            const args = node.args.map(a => exec(a, env))
            const instance = env.get('this') as NInstance
            const currentClass = env.get('__class__') as NClass
            const parentClass = currentClass.parent
            if (!parentClass) throw new Error('super() called but no parent class')
            const ctor = findMethod(parentClass, 'constructor')
            if (ctor) {
              const local = new Env(ctor.env)
              local.def('this', instance)
              local.def('__class__', parentClass)
              ctor.params.forEach((p, i) => local.def(p, args[i] ?? null))
              try {
                for (const s of ctor.body) exec(s, local)
              } catch (e) {
                if (!(e instanceof ReturnSignal)) throw e
              }
            }
            return null
          }
          const args = node.args.map(a => exec(a, env))
          if (name === 'print') { console.log(args.map(display).join(' ')); return null }
          if (name === 'Date') return createDate(args)
          if (name === 'len') {
            const v = args[0]
            if (typeof v === 'string') return v.length
            if (v instanceof NArray) return v.items.length
            throw new Error('len() requires string or array')
          }
          if (name === 'str') return display(args[0])
          if (name === 'num') return Number(args[0])
          if (name === 'bool') return Boolean(args[0])
          if (name === 'range') {
            const [a, b, step = 1] = args as number[]
            const result: Value[] = []
            for (let n = a; n < b; n += step) result.push(n)
            return new NArray(result)
          }
          if (name === 'keys') {
            const v = args[0]
            if (v instanceof NObject) return new NArray(Array.from(v.props.keys()) as Value[])
            throw new Error('keys() requires object')
          }
          if (name === 'values') {
            const v = args[0]
            if (v instanceof NObject) return new NArray(Array.from(v.props.values()))
            throw new Error('values() requires object')
          }
          if (name === 'entries') {
            const v = args[0]
            if (v instanceof NObject) return new NArray(
              Array.from(v.props.entries()).map(([k, val]) => new NArray([k, val]))
            )
            throw new Error('entries() requires object')
          }
          if (name === 'floor') return Math.floor(args[0] as number)
          if (name === 'ceil') return Math.ceil(args[0] as number)
          if (name === 'round') return Math.round(args[0] as number)
          if (name === 'abs') return Math.abs(args[0] as number)
          if (name === 'sqrt') return Math.sqrt(args[0] as number)
          if (name === 'pow') return Math.pow(args[0] as number, args[1] as number)
          if (name === 'max') return Math.max(...args as number[])
          if (name === 'min') return Math.min(...args as number[])
          if (name === 'random') return Math.random()
          if (name === 'log') return Math.log(args[0] as number)
        }
        const callee = exec(node.callee, env)
        const args2 = node.args.map(a => exec(a, env))
        return callFn(callee as NFunc, args2)
      }
    }
  }

  exec(program, global)
}
