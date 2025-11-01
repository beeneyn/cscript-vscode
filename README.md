# CScript Language Support for VS Code

Provides comprehensive language support for CScript - the hybrid programming language that combines the best features of JavaScript, TypeScript, C, C++, and C#.

## Features

### 🎨 Syntax Highlighting
- Complete syntax highlighting for all CScript features
- Special highlighting for pipeline operators (`|>`)
- Pattern matching syntax in `match` expressions
- LINQ query keywords (`from`, `where`, `select`, etc.)
- Operator overloading methods (`$operator_plus`, etc.)

### ⚡ Language Features
- **Pipeline Operators**: `|>` for functional composition
- **Match Expressions**: Pattern matching with ranges and wildcards
- **Immutable Updates**: `withUpdate()` syntax support
- **LINQ Queries**: Multiple query syntax styles
- **Operator Overloading**: Custom operators for user-defined types
- **Enhanced Type System**: Runtime validation and inference

### 🛠️ Development Tools
- **Auto-transpilation**: Automatically transpile `.csc` files on save
- **Build Integration**: Transpile and run CScript files directly in VS Code
- **Custom Icons**: Special file icons for `.csc` and `csconfig.json` files
- **JSON Schema**: IntelliSense and validation for `csconfig.json` configuration
- **Keyboard Shortcuts**:
  - `Ctrl+Shift+T`: Transpile current CScript file
  - `Ctrl+Shift+R`: Run current CScript file
- **Terminal Integration**: Run transpiled JavaScript in integrated terminal

## Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "CScript Language Support"
4. Click Install

## Usage

1. Create a new file with `.csc` extension
2. Start writing CScript code with full syntax highlighting
3. Use `Ctrl+Shift+T` to transpile or `Ctrl+Shift+R` to run
4. Enjoy the power of hybrid programming!

### Example CScript Code

```cscript
// Pipeline operators with LINQ
let result = users
  |> (data => from(data))
  |> (q => q.where(u => u.active))
  |> (q => q.select(u => u.name))
  |> (q => q.toArray());

// Match expressions
let category = user.age.match({
  "0..17": "minor",
  "18..64": "adult",
  "65..120": "senior",
  _: "unknown"
});

// Operator overloading
class Vector {
  static $operator_plus(left, right) {
    return new Vector(left.x + right.x, left.y + right.y);
  }
}

let v3 = v1 + v2; // Uses operator overloading
```

## Configuration

### VS Code Settings
Available settings:

- `cscript.transpiler.outputPath`: Output directory for transpiled files (default: `./build`)
- `cscript.transpiler.autoTranspile`: Auto-transpile on save (default: `true`)
- `cscript.debug.enableLogging`: Enable debug logging (default: `false`)

### CScript Configuration
Create a `csconfig.json` file in your project root to customize CScript behavior:

```json
{
  "languageFeatures": {
    "pipelineOperators": true,
    "matchExpressions": true,
    "linqQueries": true,
    "operatorOverloading": true
  },
  "compilerOptions": {
    "target": "ES2020",
    "sourceMap": true
  }
}
```

The extension provides full IntelliSense and validation for `csconfig.json` files, including:
- Auto-completion for all configuration options
- Documentation on hover
- Error highlighting for invalid values
- Custom file icon for easy identification

## Requirements

- Node.js 16+ installed
- CScript transpiler in your project workspace

## Known Issues

- Requires CScript transpiler to be present in workspace
- Terminal integration may vary by OS

## Release Notes

### 1.0.0

Initial release with complete CScript language support:
- Syntax highlighting for all language features
- Build integration and transpilation
- Auto-completion and error detection
- Keyboard shortcuts and commands

## Contributing

Found a bug or want to contribute? Visit our [GitHub repository](https://github.com/beeneyn/cscript).

## License

MIT License - see LICENSE file for details.

---

**Enjoy coding with CScript! 🚀**