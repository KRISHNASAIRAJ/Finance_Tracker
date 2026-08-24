import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { usePortfolioRecommend } from '../../hooks/useAI'
import { PageHeader } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { toast } from '../../components/ui/Toast'

export function AIRecommendationsPage() {
  const recommend = usePortfolioRecommend()
  const [recommendation, setRecommendation] = useState('')
  const [disclaimer, setDisclaimer] = useState('')

  const handleRecommend = async () => {
    try {
      const res = await recommend.mutateAsync()
      setRecommendation(res.recommendation ?? 'No recommendation returned.')
      setDisclaimer(res.disclaimer ?? '')
    } catch {
      toast.error('Failed to get recommendations')
    }
  }

  return (
    <div className="fade-up mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#101010] text-[#9BA5FF]">
          <Sparkles className="h-5 w-5" />
        </div>
        <PageHeader
          title="AI recommendations"
          subtitle="Goal-aware portfolio suggestions powered by AI"
        />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <Button onClick={handleRecommend} loading={recommend.isPending} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            {recommendation ? 'Regenerate recommendations' : 'Get recommendations'}
          </Button>

          {recommend.isPending && (
            <div className="flex items-center gap-2 py-4 text-sm text-white/50">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#9BA5FF]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#9BA5FF]" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#9BA5FF]" style={{ animationDelay: '300ms' }} />
              <span className="ml-1">Analyzing your portfolio...</span>
            </div>
          )}

          {!recommend.isPending && recommendation && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">{recommendation}</p>
              {disclaimer && (
                <p className="mt-3 border-t border-white/5 pt-2.5 text-[11px] leading-relaxed text-white/30">
                  {disclaimer}
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
