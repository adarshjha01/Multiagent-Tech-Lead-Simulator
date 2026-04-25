'use client'

import React from 'react'
import { VscCode } from 'react-icons/vsc'

interface LoadingOverlayProps {
  visible: boolean
}

export default function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ backgroundColor: 'rgba(30, 30, 30, 0.88)', backdropFilter: 'blur(4px)' }}>
      <div className="text-center">
        {/* Animated code icon */}
        <div className="relative mx-auto mb-6" style={{ width: 64, height: 64 }}>
          <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: '#a6e22e20' }} />
          <div className="absolute inset-0 flex items-center justify-center rounded-full animate-pulse" style={{ backgroundColor: '#a6e22e15', border: '2px solid #a6e22e40' }}>
            <VscCode className="h-7 w-7" style={{ color: '#a6e22e' }} />
          </div>
        </div>

        <p className="text-sm font-medium mb-2" style={{ color: '#f8f8f2' }}>
          The Senior Engineering Team is reviewing your submission...
        </p>

        {/* Animated dots */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                backgroundColor: i === 0 ? '#a6e22e' : i === 1 ? '#66d9ef' : '#f92672',
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.8s',
              }}
            />
          ))}
        </div>

        <p className="text-xs mt-4" style={{ color: '#636d83' }}>
          Analyzing code quality, patterns, and best practices
        </p>
      </div>
    </div>
  )
}
