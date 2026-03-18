# 23. 模块系统 (import/export)

## 功能
支持 JS 风格的 import/export 语法，允许跨文件组织代码。

## 语法
```n
// math.n
export let PI = 3.14159
export fn square(x) { return x * x }
export class Vector { ... }

// main.n
import { PI, square, Vector } from "math.n"
```

## 实现

### 词法分析 (lexer.ts)
- 新增 3 个 token 类型: `IMPORT`, `EXPORT`, `FROM`
- 新增 3 个关键字: `import`, `export`, `from`

### 语法分析 (parser.ts)
- `Import` 节点: `{ kind: 'Import'; names: string[]; path: string }`
- `Export` 节点: `{ kind: 'Export'; stmt: Node }` (包裹 Let/Fn/Class)

### 解释器 (interpreter.ts)
- 模块级状态:
  - `moduleCache`: 缓存已加载模块的导出
  - `loadingModules`: 检测循环导入
  - `currentExports`: 收集当前模块的导出

- `loadModule()`: 加载模块文件
  1. 解析绝对路径
  2. 检查缓存/循环导入
  3. 读取文件 → lex → parse
  4. 创建模块环境并执行
  5. 缓存导出并返回

- `Export` case: 执行内部语句，将导出名存入 `currentExports`
- `Import` case: 调用 `loadModule()`，将导出绑定到当前环境

### 入口 (index.ts)
- 文件模式: 传递 `resolve(file)` 作为 `filePath` 参数
- REPL 模式: 不支持 import (抛出错误)

## 测试
```n
// test_module.n
export let PI = 3.14159
export fn square(x) { return x * x }
export class Vector { ... }

// test.n
import { PI, square, Vector } from "test_module.n"
print("PI:", PI)                    // 3.14159
print("square(5):", square(5))      // 25
let v = new Vector(3, 4)
print("v.magnitude:", v.magnitude()) // 5

// 多次 import 验证缓存
import { PI } from "test_module.n"
print("cached PI:", PI)             // 3.14159
```

## 特性
- ✅ 相对路径解析
- ✅ 模块缓存 (同一文件只执行一次)
- ✅ 循环导入检测
- ✅ 导出变量/函数/类
- ✅ 选择性导入
