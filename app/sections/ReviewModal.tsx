'use client'

import React, { useState } from 'react'
import { VscCheck, VscError, VscArrowRight, VscBook, VscChevronDown, VscChevronRight, VscClose } from 'react-icons/vsc'

function highlightCode(code: string) {
  if (!code) return null
  const lines = code.split('\n')
  return lines.map((line, lineIdx) => {
    const tokens: React.ReactNode[] = []
    let tokenIdx = 0
    const addToken = (text: string, color: string) => {
      tokens.push(<span key={tokenIdx++} style={{ color }}>{text}</span>)
    }
    let i = 0
    let buffer = ''
    while (i < line.length) {
      const ch = line[i]
      if (line.slice(i, i + 2) === '//') {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        addToken(line.slice(i), '#75715e'); i = line.length; continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        const q = ch; let s = ch; i++
        while (i < line.length && line[i] !== q) {
          if (line[i] === '\\') { s += line[i]; i++ }
          s += line[i]; i++
        }
        if (i < line.length) { s += line[i]; i++ }
        addToken(s, '#e6db74'); continue
      }
      if (/\d/.test(ch) && (buffer === '' || /\W/.test(buffer[buffer.length - 1] || ''))) {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        let n = ''
        while (i < line.length && /[\d.]/.test(line[i])) { n += line[i]; i++ }
        addToken(n, '#ae81ff'); continue
      }
      if (/[a-zA-Z_$]/.test(ch)) {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        let w = ''
        while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) { w += line[i]; i++ }
        const kw = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'import', 'export', 'from', 'async', 'await', 'new', 'throw', 'try', 'catch', 'class', 'extends', 'default', 'for', 'while']
        const bi = ['true', 'false', 'null', 'undefined', 'this', 'console']
        const tp = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'React', 'Promise']
        if (kw.includes(w)) addToken(w, '#f92672')
        else if (bi.includes(w)) addToken(w, '#ae81ff')
        else if (tp.includes(w)) addToken(w, '#66d9ef')
        else addToken(w, '#f8f8f2')
        continue
      }
      buffer += ch; i++
    }
    if (buffer) addToken(buffer, '#f8f8f2')
    return (
      <div key={lineIdx} className="flex" style={{ minHeight: '1.4rem' }}>
        <span className="inline-block w-8 text-right pr-3 select-none flex-shrink-0" style={{ color: '#636d83' }}>{lineIdx + 1}</span>
        <span className="flex-1 whitespace-pre">{tokens.length > 0 ? tokens : ' '}</span>
      </div>
    )
  })
}

interface ReviewData {
  verdict?: string
  technical_score?: number
  summary?: string
  what_went_well?: string[]
  misconceptions?: string[]
  suggestions?: string[]
  corrected_code?: string
  learning_resources?: Array<{ title?: string; topic?: string }>
}

interface ReviewModalProps {
  visible: boolean
  review: ReviewData | null
  onClose: () => void
  onNewScenario: () => void
}

export default function ReviewModal({ visible, review, onClose, onNewScenario }: ReviewModalProps) {
  const [codeExpanded, setCodeExpanded] = useState(true)

  if (!visible || !review) return null

  const score = typeof review.technical_score === 'number' ? review.technical_score : 0
  const scoreColor = score >= 9 ? '#a6e22e' : score >= 7 ? '#66d9ef' : score >= 5 ? '#e6db74' : '#f92672'
  const verdictIsApproved = (review.verdict ?? '').toUpperCase().includes('APPROVED') && !(review.verdict ?? '').toUpperCase().includes('NEEDS')
  const verdictColor = verdictIsApproved ? '#a6e22e' : '#fd971f'

  const wellItems = Array.isArray(review.what_went_well) ? review.what_went_well : []
  const miscItems = Array.isArray(review.misconceptions) ? review.misconceptions : []
  const suggItems = Array.isArray(review.suggestions) ? review.suggestions : []
  const resources = Array.isArray(review.learning_resources) ? review.learning_resources : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)' }}>
      <div
        className="relative w-full max-h-[100vh] md:max-h-[85vh] md:max-w-3xl md:mx-4 overflow-hidden md:rounded-lg shadow-2xl flex flex-col"
        style={{
          backgroundColor: '#2d2d2d',
          border: '1px solid #3e3e3e',
          animation: 'fadeScaleIn 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #3e3e3e' }}>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono" style={{ color: scoreColor }}>
                {score}
                <span className="text-base" style={{ color: '#636d83' }}>/10</span>
              </div>
            </div>
            <div>
              <span
                className="inline-block text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider"
                style={{ backgroundColor: `${verdictColor}20`, color: verdictColor, border: `1px solid ${verdictColor}40` }}
              >
                {review.verdict ?? 'PENDING'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: '#636d83' }}>
            <VscClose className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Summary */}
          {review.summary && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#636d83' }}>Summary</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#cccccc' }}>{review.summary}</p>
            </div>
          )}

          {/* What went well */}
          {wellItems.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#a6e22e' }}>What Went Well</h3>
              <div className="space-y-1.5">
                {wellItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <VscCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#a6e22e' }} />
                    <span className="text-sm" style={{ color: '#cccccc' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Misconceptions */}
          {miscItems.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#f92672' }}>Misconceptions</h3>
              <div className="space-y-1.5">
                {miscItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <VscError className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#f92672' }} />
                    <span className="text-sm" style={{ color: '#cccccc' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggItems.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#66d9ef' }}>Suggestions</h3>
              <div className="space-y-1.5">
                {suggItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <VscArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#66d9ef' }} />
                    <span className="text-sm" style={{ color: '#cccccc' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corrected Code */}
          {review.corrected_code && (
            <div>
              <button
                onClick={() => setCodeExpanded(!codeExpanded)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#636d83' }}
              >
                {codeExpanded ? <VscChevronDown className="h-3 w-3" /> : <VscChevronRight className="h-3 w-3" />}
                Corrected Code
              </button>
              {codeExpanded && (
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #3e3e3e' }}>
                  <div className="flex items-center px-3 py-1.5" style={{ backgroundColor: '#252526', borderBottom: '1px solid #3e3e3e' }}>
                    <span className="text-xs font-mono" style={{ color: '#a0a0a0' }}>CorrectedSolution.jsx</span>
                  </div>
                  <div className="p-3 overflow-x-auto font-mono text-[11px] leading-snug" style={{ backgroundColor: '#1e1e1e' }}>
                    {highlightCode(review.corrected_code)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Learning Resources */}
          {resources.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#636d83' }}>Learning Resources</h3>
              <div className="space-y-1.5">
                {resources.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: '#252526' }}>
                    <VscBook className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#ae81ff' }} />
                    <div>
                      <span className="text-sm font-medium" style={{ color: '#f8f8f2' }}>{r?.title ?? 'Resource'}</span>
                      {r?.topic && <span className="text-xs ml-2" style={{ color: '#636d83' }}>{r.topic}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 flex justify-end" style={{ borderTop: '1px solid #3e3e3e' }}>
          <button
            onClick={onNewScenario}
            className="flex items-center gap-2 px-5 py-2 rounded text-sm font-semibold transition-all"
            style={{ border: '1px solid #a6e22e40', color: '#a6e22e', backgroundColor: '#a6e22e10' }}
          >
            <VscArrowRight className="h-4 w-4" />
            Tackle New Scenario
          </button>
        </div>
      </div>
    </div>
  )
}
