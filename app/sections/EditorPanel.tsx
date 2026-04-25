'use client'

import React, { useRef, useEffect } from 'react'
import { VscPlay, VscLoading, VscFile, VscWand } from 'react-icons/vsc'

interface EditorPanelProps {
  code: string
  onChange: (code: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  hasScenario: boolean
  fileName?: string
  submitFlash?: 'approved' | 'rejected' | null
}

export default function EditorPanel({ code, onChange, onSubmit, isSubmitting, hasScenario, fileName, submitFlash }: EditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineCountRef = useRef<HTMLDivElement>(null)

  const lines = (code || '').split('\n')
  const lineCount = Math.max(lines.length, 20)

  // Sync scroll between line numbers and textarea
  const handleScroll = () => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const handleFormat = () => {
    if (!code.trim()) return
    const formatted = code.split('\n').map(line => {
      const trimmed = line.replace(/^\s+/, '')
      const leadingSpaces = line.length - line.trimStart().length
      const indent = Math.round(leadingSpaces / 2) * 2
      return ' '.repeat(indent) + trimmed
    }).join('\n')
    onChange(formatted)
  }

  // Handle tab key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = code.substring(0, start) + '  ' + code.substring(end)
      onChange(newVal)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [hasScenario])

  if (!hasScenario) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#1e1e1e' }}>
        <div className="text-center px-8">
          <VscFile className="h-12 w-12 mx-auto mb-4" style={{ color: '#3e3e3e' }} />
          <p className="text-sm" style={{ color: '#636d83' }}>No file open</p>
          <p className="text-xs mt-1" style={{ color: '#4a4a4f' }}>Generate a scenario to start coding</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#1e1e1e' }}>
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center" style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #3e3e3e' }}>
        <div className="flex items-center gap-2 px-4 py-1.5" style={{ backgroundColor: '#1e1e1e', borderBottom: '2px solid #a6e22e', borderRight: '1px solid #3e3e3e' }}>
          <VscFile className="h-3.5 w-3.5" style={{ color: '#a6e22e' }} />
          <span className="text-xs font-mono" style={{ color: '#f8f8f2' }}>{fileName ?? 'Solution.jsx'}</span>
        </div>
        <div className="flex-1" />
      </div>

      {/* Editor area */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex">
          {/* Line numbers */}
          <div
            ref={lineCountRef}
            className="flex-shrink-0 overflow-hidden select-none py-3 pr-2 text-right"
            style={{ backgroundColor: '#1e1e1e', width: '3rem', borderRight: '1px solid #3e3e3e' }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="font-mono text-xs leading-6 px-1" style={{ color: '#636d83' }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="flex-1 resize-none outline-none p-3 font-mono text-xs leading-6"
            style={{
              backgroundColor: '#1e1e1e',
              color: '#f8f8f2',
              caretColor: '#f8f8f2',
              tabSize: 2,
            }}
            placeholder={"// Fix the bug here...\n// Tip: Ensure you handle dependencies, cleanup functions, and race conditions as specified in the ticket."}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2" style={{ backgroundColor: '#2d2d2d', borderTop: '1px solid #3e3e3e' }}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono" style={{ color: '#636d83' }}>
            Ln {lines.length}, Col {(lines[lines.length - 1] ?? '').length}
          </span>
          <span className="text-[10px] font-mono" style={{ color: '#636d83' }}>
            JavaScript
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFormat}
            disabled={!code.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              backgroundColor: !code.trim() ? '#3e3e3e' : '#3e3e3e',
              color: !code.trim() ? '#4a4a4f' : '#cccccc',
              cursor: !code.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <VscWand className="h-3.5 w-3.5" />
            <span>Format</span>
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting || !code.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded text-xs font-semibold transition-all"
            style={{
              backgroundColor: submitFlash === 'approved' ? '#a6e22e' : submitFlash === 'rejected' ? '#f92672' : (isSubmitting || !code.trim() ? '#3e3e3e' : '#a6e22e'),
              color: submitFlash ? '#1e1e1e' : (isSubmitting || !code.trim() ? '#636d83' : '#1e1e1e'),
              cursor: isSubmitting || !code.trim() ? 'not-allowed' : 'pointer',
              boxShadow: submitFlash === 'approved' ? '0 0 12px rgba(166, 226, 46, 0.4)' : submitFlash === 'rejected' ? '0 0 12px rgba(249, 38, 114, 0.4)' : 'none',
            }}
          >
            {isSubmitting ? (
              <>
                <VscLoading className="h-3.5 w-3.5 animate-spin" />
                <span>Reviewing...</span>
              </>
            ) : (
              <>
                <VscPlay className="h-3.5 w-3.5" />
                <span>Submit for Review</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
