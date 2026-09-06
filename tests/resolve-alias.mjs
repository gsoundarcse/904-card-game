import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Node does not read tsconfig "paths", so the "@/..." alias used throughout the
// app has to be resolved by hand for the bare test runner.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '/index.ts']

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = path.join(root, specifier.slice(2))
    for (const ext of EXTENSIONS) {
      const candidate = base + ext
      if (fs.existsSync(candidate)) return next(pathToFileURL(candidate).href, context)
    }
  }
  return next(specifier, context)
}
