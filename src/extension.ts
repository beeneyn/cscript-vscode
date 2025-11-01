import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

// Import our transpiler
const transpilerPath = path.join(__dirname, '../../transpile.js');

// Diagnostic collection for syntax errors
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('CScript extension is now active!');

    // Create diagnostic collection
    diagnosticCollection = vscode.languages.createDiagnosticCollection('cscript');
    context.subscriptions.push(diagnosticCollection);

    // Register diagnostic provider
    const diagnosticProvider = new CScriptDiagnosticProvider();
    
    // Check syntax on file open and change
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'cscript') {
            diagnosticProvider.updateDiagnostics(document);
        }
    });
    
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'cscript') {
            const config = vscode.workspace.getConfiguration('cscript');
            if (config.get('diagnostics.checkOnType', true)) {
                // Debounce syntax checking
                clearTimeout(diagnosticProvider.timeout);
                diagnosticProvider.timeout = setTimeout(() => {
                    diagnosticProvider.updateDiagnostics(event.document);
                }, 500);
            }
        }
    });

    const onDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument((document) => {
        if (document.languageId === 'cscript') {
            diagnosticCollection.delete(document.uri);
        }
    });

    // Check syntax for already open documents
    vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === 'cscript') {
            diagnosticProvider.updateDiagnostics(document);
        }
    });

    // Register transpile command
    const transpileCommand = vscode.commands.registerCommand('cscript.transpile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active CScript file to transpile');
            return;
        }

        if (editor.document.languageId !== 'cscript') {
            vscode.window.showErrorMessage('Current file is not a CScript file (.csc)');
            return;
        }

        await transpileFile(editor.document);
    });

    // Register run command
    const runCommand = vscode.commands.registerCommand('cscript.run', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active CScript file to run');
            return;
        }

        if (editor.document.languageId !== 'cscript') {
            vscode.window.showErrorMessage('Current file is not a CScript file (.csc)');
            return;
        }

        await runFile(editor.document);
    });

    // Auto-transpile on save
    const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === 'cscript') {
            const config = vscode.workspace.getConfiguration('cscript');
            if (config.get('transpiler.autoTranspile', true)) {
                await transpileFile(document);
            }
        }
    });

    context.subscriptions.push(
        transpileCommand, 
        runCommand, 
        onSaveDisposable,
        onDidOpenTextDocument,
        onDidChangeTextDocument,
        onDidCloseTextDocument
    );

    // Show welcome message
    vscode.window.showInformationMessage('CScript Language Support is ready! Use Ctrl+Shift+T to transpile or Ctrl+Shift+R to run.');
}

async function transpileFile(document: vscode.TextDocument): Promise<void> {
    const config = vscode.workspace.getConfiguration('cscript');
    const outputPath = config.get('transpiler.outputPath', './build');
    const enableLogging = config.get('debug.enableLogging', false);

    try {
        vscode.window.showInformationMessage('Transpiling CScript file...');

        const filePath = document.fileName;
        const fileName = path.basename(filePath, '.csc');
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const outputDir = path.join(workspaceFolder.uri.fsPath, outputPath);
        const outputFile = path.join(outputDir, `${fileName}.js`);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Run the transpiler
        const command = `node --loader ts-node/esm "${path.join(workspaceFolder.uri.fsPath, 'cli.ts')}" "${filePath}" > "${outputFile}"`;
        
        if (enableLogging) {
            console.log('Running command:', command);
        }

        exec(command, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Transpilation failed: ${error.message}`);
                if (enableLogging) {
                    console.error('Transpilation error:', error);
                    console.error('stderr:', stderr);
                }
                return;
            }

            vscode.window.showInformationMessage(`CScript transpiled successfully to ${outputFile}`);
            
            if (enableLogging) {
                console.log('Transpilation successful');
                console.log('stdout:', stdout);
            }
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Transpilation error: ${errorMessage}`);
    }
}

async function runFile(document: vscode.TextDocument): Promise<void> {
    try {
        // First transpile, then run
        await transpileFile(document);
        
        // Wait a moment for transpilation to complete
        setTimeout(() => {
            const filePath = document.fileName;
            const fileName = path.basename(filePath, '.csc');
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const config = vscode.workspace.getConfiguration('cscript');
            const outputPath = config.get('transpiler.outputPath', './build');
            const outputFile = path.join(workspaceFolder.uri.fsPath, outputPath, `${fileName}.js`);

            if (fs.existsSync(outputFile)) {
                // Create a new terminal and run the file
                const terminal = vscode.window.createTerminal(`CScript: ${fileName}`);
                terminal.sendText(`node "${outputFile}"`);
                terminal.show();
            } else {
                vscode.window.showErrorMessage('Transpiled file not found. Transpilation may have failed.');
            }
        }, 2000);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Run error: ${errorMessage}`);
    }
}

export function deactivate() {
    console.log('CScript extension is deactivated');
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

class CScriptDiagnosticProvider {
    public timeout: NodeJS.Timeout | undefined;

    public updateDiagnostics(document: vscode.TextDocument): void {
        // Check if diagnostics are enabled
        const config = vscode.workspace.getConfiguration('cscript');
        if (!config.get('diagnostics.enabled', true)) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Check for common CScript syntax errors
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const lineNumber = lineIndex;

            // Check for syntax errors
            this.checkPipelineOperators(line, lineNumber, diagnostics);
            this.checkMatchExpressions(line, lineNumber, diagnostics, lines);
            this.checkLinqQueries(line, lineNumber, diagnostics);
            this.checkOperatorOverloading(line, lineNumber, diagnostics);
            this.checkFunctionSyntax(line, lineNumber, diagnostics);
            this.checkBracesAndIndentation(line, lineNumber, diagnostics, lines);
            this.checkGeneralSyntax(line, lineNumber, diagnostics);
        }

        // Check for multi-line constructs
        this.checkMultiLineConstructs(lines, diagnostics);

        // Set diagnostics for this document
        diagnosticCollection.set(document.uri, diagnostics);
    }

    private checkPipelineOperators(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check for malformed pipeline operators
        const pipelineRegex = /\|[^>]/g;
        let match;
        while ((match = pipelineRegex.exec(line)) !== null) {
            const range = new vscode.Range(lineNumber, match.index, lineNumber, match.index + 2);
            const diagnostic = new vscode.Diagnostic(
                range,
                'Invalid pipeline operator. Use "|>" for pipeline operations.',
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }

        // Check for pipeline at end of line without continuation
        if (line.trim().endsWith('|>')) {
            const range = new vscode.Range(lineNumber, line.lastIndexOf('|>'), lineNumber, line.length);
            const diagnostic = new vscode.Diagnostic(
                range,
                'Pipeline operator at end of line requires a continuation on the next line.',
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }

    private checkMatchExpressions(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[], lines: string[]): void {
        // Check for match expressions
        const matchKeyword = /\bmatch\s*\{/g;
        if (matchKeyword.test(line)) {
            // Check if match expression is properly closed
            let braceCount = 0;
            let foundClosing = false;
            
            for (let i = lineNumber; i < lines.length; i++) {
                const currentLine = lines[i];
                braceCount += (currentLine.match(/\{/g) || []).length;
                braceCount -= (currentLine.match(/\}/g) || []).length;
                
                if (braceCount === 0 && i > lineNumber) {
                    foundClosing = true;
                    break;
                }
            }

            if (!foundClosing) {
                const range = new vscode.Range(lineNumber, line.indexOf('match'), lineNumber, line.indexOf('match') + 5);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Match expression is not properly closed with }',
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }

        // Check for malformed match arms
        const matchArm = /^\s*(.+)\s*=>\s*(.*)$/;
        if (matchArm.test(line.trim())) {
            const match = line.match(matchArm);
            if (match && match[1].trim() === '') {
                const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Match arm must have a pattern before "=>"',
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkLinqQueries(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check LINQ syntax
        const fromRegex = /\bfrom\s+(\w+)\s+in\s+/;
        if (fromRegex.test(line)) {
            // Check for proper variable naming
            const match = line.match(fromRegex);
            if (match && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(match[1])) {
                const varStart = line.indexOf(match[1]);
                const range = new vscode.Range(lineNumber, varStart, lineNumber, varStart + match[1].length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Invalid variable name in LINQ query. Must be a valid identifier.',
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }

        // Check for incomplete LINQ queries
        if (/\bfrom\b/.test(line) && !/\bselect\b/.test(line)) {
            // This is likely the start of a multi-line LINQ query
            // We should check subsequent lines for completion, but for now just warn
            const range = new vscode.Range(lineNumber, line.indexOf('from'), lineNumber, line.indexOf('from') + 4);
            const diagnostic = new vscode.Diagnostic(
                range,
                'LINQ query should end with a select clause.',
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }

    private checkOperatorOverloading(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check operator overloading syntax
        const operatorRegex = /\boperator\s+([+\-*/%=<>!&|^~]+)\s*\(/;
        const match = line.match(operatorRegex);
        if (match) {
            const validOperators = ['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '&', '|', '^', '~', '<<', '>>', '+=', '-=', '*=', '/=', '%='];
            if (!validOperators.includes(match[1])) {
                const opStart = line.indexOf(match[1]);
                const range = new vscode.Range(lineNumber, opStart, lineNumber, opStart + match[1].length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Invalid operator "${match[1]}" for overloading. Valid operators: ${validOperators.join(', ')}`,
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkFunctionSyntax(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check function declarations
        const functionRegex = /\bfunction\s+(\w+)\s*\(/;
        const match = line.match(functionRegex);
        if (match) {
            // Check for valid function names
            if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(match[1])) {
                const fnStart = line.indexOf(match[1]);
                const range = new vscode.Range(lineNumber, fnStart, lineNumber, fnStart + match[1].length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Invalid function name. Must be a valid identifier.',
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }

        // Check arrow functions
        const arrowRegex = /=>\s*$/;
        if (arrowRegex.test(line)) {
            const range = new vscode.Range(lineNumber, line.lastIndexOf('=>'), lineNumber, line.length);
            const diagnostic = new vscode.Diagnostic(
                range,
                'Arrow function body is missing.',
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }

    private checkBracesAndIndentation(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[], lines: string[]): void {
        // Check for mismatched braces in this line
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        
        // Check for mixed indentation styles
        if (line.match(/^\t+ +/) || line.match(/^ +\t/)) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.search(/\S/));
            const diagnostic = new vscode.Diagnostic(
                range,
                'Mixed tabs and spaces for indentation. Choose either tabs or spaces consistently.',
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }

    private checkGeneralSyntax(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check for common syntax errors
        
        // Unclosed strings (excluding escaped quotes)
        this.checkUnclosedStrings(line, lineNumber, diagnostics);
        
        // Check for invalid characters in identifiers
        this.checkInvalidIdentifiers(line, lineNumber, diagnostics);
        
        // Check for trailing semicolons in Python-style syntax
        this.checkSemicolonUsage(line, lineNumber, diagnostics);
        
        // Check for CScript-specific syntax
        this.checkStructSyntax(line, lineNumber, diagnostics);
        this.checkAutoProperties(line, lineNumber, diagnostics);
        this.checkRangeOperators(line, lineNumber, diagnostics);
        this.checkWithExpressions(line, lineNumber, diagnostics);
    }

    private checkUnclosedStrings(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // More sophisticated string checking
        let inString = false;
        let stringChar = '';
        let escaped = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (escaped) {
                escaped = false;
                continue;
            }
            
            if (char === '\\') {
                escaped = true;
                continue;
            }
            
            if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringChar = char;
            } else if (inString && char === stringChar) {
                inString = false;
                stringChar = '';
            }
        }
        
        if (inString) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Unclosed ${stringChar === '`' ? 'template literal' : 'string'}.`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }

    private checkInvalidIdentifiers(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        const invalidIdentifier = /\b\d+\w+\b/g;
        let match;
        while ((match = invalidIdentifier.exec(line)) !== null) {
            const range = new vscode.Range(lineNumber, match.index, lineNumber, match.index + match[0].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                'Identifiers cannot start with a number.',
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }

    private checkSemicolonUsage(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        if (line.includes(':') && line.trim().endsWith(';')) {
            const range = new vscode.Range(lineNumber, line.lastIndexOf(';'), lineNumber, line.length);
            const diagnostic = new vscode.Diagnostic(
                range,
                'Semicolon not needed when using Python-style syntax with colons.',
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }

    private checkStructSyntax(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check struct declarations
        const structRegex = /\bstruct\s+(\w+)/;
        const match = line.match(structRegex);
        if (match) {
            if (!/^[A-Z][a-zA-Z0-9_]*$/.test(match[1])) {
                const structStart = line.indexOf(match[1]);
                const range = new vscode.Range(lineNumber, structStart, lineNumber, structStart + match[1].length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Struct names should start with an uppercase letter and follow PascalCase convention.',
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkAutoProperties(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check auto-property syntax: { get; set; }
        const autoPropertyRegex = /\{\s*(get|set)[;\s]*(get|set)?[;\s]*\}/;
        if (autoPropertyRegex.test(line)) {
            const match = line.match(/\{\s*([^}]+)\s*\}/);
            if (match && !match[1].includes('get') && !match[1].includes('set')) {
                const range = new vscode.Range(lineNumber, line.indexOf('{'), lineNumber, line.indexOf('}') + 1);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Auto-property must include at least one of "get" or "set".',
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkRangeOperators(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check range operators in match expressions
        const rangeRegex = /(\d+)\.\.(\d+|_)/g;
        let match;
        while ((match = rangeRegex.exec(line)) !== null) {
            if (match[2] !== '_') {
                const start = parseInt(match[1]);
                const end = parseInt(match[2]);
                if (start >= end) {
                    const range = new vscode.Range(lineNumber, match.index, lineNumber, match.index + match[0].length);
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        'Range start must be less than range end.',
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.source = 'cscript';
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    private checkWithExpressions(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]): void {
        // Check 'with' expression syntax
        const withRegex = /\bwith\s*\{/;
        if (withRegex.test(line)) {
            // Check if it's part of a proper expression
            if (!line.includes('=') || line.trim().startsWith('with')) {
                const range = new vscode.Range(lineNumber, line.indexOf('with'), lineNumber, line.indexOf('with') + 4);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    '"with" expression must be used with an assignment or return statement.',
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'cscript';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkMultiLineConstructs(lines: string[], diagnostics: vscode.Diagnostic[]): void {
        // Check for unclosed blocks (braces, brackets, parentheses)
        let braceCount = 0;
        let bracketCount = 0;
        let parenCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Count opening and closing characters
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            bracketCount += (line.match(/\[/g) || []).length;
            bracketCount -= (line.match(/\]/g) || []).length;
            
            parenCount += (line.match(/\(/g) || []).length;
            parenCount -= (line.match(/\)/g) || []).length;
        }
        
        // Report unclosed constructs at the end of file
        const lastLineIndex = lines.length - 1;
        
        if (braceCount > 0) {
            const range = new vscode.Range(lastLineIndex, 0, lastLineIndex, lines[lastLineIndex].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `${braceCount} unclosed brace(s). Missing closing brace '}'.`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        } else if (braceCount < 0) {
            const range = new vscode.Range(lastLineIndex, 0, lastLineIndex, lines[lastLineIndex].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `${Math.abs(braceCount)} extra closing brace(s).`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
        
        if (bracketCount > 0) {
            const range = new vscode.Range(lastLineIndex, 0, lastLineIndex, lines[lastLineIndex].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `${bracketCount} unclosed bracket(s). Missing closing bracket ']'.`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
        
        if (parenCount > 0) {
            const range = new vscode.Range(lastLineIndex, 0, lastLineIndex, lines[lastLineIndex].length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `${parenCount} unclosed parenthesis(es). Missing closing parenthesis ')'.`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'cscript';
            diagnostics.push(diagnostic);
        }
    }
}