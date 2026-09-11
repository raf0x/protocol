import type { ReactNode } from 'react'

export default function EditorSection({ title, hint, children, optional = false }: { title: string; hint?: string; children: ReactNode; optional?: boolean }) {
  return optional ? <details className="protocol-editor-section"><summary>{title}{hint && <span>{hint}</span>}</summary><div className="protocol-fields">{children}</div></details> :
    <fieldset className="protocol-editor-section"><legend>{title}</legend>{hint && <p className="protocol-section-hint">{hint}</p>}<div className="protocol-fields">{children}</div></fieldset>
}
