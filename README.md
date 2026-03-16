# N-lang

一个用 TypeScript 实现的轻量级脚本语言，语法风格类似 JavaScript。

> 说明：本项目的大部分代码由 AI 辅助生成，作者负责需求定义、方向把控、测试验证与最终审阅。

## 特性

- 数字、字符串、布尔值、null、数组、对象
- 变量声明与赋值、索引/属性赋值
- 算术、比较、逻辑运算符
- `if / else`、`while`、`for..in`
- `break` / `continue`
- 三元运算符 `cond ? a : b`
- 模板字符串 `` `Hello ${name}` ``
- `typeof` 运算符
- 具名函数、匿名函数（lambda）、闭包、递归
- 丰富的字符串 / 数组内置方法
- 对象字面量及 `keys` / `values` / `entries` / `has` / `delete`
- `Math` 内置对象
- `Date` 内置对象与日期比较、日期差值
- 全局工具函数：`print` `len` `str` `num` `bool` `range`

## 快速开始

### 一个最小示例

```n
let x = 1 + 6
print(x)
```

### 环境要求

本项目使用 [Bun](https://bun.sh/) 作为运行时和构建工具。

```bash
# 安装 Bun (如果尚未安装)
curl -fsSL https://bun.sh/install | bash
```

### 安装依赖

```bash
bun install
```

### 运行脚本

**直接运行（开发模式）**:

```bash
bun run src/index.ts your_script.n
# 或
npm start
```

**运行文件**:

```bash
bun run src/index.ts your_script.n
```

**REPL 模式**:

```bash
bun run src/index.ts
```

## Date 用法

```n
let now = Date()
print(typeof now)
print(now.timestamp)
print(now.format())

let a = Date("2026-03-13T00:00:00Z")
let b = Date("2026-03-14T00:00:00Z")
print(a < b)
print(b - a)

let c = Date(Date.now())
print(c.year)
print(c.month)
print(c.day)
```

当前支持：
- `Date()`、`Date(string)`、`Date(number)`
- `Date.now()`、`Date.parse(string)`
- 实例属性：`timestamp` `year` `month` `day` `hours` `minutes` `seconds`
- 实例方法：`format()` `toString()` `getTime()` `getFullYear()` `getMonth()` `getDate()` `getHours()` `getMinutes()` `getSeconds()` `addDays(number)`

## 构建

### 编译为 JavaScript

```bash
bun run build
node dist/n.js your_script.n
```

### 编译为二进制可执行文件

```bash
bun run build:exe
```

说明：
- 构建命令使用 `bun build --compile --outfile dist/n`。
- 在 Linux / macOS 下，产物通常为 `dist/n`。
- 在 Windows 下，产物通常为 `dist/n.exe`。
- 二进制文件是按当前构建平台生成的；如果在 Linux 上执行构建，得到的是 Linux 可执行文件，不是 Windows `.exe`。

运行示例：

```bash
# Linux / macOS
./dist/n your_script.n

# Windows
./dist/n.exe your_script.n
```

生成的二进制文件可直接分发使用，无需依赖 Node.js 或 Bun。
