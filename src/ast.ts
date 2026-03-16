export type Node =
  | { kind: 'Program'; body: Node[] }
  | { kind: 'Let'; name: string; value: Node }
  | { kind: 'Assign'; name: string; value: Node }
  | { kind: 'IndexAssign'; obj: Node; index: Node; value: Node }
  | { kind: 'MemberAssign'; obj: Node; prop: string; value: Node }
  | { kind: 'Fn'; name: string; params: string[]; body: Node[] }
  | { kind: 'Return'; value: Node | null }
  | { kind: 'Break' }
  | { kind: 'Continue' }
  | { kind: 'If'; cond: Node; then: Node[]; else_: Node[] }
  | { kind: 'While'; cond: Node; body: Node[] }
  | { kind: 'For'; var: string; iter: Node; body: Node[] }
  | { kind: 'Call'; callee: Node; args: Node[] }
  | { kind: 'MethodCall'; obj: Node; method: string; args: Node[] }
  | { kind: 'Index'; obj: Node; index: Node }
  | { kind: 'Member'; obj: Node; prop: string }
  | { kind: 'Binary'; op: string; left: Node; right: Node }
  | { kind: 'Unary'; op: string; expr: Node }
  | { kind: 'Ternary'; cond: Node; then: Node; else_: Node }
  | { kind: 'Ident'; name: string }
  | { kind: 'Num'; value: number }
  | { kind: 'Str'; value: string }
  | { kind: 'Bool'; value: boolean }
  | { kind: 'Array'; elements: Node[] }
  | { kind: 'Object'; pairs: { key: string; value: Node }[] }
  | { kind: 'Template'; parts: (string | Node)[] }
  | { kind: 'Lambda'; params: string[]; body: Node[] }
  | { kind: 'Null' }
