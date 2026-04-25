'use client'

import React from 'react'
import { VscRocket } from 'react-icons/vsc'

interface WelcomeOverlayProps {
  visible: boolean
  onDismiss: () => void
}

export default function WelcomeOverlay({ visible, onDismiss }: WelcomeOverlayProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
      <div
        className="relative w-full max-w-lg mx-4 overflow-hidden rounded-lg shadow-2xl"
        style={{
          backgroundColor: '#2d2d2d',
          border: '1px solid #3e3e3e',
          boxShadow: '0 0 60px rgba(166, 226, 46, 0.1)',
        }}
      >
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-full" style={{ backgroundColor: '#a6e22e15', border: '2px solid #a6e22e40' }}>
            <VscRocket className="h-7 w-7" style={{ color: '#a6e22e' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#f8f8f2' }}>
            Welcome, Engineer.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#cccccc' }}>
            Your mission is to fix production-critical bugs. Review the Jira ticket on the left, write your solution in the IDE, and submit it to the Staff Engineering team for a code review.
          </p>
        </div>

        <div className="px-8 pt-4 pb-8 flex justify-center">
          <button
            onClick={onDismiss}
            className="flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-all"
            style={{
              backgroundColor: '#a6e22e',
              color: '#1e1e1e',
            }}
          >
            <VscRocket className="h-4 w-4" />
            Got it, let&apos;s code
          </button>
        </div>
      </div>
    </div>
  )
}
