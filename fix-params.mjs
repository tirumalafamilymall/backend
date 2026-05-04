import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

function findRouteFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findRouteFiles(full))
    } else if (entry === 'route.ts') {
      results.push(full)
    }
  }
  return results
}

const apiDir = path.join(process.cwd(), 'src', 'app', 'api')
const files = findRouteFiles(apiDir)

if (files.length === 0) {
  console.error('No route.ts files found under src/app/api')
  process.exit(1)
}

let fixedCount = 0

for (const fullPath of files) {
  let src = readFileSync(fullPath, 'utf8')
  const original = src

  const signatureRe = /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*(\{[^}]+\})\s*\}/g

  if (!signatureRe.test(src)) continue
  signatureRe.lastIndex = 0

  src = src.replace(
    signatureRe,
    (_match, innerType) => `_context: { params: Promise<${innerType.trim()}> }`
  )

  src = src.replace(
    /(_context:\s*\{\s*params:\s*Promise<[^>]+>\s*\}[^)]*\)\s*\{)/g,
    '$1\n  const params = await _context.params'
  )

  if (src !== original) {
    writeFileSync(fullPath, src, 'utf8')
    console.log(`✅  ${path.relative(process.cwd(), fullPath)}`)
    fixedCount++
  }
}

console.log(`\nDone — ${fixedCount} of ${files.length} file(s) updated.`)
