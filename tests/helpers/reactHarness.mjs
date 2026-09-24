import React from 'react'

// A small hook renderer for interaction tests, with state scoped to component identity.
export function reactHarness() {
  const bank = new Map()
  let current, slot = 0
  const hooks = {
    useEffect() {},
    useState(initial) {
      const state = current, index = slot++
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useRef(initial) {
      const index = slot++
      return current[index] ?? (current[index] = { current: initial })
    },
  }
  function render(node, path = 'root') {
    if (Array.isArray(node)) return node.map((child, i) => render(child, `${path}/${child?.key ?? i}`))
    if (!React.isValidElement(node)) return node
    if (typeof node.type === 'function') {
      const previous = current, previousSlot = slot
      const key = `${path}:${node.type.name}:${node.key ?? ''}`
      current = bank.get(key) || []; bank.set(key, current); slot = 0
      const output = node.type(node.props)
      current = previous; slot = previousSlot
      return render(output, key)
    }
    return { type: node.type, props: { ...node.props, children: render(node.props.children, path) } }
  }
  return { hooks, render, reset: () => bank.clear() }
}
