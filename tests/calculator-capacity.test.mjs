import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const source=readFileSync(new URL('../app/calculator/CalculatorClient.tsx',import.meta.url),'utf8')

test('calculator separates U-100 scale from the example syringe capacity',()=>{
 assert.match(source,/U-100 scale/)
 assert.match(source,/1 mL \/ 100-marking syringe example/)
 assert.match(source,/syringe capacity is separate/)
 assert.doesNotMatch(source,/U-100 syringe capacity/)
})
