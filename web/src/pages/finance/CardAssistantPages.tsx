import { useState, useRef, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Send, ArrowLeft, MessageCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCreditCards } from '../../hooks/data/useCreditCards'
import { useAskCardTnC } from '../../hooks/useAI'
import { PageHeader, EmptyState, LoadingSpinner } from '../../components/ui/Shared'
import { Card } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { toast } from '../../components/ui/Toast'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  disclaimer?: string
}

function ChatPanel({ cardId, onBack }: { cardId: string; onBack?: () => void }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: cards } = useCreditCards(userId)
  const askCard = useAskCardTnC()

  const card = (cards ?? []).find((c) => c.id === cardId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const q = input.trim()
    if (!q || !card) return
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    try {
      const res = await askCard.mutateAsync({ cardId, question: q })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer ?? 'No answer returned.', disclaimer: res.disclaimer },
      ])
    } catch {
      toast.error('Failed to get answer')
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!card) return <EmptyState icon={MessageCircle} title="Card not found" subtitle="Select a credit card to ask about its T&C" />

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-3 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to assistant
        </button>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{card.name}</h2>
          <p className="text-xs text-white/40">T&C Q&A · {card.network} · •••• {card.ending_with}</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-8 w-8 text-white/15 mb-3" />
              <p className="text-sm text-white/50">Ask a question about this card's terms & conditions</p>
              <p className="mt-1 text-xs text-white/30">e.g. What is the annual fee? What are the lounge benefits?</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  m.role === 'user'
                    ? 'bg-white/10 text-white'
                    : 'border border-white/10 bg-[#1A1A1A] text-white/90'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                {m.disclaimer && (
                  <p className="mt-1.5 text-[10px] text-white/30 leading-tight">{m.disclaimer}</p>
                )}
              </div>
            </div>
          ))}
          {askCard.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/30" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/30" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/30" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about T&C..."
              disabled={askCard.isPending}
              className="flex-1 h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 focus:border-white/35 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || askCard.isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-white/85 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function CardAssistantPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: cards, isLoading } = useCreditCards(userId)

  const [selectedCardId, setSelectedCardId] = useState('')

  if (isLoading) return <LoadingSpinner />

  if ((cards ?? []).length === 0) {
    return (
      <div className="fade-up space-y-5">
        <PageHeader title="Card assistant" subtitle="Ask about your card's T&C" />
        <EmptyState icon={MessageCircle} title="No credit cards" subtitle="Add a credit card first to use the assistant" />
      </div>
    )
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader title="Card assistant" subtitle="Ask about your card's T&C" />

      <div className="max-w-sm">
        <Field.Select
          label="Select a card"
          value={selectedCardId}
          onChange={(e) => setSelectedCardId(e.target.value)}
          options={[
            { value: '', label: 'Choose a card...' },
            ...(cards ?? []).map((c) => ({ value: c.id, label: `${c.name} (•••• ${c.ending_with})` })),
          ]}
        />
      </div>

      {selectedCardId ? (
        <ChatPanel cardId={selectedCardId} />
      ) : (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <MessageCircle className="h-10 w-10 text-white/15 mb-3" />
          <p className="text-sm text-white/50">Select a card above to start asking questions</p>
        </Card>
      )}
    </div>
  )
}

export function CardChatPage() {
  const { id } = useParams()

  return (
    <div className="fade-up space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/finance/cards" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title="Card T&C Chat" />
      </div>

      {id ? <ChatPanel cardId={id} /> : <EmptyState icon={MessageCircle} title="No card selected" subtitle="Use /finance/cards to pick a card" />}
    </div>
  )
}