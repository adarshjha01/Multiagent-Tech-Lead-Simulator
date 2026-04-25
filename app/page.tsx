'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { VscSettingsGear, VscCircleFilled, VscRefresh, VscSymbolFile, VscChevronLeft, VscChevronRight } from 'react-icons/vsc'
import { FiAward, FiTarget } from 'react-icons/fi'
import TicketPanel from './sections/TicketPanel'
import EditorPanel from './sections/EditorPanel'
import LoadingOverlay from './sections/LoadingOverlay'
import ReviewModal from './sections/ReviewModal'
import WelcomeOverlay from './sections/WelcomeOverlay'

const SCENARIO_AGENT_ID = '69ec62bdbe4c8f6024bc4f39'
const MENTOR_AGENT_ID = '69ec62bd913abe53de549399'

const AGENTS = [
  { id: SCENARIO_AGENT_ID, name: 'Scenario Generator', role: 'Creates debugging challenges' },
  { id: MENTOR_AGENT_ID, name: 'Code Mentor', role: 'Reviews code submissions' },
]

const SAMPLE_SCENARIO = {
  ticket_id: 'FE-1042',
  ticket_title: 'Fix broken useEffect cleanup in UserProfile',
  ticket_description: 'The UserProfile component has a memory leak. The useEffect that fetches user data does not clean up properly, causing state updates on unmounted components. Users see "Cannot perform a React state update on an unmounted component" warnings in the console.',
  acceptance_criteria: [
    'Add proper cleanup/abort controller to the fetch call',
    'Ensure no state updates occur after unmount',
    'Add userId to the useEffect dependency array',
    'Handle loading and error states gracefully',
  ],
  difficulty: 'Medium',
  tags: ['React', 'Hooks', 'Memory Leak', 'useEffect'],
  broken_code: `import { useState, useEffect } from 'react';\n\nfunction UserProfile({ userId }) {\n  const [user, setUser] = useState(null);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    fetch(\`/api/users/\${userId}\`)\n      .then(res => res.json())\n      .then(data => {\n        setUser(data);\n        setLoading(false);\n      });\n  }, []);\n\n  if (loading) return <div>Loading...</div>;\n  return <div>{user.name}</div>;\n}`,
  hint: 'The useEffect is missing a cleanup function and the dependency array is empty. Consider using an AbortController to cancel the fetch when the component unmounts or userId changes.',
}

const SAMPLE_REVIEW = {
  verdict: 'APPROVED',
  technical_score: 8,
  summary: 'Good fix that addresses the core memory leak issue. The AbortController pattern is correctly implemented and the dependency array is properly configured.',
  what_went_well: [
    'Correctly added AbortController for fetch cancellation',
    'Added userId to the dependency array',
    'Proper error handling with try/catch',
    'Clean separation of loading and error states',
  ],
  misconceptions: [
    'The error state should distinguish between abort errors and real errors',
  ],
  suggestions: [
    'Consider using a custom hook like useFetch to abstract the data fetching logic',
    'Add a retry mechanism for failed requests',
    'Consider using React Query or SWR for more robust data fetching',
  ],
  corrected_code: `import { useState, useEffect } from 'react';\n\nfunction UserProfile({ userId }) {\n  const [user, setUser] = useState(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState(null);\n\n  useEffect(() => {\n    const controller = new AbortController();\n    \n    async function fetchUser() {\n      try {\n        setLoading(true);\n        const res = await fetch(\`/api/users/\${userId}\`, {\n          signal: controller.signal\n        });\n        const data = await res.json();\n        setUser(data);\n      } catch (err) {\n        if (err.name !== 'AbortError') {\n          setError(err.message);\n        }\n      } finally {\n        setLoading(false);\n      }\n    }\n    \n    fetchUser();\n    return () => controller.abort();\n  }, [userId]);\n\n  if (loading) return <div>Loading...</div>;\n  if (error) return <div>Error: {error}</div>;\n  return <div>{user?.name}</div>;\n}`,
  learning_resources: [
    { title: 'React useEffect Cleanup', topic: 'React Hooks' },
    { title: 'AbortController MDN Docs', topic: 'Web APIs' },
    { title: 'Avoiding Race Conditions in React', topic: 'Advanced Patterns' },
  ],
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

function extractFileName(brokenCode?: string): string {
  if (!brokenCode) return 'Solution.jsx'
  const fnMatch = brokenCode.match(/function\s+([A-Z][a-zA-Z0-9]*)/)
  if (fnMatch?.[1]) return `${fnMatch[1]}.jsx`
  const constMatch = brokenCode.match(/(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)/)
  if (constMatch?.[1]) return `${constMatch[1]}.jsx`
  const classMatch = brokenCode.match(/class\s+([A-Z][a-zA-Z0-9]*)/)
  if (classMatch?.[1]) return `${classMatch[1]}.jsx`
  return 'Solution.jsx'
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1e1e1e', color: '#f8f8f2' }}>
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm mb-4" style={{ color: '#636d83' }}>{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 rounded-md text-sm font-medium" style={{ backgroundColor: '#a6e22e', color: '#1e1e1e' }}>Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Page() {
  const [scenario, setScenario] = useState<ScenarioData | null>(null)
  const [userCode, setUserCode] = useState('')
  const [review, setReview] = useState<ReviewData | null>(null)
  const [loadingScenario, setLoadingScenario] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [sampleMode, setSampleMode] = useState(false)
  const [error, setError] = useState('')
  const [scenarioCount, setScenarioCount] = useState(0)
  const [showAgents, setShowAgents] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [mobileTicketOpen, setMobileTicketOpen] = useState(true)
  const [activePanel, setActivePanel] = useState<'ticket' | 'editor'>('editor')
  const [submitFlash, setSubmitFlash] = useState<'approved' | 'rejected' | null>(null)

  // Session stats
  const [challengesCompleted, setChallengesCompleted] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)

  const initialLoadDone = useRef(false)

  // Load persisted data on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    // Welcome overlay
    if (typeof window === 'undefined') return
    const welcomed = localStorage.getItem('swe_sim_welcomed')
    if (!welcomed) {
      setShowWelcome(true)
    }

    // Session stats
    const savedChallenges = localStorage.getItem('swe_sim_challenges_completed')
    const savedScore = localStorage.getItem('swe_sim_total_score')
    const savedReviewCount = localStorage.getItem('swe_sim_review_count')
    if (savedChallenges) setChallengesCompleted(parseInt(savedChallenges, 10) || 0)
    if (savedScore) setTotalScore(parseFloat(savedScore) || 0)
    if (savedReviewCount) setReviewCount(parseInt(savedReviewCount, 10) || 0)

    // Persisted code
    const savedCode = localStorage.getItem('swe_sim_user_code')
    if (savedCode) setUserCode(savedCode)

    // Persisted scenario
    const savedScenario = localStorage.getItem('swe_sim_scenario')
    if (savedScenario) {
      try {
        const parsed = JSON.parse(savedScenario)
        if (parsed && typeof parsed === 'object') {
          setScenario(parsed)
          setScenarioCount(1)
          // If we had persisted code, keep it; otherwise load broken code
          if (!savedCode && parsed.broken_code) {
            setUserCode(parsed.broken_code)
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }, [])

  // Persist user code
  useEffect(() => {
    if (initialLoadDone.current && typeof window !== 'undefined') {
      localStorage.setItem('swe_sim_user_code', userCode)
    }
  }, [userCode])

  // Persist scenario
  useEffect(() => {
    if (scenario && initialLoadDone.current && typeof window !== 'undefined') {
      localStorage.setItem('swe_sim_scenario', JSON.stringify(scenario))
    }
  }, [scenario])

  // Persist session stats
  useEffect(() => {
    if (initialLoadDone.current && typeof window !== 'undefined') {
      localStorage.setItem('swe_sim_challenges_completed', String(challengesCompleted))
    }
  }, [challengesCompleted])
  useEffect(() => {
    if (initialLoadDone.current && typeof window !== 'undefined') {
      localStorage.setItem('swe_sim_total_score', String(totalScore))
    }
  }, [totalScore])
  useEffect(() => {
    if (initialLoadDone.current && typeof window !== 'undefined') {
      localStorage.setItem('swe_sim_review_count', String(reviewCount))
    }
  }, [reviewCount])

  const loadScenario = useCallback(async () => {
    if (sampleMode) {
      setScenario(SAMPLE_SCENARIO)
      setUserCode(SAMPLE_SCENARIO.broken_code)
      setReview(null)
      setShowReview(false)
      setError('')
      setScenarioCount(prev => prev + 1)
      return
    }
    setLoadingScenario(true)
    setError('')
    setActiveAgentId(SCENARIO_AGENT_ID)
    setReview(null)
    setShowReview(false)
    try {
      const result = await callAIAgent(
        'Generate a new React/JavaScript debugging scenario with a realistic Jira ticket and broken code that the developer needs to fix.',
        SCENARIO_AGENT_ID
      )
      setActiveAgentId(null)
      if (result.success) {
        const parsed = result?.response?.result ?? result?.response ?? null
        if (parsed && typeof parsed === 'object') {
          const s: ScenarioData = {
            ticket_id: parsed?.ticket_id ?? '',
            ticket_title: parsed?.ticket_title ?? 'Untitled',
            ticket_description: parsed?.ticket_description ?? '',
            acceptance_criteria: Array.isArray(parsed?.acceptance_criteria) ? parsed.acceptance_criteria : [],
            difficulty: parsed?.difficulty ?? 'Medium',
            tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
            broken_code: parsed?.broken_code ?? '',
            hint: parsed?.hint ?? '',
          }
          setScenario(s)
          setUserCode(s.broken_code ?? '')
          setScenarioCount(prev => prev + 1)
        } else {
          setError('Unexpected response format from Scenario Generator.')
        }
      } else {
        setError(result?.error ?? 'Failed to generate scenario.')
      }
    } catch (e: any) {
      setError(e?.message ?? 'Network error generating scenario.')
      setActiveAgentId(null)
    } finally {
      setLoadingScenario(false)
    }
  }, [sampleMode])

  // Auto-load first scenario only if nothing was loaded from localStorage
  useEffect(() => {
    if (scenarioCount === 0) {
      loadScenario()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    if (!userCode.trim() || !scenario) return

    if (sampleMode) {
      setSubmittingReview(true)
      await new Promise(r => setTimeout(r, 1500))
      setReview(SAMPLE_REVIEW)
      setShowReview(true)
      setSubmittingReview(false)
      // Update stats
      setChallengesCompleted(prev => prev + 1)
      setTotalScore(prev => prev + (SAMPLE_REVIEW.technical_score ?? 0))
      setReviewCount(prev => prev + 1)
      // Flash
      setSubmitFlash('approved')
      setTimeout(() => setSubmitFlash(null), 1500)
      return
    }

    setSubmittingReview(true)
    setError('')
    setActiveAgentId(MENTOR_AGENT_ID)
    try {
      const criteria = Array.isArray(scenario.acceptance_criteria) ? scenario.acceptance_criteria.join('; ') : ''
      const message = `Review this code submission.\n\nTicket: ${scenario.ticket_id ?? ''} - ${scenario.ticket_title ?? ''}\nDescription: ${scenario.ticket_description ?? ''}\nAcceptance Criteria: ${criteria}\n\nOriginal Broken Code:\n\`\`\`\n${scenario.broken_code ?? ''}\n\`\`\`\n\nUser's Submitted Fix:\n\`\`\`\n${userCode}\n\`\`\``

      const result = await callAIAgent(message, MENTOR_AGENT_ID)
      setActiveAgentId(null)
      if (result.success) {
        const parsed = result?.response?.result ?? result?.response ?? null
        if (parsed && typeof parsed === 'object') {
          const r: ReviewData = {
            verdict: parsed?.verdict ?? '',
            technical_score: typeof parsed?.technical_score === 'number' ? parsed.technical_score : 0,
            summary: parsed?.summary ?? '',
            what_went_well: Array.isArray(parsed?.what_went_well) ? parsed.what_went_well : [],
            misconceptions: Array.isArray(parsed?.misconceptions) ? parsed.misconceptions : [],
            suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
            corrected_code: parsed?.corrected_code ?? '',
            learning_resources: Array.isArray(parsed?.learning_resources) ? parsed.learning_resources : [],
          }
          setReview(r)
          setShowReview(true)
          // Update session stats
          setChallengesCompleted(prev => prev + 1)
          setTotalScore(prev => prev + (r.technical_score ?? 0))
          setReviewCount(prev => prev + 1)
          // Flash the submit button
          const isApproved = (r.verdict ?? '').toUpperCase().includes('APPROVED') && !(r.verdict ?? '').toUpperCase().includes('NEEDS')
          setSubmitFlash(isApproved ? 'approved' : 'rejected')
          setTimeout(() => setSubmitFlash(null), 1500)
        } else {
          setError('Unexpected response format from Code Mentor.')
        }
      } else {
        setError(result?.error ?? 'Failed to get code review.')
      }
    } catch (e: any) {
      setError(e?.message ?? 'Network error submitting review.')
      setActiveAgentId(null)
    } finally {
      setSubmittingReview(false)
    }
  }, [userCode, scenario, sampleMode])

  const handleNewScenario = useCallback(() => {
    setShowReview(false)
    setReview(null)
    setUserCode('')
    setSubmitFlash(null)
    loadScenario()
  }, [loadScenario])

  const handleDismissWelcome = () => {
    setShowWelcome(false)
    if (typeof window !== 'undefined') localStorage.setItem('swe_sim_welcomed', 'true')
  }

  const fileName = extractFileName(scenario?.broken_code)
  const avgGrade = reviewCount > 0 ? (totalScore / reviewCount).toFixed(1) : '--'

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#1e1e1e', color: '#f8f8f2' }}>
        {/* Top status bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 md:px-4 h-9" style={{ backgroundColor: '#007acc', fontSize: '12px' }}>
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <span className="font-semibold tracking-wide whitespace-nowrap">SWE Simulator</span>
            <span className="hidden md:inline" style={{ color: 'rgba(255,255,255,0.6)' }}>|</span>
            <span className="hidden md:inline truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {scenario?.ticket_id ? `${scenario.ticket_id}` : 'No ticket loaded'}
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {error && (
              <span className="hidden md:inline text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#f9267240', color: '#f8f8f2' }}>
                {error.length > 60 ? error.slice(0, 60) + '...' : error}
              </span>
            )}
            {/* Session stats */}
            <div className="hidden sm:flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
              <div className="flex items-center gap-1">
                <FiTarget className="h-3 w-3" />
                <span>Challenges: {challengesCompleted}</span>
              </div>
              <div className="flex items-center gap-1">
                <FiAward className="h-3 w-3" />
                <span>Avg Grade: {avgGrade}/10</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="sample-mode"
                checked={sampleMode}
                onCheckedChange={(checked) => {
                  setSampleMode(checked)
                  if (checked && !scenario) {
                    setScenario(SAMPLE_SCENARIO)
                    setUserCode(SAMPLE_SCENARIO.broken_code)
                  }
                }}
              />
              <Label htmlFor="sample-mode" className="text-xs cursor-pointer hidden sm:inline" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Sample Data
              </Label>
            </div>
            <button onClick={() => setShowAgents(!showAgents)} className="flex items-center gap-1 transition-colors" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <VscSettingsGear className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile ticket toggle bar */}
        <div className="flex-shrink-0 flex md:hidden items-center justify-between px-3 h-8" style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #3e3e3e' }}>
          <button
            onClick={() => setMobileTicketOpen(prev => !prev)}
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: '#66d9ef' }}
          >
            <VscSymbolFile className="h-3.5 w-3.5" />
            <span>Problem</span>
            {mobileTicketOpen ? <VscChevronLeft className="h-3 w-3" /> : <VscChevronRight className="h-3 w-3" />}
          </button>
          {scenario?.ticket_id && (
            <span className="text-[10px] font-mono" style={{ color: '#636d83' }}>{scenario.ticket_id}</span>
          )}
          {error && (
            <span className="md:hidden text-[10px] px-1.5 py-0.5 rounded truncate max-w-[140px]" style={{ backgroundColor: '#f9267240', color: '#f8f8f2' }}>
              {error.length > 30 ? error.slice(0, 30) + '...' : error}
            </span>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
          {/* Left panel - Ticket */}
          <div
            className={`overflow-hidden transition-all duration-200 ${mobileTicketOpen ? 'h-[45%] md:h-auto' : 'h-0 md:h-auto'} md:w-[40%] flex-shrink-0`}
            style={{
              borderRight: '1px solid #3e3e3e',
              borderBottom: mobileTicketOpen ? '1px solid #3e3e3e' : 'none',
              boxShadow: activePanel === 'ticket' ? '0 0 8px rgba(166, 226, 46, 0.08) inset' : 'none',
            }}
            onClick={() => setActivePanel('ticket')}
          >
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto">
                <TicketPanel scenario={scenario} loading={loadingScenario} />
              </div>
              <div className="flex-shrink-0 px-3 py-1 text-right" style={{ color: '#636d83', fontSize: '10px' }}>v1.1</div>
            </div>
          </div>

          {/* Right panel - Editor */}
          <div
            className="flex-1 overflow-hidden min-h-0"
            style={{
              boxShadow: activePanel === 'editor' ? '0 0 8px rgba(166, 226, 46, 0.08) inset' : 'none',
            }}
            onClick={() => setActivePanel('editor')}
          >
            <EditorPanel
              code={userCode}
              onChange={setUserCode}
              onSubmit={handleSubmit}
              isSubmitting={submittingReview}
              hasScenario={!!scenario}
              fileName={fileName}
              submitFlash={submitFlash}
            />
          </div>

          {/* Loading overlay */}
          <LoadingOverlay visible={submittingReview} />
        </div>

        {/* Bottom status bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 md:px-4 h-6" style={{ backgroundColor: '#007acc', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
          <div className="flex items-center gap-3">
            <button onClick={handleNewScenario} disabled={loadingScenario} className="flex items-center gap-1 transition-colors hover:text-white disabled:opacity-50">
              <VscRefresh className={`h-3 w-3 ${loadingScenario ? 'animate-spin' : ''}`} />
              <span>New Scenario</span>
            </button>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span>Scenarios: {scenarioCount}</span>
            {/* Mobile stats */}
            <span className="sm:hidden" style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span className="sm:hidden">Grade: {avgGrade}/10</span>
          </div>
          <div className="flex items-center gap-3">
            {AGENTS.map(a => (
              <div key={a.id} className="flex items-center gap-1">
                <VscCircleFilled className="h-2 w-2" style={{ color: activeAgentId === a.id ? '#a6e22e' : '#636d83' }} />
                <span className={`hidden sm:inline ${activeAgentId === a.id ? 'text-white' : ''}`}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent info panel */}
        {showAgents && (
          <div className="absolute bottom-8 right-4 z-40 rounded-lg shadow-2xl p-4 w-72" style={{ backgroundColor: '#2d2d2d', border: '1px solid #3e3e3e' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#636d83' }}>AI Agents</p>
            <div className="space-y-2">
              {AGENTS.map(a => (
                <div key={a.id} className="flex items-center gap-2">
                  <VscCircleFilled className="h-2.5 w-2.5 flex-shrink-0" style={{ color: activeAgentId === a.id ? '#a6e22e' : '#636d83' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: '#f8f8f2' }}>{a.name}</p>
                    <p className="text-[10px]" style={{ color: '#636d83' }}>{a.role}</p>
                  </div>
                  {activeAgentId === a.id && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded ml-auto flex-shrink-0" style={{ backgroundColor: '#a6e22e20', color: '#a6e22e' }}>active</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review modal */}
        <ReviewModal
          visible={showReview}
          review={review}
          onClose={() => setShowReview(false)}
          onNewScenario={handleNewScenario}
        />

        {/* Welcome overlay */}
        <WelcomeOverlay visible={showWelcome} onDismiss={handleDismissWelcome} />
      </div>
    </ErrorBoundary>
  )
}
