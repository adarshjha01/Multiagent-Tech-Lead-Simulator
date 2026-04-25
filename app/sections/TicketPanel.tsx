'use client'

import React, { useState } from 'react'
import { VscChevronDown, VscChevronRight, VscFile, VscCheck, VscLightbulb, VscTag } from 'react-icons/vsc'

function highlightCode(code: string) {
  if (!code) return null
  const lines = code.split('\n')
  return lines.map((line, lineIdx) => {
    const tokens: React.ReactNode[] = []
    let remaining = line
    let tokenIdx = 0

    const addToken = (text: string, color: string) => {
      tokens.push(<span key={tokenIdx++} style={{ color }}>{text}</span>)
    }

    // Simple tokenizer
    let i = 0
    let buffer = ''
    while (i < remaining.length) {
      const ch = remaining[i]
      // Comments
      if (remaining.slice(i, i + 2) === '//') {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        addToken(remaining.slice(i), '#75715e')
        i = remaining.length
        continue
      }
      // Strings
      if (ch === "'" || ch === '"' || ch === '`') {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        const quote = ch
        let str = ch
        i++
        while (i < remaining.length && remaining[i] !== quote) {
          if (remaining[i] === '\\') { str += remaining[i]; i++ }
          str += remaining[i]
          i++
        }
        if (i < remaining.length) { str += remaining[i]; i++ }
        addToken(str, '#e6db74')
        continue
      }
      // Numbers
      if (/\d/.test(ch) && (buffer === '' || /\W/.test(buffer[buffer.length - 1] || ''))) {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        let num = ''
        while (i < remaining.length && /[\d.]/.test(remaining[i])) {
          num += remaining[i]; i++
        }
        addToken(num, '#ae81ff')
        continue
      }
      // Word boundaries for keywords
      if (/[a-zA-Z_$]/.test(ch)) {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        let word = ''
        while (i < remaining.length && /[a-zA-Z0-9_$]/.test(remaining[i])) {
          word += remaining[i]; i++
        }
        const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'import', 'export', 'from', 'async', 'await', 'new', 'throw', 'try', 'catch', 'finally', 'class', 'extends', 'default', 'switch', 'case', 'break', 'for', 'while', 'do', 'of', 'in', 'typeof', 'instanceof']
        const builtins = ['true', 'false', 'null', 'undefined', 'this', 'console', 'window', 'document']
        const types = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'React', 'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Map', 'Set']
        if (keywords.includes(word)) {
          addToken(word, '#f92672')
        } else if (builtins.includes(word)) {
          addToken(word, '#ae81ff')
        } else if (types.includes(word)) {
          addToken(word, '#66d9ef')
        } else {
          addToken(word, '#f8f8f2')
        }
        continue
      }
      // JSX angle brackets
      if (ch === '<' || ch === '>' || ch === '/') {
        if (buffer) { addToken(buffer, '#f8f8f2'); buffer = '' }
        addToken(ch, '#f8f8f2')
        i++
        continue
      }
      // Operators and punctuation
      buffer += ch
      i++
    }
    if (buffer) addToken(buffer, '#f8f8f2')

    return (
      <div key={lineIdx} className="flex" style={{ minHeight: '1.5rem' }}>
        <span className="inline-block w-10 text-right pr-4 select-none flex-shrink-0" style={{ color: '#636d83' }}>
          {lineIdx + 1}
        </span>
        <span className="flex-1 whitespace-pre">{tokens.length > 0 ? tokens : ' '}</span>
      </div>
    )
  })
}

interface ScenarioData {
  ticket_id?: string
  ticket_title?: string
  ticket_description?: string
  acceptance_criteria?: string[]
  difficulty?: string
  tags?: string[]
  broken_code?: string
  hint?: string
}

interface TicketPanelProps {
  scenario: ScenarioData | null
  loading: boolean
}

export default function TicketPanel({ scenario, loading }: TicketPanelProps) {
  const [hintVisible, setHintVisible] = useState(false)

  const difficultyColor = (d?: string) => {
    const dl = (d ?? '').toLowerCase()
    if (dl === 'easy') return { bg: '#a6e22e20', text: '#a6e22e', border: '#a6e22e40' }
    if (dl === 'hard') return { bg: '#f9267220', text: '#f92672', border: '#f9267240' }
    return { bg: '#e6db7420', text: '#e6db74', border: '#e6db7440' }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col" style={{ backgroundColor: '#252526' }}>
        <div className="p-4 space-y-4">
          <div className="h-6 w-3/4 rounded animate-pulse" style={{ backgroundColor: '#3e3e3e' }} />
          <div className="h-4 w-1/2 rounded animate-pulse" style={{ backgroundColor: '#3e3e3e' }} />
          <div className="space-y-2 mt-6">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-4 rounded animate-pulse" style={{ backgroundColor: '#3e3e3e', width: `${60 + i * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#252526' }}>
        <div className="text-center px-8">
          <VscFile className="h-12 w-12 mx-auto mb-4" style={{ color: '#636d83' }} />
          <p className="text-sm" style={{ color: '#636d83' }}>No ticket loaded.</p>
          <p className="text-xs mt-1" style={{ color: '#4a4a4f' }}>Generate a new scenario to begin.</p>
        </div>
      </div>
    )
  }

  const dc = difficultyColor(scenario.difficulty)
  const criteria = Array.isArray(scenario.acceptance_criteria) ? scenario.acceptance_criteria : []
  const tags = Array.isArray(scenario.tags) ? scenario.tags : []

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#252526' }}>
      {/* Panel header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #3e3e3e', backgroundColor: '#2d2d2d' }}>
        <VscFile className="h-4 w-4 flex-shrink-0" style={{ color: '#66d9ef' }} />
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#636d83' }}>Explorer</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Ticket header */}
        <div>
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#66d9ef20', color: '#66d9ef' }}>
              {scenario.ticket_id ?? 'TICKET'}
            </span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: dc.bg, color: dc.text, border: `1px solid ${dc.border}` }}>
              {(scenario.difficulty ?? 'Medium').toUpperCase()}
            </span>
          </div>
          <h2 className="text-base font-semibold mt-2" style={{ color: '#f8f8f2' }}>
            {scenario.ticket_title ?? 'Untitled Ticket'}
          </h2>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <VscTag className="h-3 w-3 flex-shrink-0" style={{ color: '#636d83' }} />
              {tags.map((tag, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: '#3e3e3e', color: '#a0a0a0' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        {scenario.ticket_description && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#636d83' }}>Description</h3>
            <p className="text-sm leading-relaxed" style={{ color: '#cccccc' }}>
              {scenario.ticket_description}
            </p>
          </div>
        )}

        {/* Acceptance Criteria */}
        {criteria.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#636d83' }}>Acceptance Criteria</h3>
            <div className="space-y-1.5">
              {criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <VscCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#a6e22e' }} />
                  <span className="text-sm" style={{ color: '#cccccc' }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Broken Code */}
        {scenario.broken_code && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#636d83' }}>Broken Code</h3>
            </div>
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #3e3e3e' }}>
              <div className="flex items-center px-3 py-1.5" style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #3e3e3e' }}>
                <span className="text-xs font-mono" style={{ color: '#a0a0a0' }}>BrokenComponent.jsx</span>
              </div>
              <div className="p-3 overflow-x-auto font-mono text-xs leading-relaxed" style={{ backgroundColor: '#1e1e1e' }}>
                {highlightCode(scenario.broken_code)}
              </div>
            </div>
          </div>
        )}

        {/* Hint toggle */}
        {scenario.hint && (
          <div>
            <button
              onClick={() => setHintVisible(!hintVisible)}
              className="flex items-center gap-2 text-xs font-medium transition-colors"
              style={{ color: '#fd971f' }}
            >
              <VscLightbulb className="h-3.5 w-3.5" />
              {hintVisible ? <VscChevronDown className="h-3 w-3" /> : <VscChevronRight className="h-3 w-3" />}
              <span>{hintVisible ? 'Hide Hint' : 'Show Hint'}</span>
            </button>
            {hintVisible && (
              <div className="mt-2 text-sm p-3 rounded-md" style={{ backgroundColor: '#fd971f10', border: '1px solid #fd971f30', color: '#fd971f' }}>
                {scenario.hint}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
