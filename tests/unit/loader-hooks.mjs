/**
 * Node module customization hooks that let the built-in `node:test` runner load
 * the app's TypeScript / TSX sources without adding jest, vitest, @testing-library
 * or any other package.
 *
 * - `.ts` / `.tsx` files are transpiled with the `typescript` package that the
 *   project already ships as a devDependency (`ts.transpileModule`).
 * - The `@/*` tsconfig path alias and extension-less relative imports are
 *   resolved the same way Next/webpack resolve them.
 * - A small, explicit map of module doubles replaces browser/network-heavy
 *   collaborators (wallet session, swap execution, modals, icons) so the target
 *   components can be rendered server-side with `react-dom/server`.
 *
 * This file is intentionally plain ESM so Node can load it before any hooks run.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SRC_DIR = path.join(REPO_ROOT, 'src');

const doubleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

/**
 * Repo-relative module path (without extension) -> deterministic test double.
 * Mapping both the provider module and the re-export hook to the same file keeps
 * a single shared instance for the spec that configures it.
 */
const MODULE_DOUBLES = {
  'src/app/components/providers/WalletProvider': doubleUrl('./stubs/wallet-state.mjs'),
  'src/app/hooks/useWalletState': doubleUrl('./stubs/wallet-state.mjs'),
  'src/hooks/useSwapExecution': doubleUrl('./stubs/swap-state.mjs'),
  'src/app/hooks/useSlippageTolerance': doubleUrl('./stubs/swap-state.mjs'),
  'src/components/swap/PathVisualizer': doubleUrl('./stubs/swap-children.mjs'),
  'src/components/swap/GasEstimateBadge': doubleUrl('./stubs/swap-children.mjs'),
  'src/components/swap/TokenSelectorModal': doubleUrl('./stubs/swap-children.mjs'),
  'src/components/swap/SlippageSettingsModal': doubleUrl('./stubs/swap-children.mjs'),
  'src/components/trading/SlippageVisualizer': doubleUrl('./stubs/swap-children.mjs'),
  'src/components/ui/TokenIcon': doubleUrl('./stubs/swap-children.mjs'),
  'src/app/components/TopLoadingBar': doubleUrl('./stubs/wallet-button-children.mjs'),
  'src/components/ui/WalletQRCode': doubleUrl('./stubs/wallet-button-children.mjs'),
};

const RESOLUTION_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json', '.css'];

function stripQuery(url) {
  return url.split('?')[0].split('#')[0];
}

function resolveFile(basePath) {
  if (existsSync(basePath) && statSync(basePath).isFile()) return basePath;
  for (const extension of RESOLUTION_EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const extension of RESOLUTION_EXTENSIONS) {
    const candidate = path.join(basePath, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function moduleKey(filePath) {
  const relative = path.relative(REPO_ROOT, filePath).split(path.sep).join('/');
  return relative.replace(/\.[^./]+$/, '');
}

export async function resolve(specifier, context, nextResolve) {
  let candidatePath = null;
  if (specifier.startsWith('@/')) {
    candidatePath = path.join(SRC_DIR, specifier.slice(2));
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    candidatePath = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (candidatePath) {
    const resolved = resolveFile(candidatePath);
    if (resolved) {
      const double = MODULE_DOUBLES[moduleKey(resolved)];
      return { url: double ?? pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  const cleanUrl = stripQuery(url);

  if (cleanUrl.endsWith('.css')) {
    return { format: 'module', source: 'export default {};', shortCircuit: true };
  }

  if (cleanUrl.endsWith('.json')) {
    const contents = readFileSync(fileURLToPath(cleanUrl), 'utf8');
    return { format: 'module', source: `export default ${contents};`, shortCircuit: true };
  }

  if (cleanUrl.endsWith('.ts') || cleanUrl.endsWith('.tsx')) {
    const filePath = fileURLToPath(cleanUrl);
    const source = readFileSync(filePath, 'utf8');
    const { outputText, diagnostics } = ts.transpileModule(source, {
      fileName: filePath,
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        isolatedModules: true,
        sourceMap: false,
      },
    });

    const errors = (diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (errors.length > 0) {
      const message = ts.formatDiagnostics(errors, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => REPO_ROOT,
        getNewLine: () => '\n',
      });
      throw new Error(`Failed to transpile ${path.relative(REPO_ROOT, filePath)}:\n${message}`);
    }

    return { format: 'module', source: outputText, shortCircuit: true };
  }

  return nextLoad(url, context);
}
