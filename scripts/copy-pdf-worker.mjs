import { createRequire } from 'node:module'
import { copyFileSync, cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const root = dirname(require.resolve('pdfjs-dist/package.json'))
const { version } = require('pdfjs-dist/package.json')
const destination = new URL('../public/vendor/', import.meta.url)
mkdirSync(destination, { recursive: true })
copyFileSync(join(root, 'legacy/build/pdf.worker.min.mjs'), new URL(`pdf.worker-${version}.min.mjs`, destination))
copyFileSync(join(root, 'LICENSE'), new URL('pdfjs-LICENSE', destination))
cpSync(join(root, 'standard_fonts'), new URL(`pdfjs-${version}/standard_fonts`, destination), { recursive: true })
cpSync(join(root, 'cmaps'), new URL(`pdfjs-${version}/cmaps`, destination), { recursive: true })
