'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Menu, X, Plus, MessageCircle, Send, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

const CHAT_AGENT_ID = '68fd263d71c6b27d6c8eb80f'
const SUGGESTED_PROMPTS = [
  'What is machine learning?',
  'Explain quantum computing',
  'How does photosynthesis work?',
  'Tell me about the history of AI',
]

export default function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [agentId, setAgentId] = useState<string>(CHAT_AGENT_ID)

  // Load conversations from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('conversations')
    if (saved) {
      const parsed = JSON.parse(saved)
      setConversations(parsed)
      if (parsed.length > 0) {
        setCurrentConversationId(parsed[0].id)
      }
    }
  }, [])

  // Save conversations to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversations', JSON.stringify(conversations))
    }
  }, [conversations])

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversations, currentConversationId])

  const currentConversation = conversations.find((c) => c.id === currentConversationId)

  const createNewConversation = () => {
    const id = `conv-${Date.now()}`
    const newConversation: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
    }
    setConversations([newConversation, ...conversations])
    setCurrentConversationId(id)
    setError(null)
  }

  const deleteConversation = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id)
    setConversations(updated)
    if (currentConversationId === id) {
      setCurrentConversationId(updated.length > 0 ? updated[0].id : null)
    }
  }

  const sendMessage = async (message: string) => {
    if (!message.trim() || !currentConversationId || !agentId) return

    setError(null)
    setIsLoading(true)

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    }

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, userMessage] }
          : conv
      )
    )

    setInputValue('')

    try {
      // Get conversation context for better responses
      const conversationHistory = currentConversation?.messages.slice(-10) || []
      const contextMessages = conversationHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')

      const fullPrompt = contextMessages
        ? `Previous conversation:\n${contextMessages}\n\nUser: ${message}`
        : message

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullPrompt,
          agent_id: agentId,
          user_id: `user-${Date.now()}`,
          session_id: currentConversationId,
        }),
      })

      const data = await response.json()

      if (data.success && data.response) {
        // Extract response text
        const responseText =
          typeof data.response === 'string'
            ? data.response
            : data.response?.result || data.response?.response || JSON.stringify(data.response)

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
        }

        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === currentConversationId) {
              // Update title if it's the first message
              const updatedConv = {
                ...conv,
                messages: [...conv.messages, assistantMessage],
              }
              if (conv.messages.length === 1) {
                updatedConv.title = message.substring(0, 50) + (message.length > 50 ? '...' : '')
              }
              return updatedConv
            }
            return conv
          })
        )
      } else {
        setError(data.error || 'Failed to get response from AI')
        // Remove the user message on error
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: conv.messages.filter((m) => m.id !== userMessage.id),
                }
              : conv
          )
        )
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      // Remove the user message on error
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: conv.messages.filter((m) => m.id !== userMessage.id),
              }
            : conv
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendClick = () => {
    sendMessage(inputValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt)
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-700">
          <Button
            onClick={createNewConversation}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setCurrentConversationId(conv.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium truncate flex-1">{conv.title}</p>
                </div>
                <p className="text-xs opacity-70">
                  {conv.messages.length} messages
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-gray-700 text-xs text-gray-400">
          <p>Chat Assistant Agent</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-300 hover:text-white"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
            <h1 className="text-xl font-semibold">Knowledge Assistant</h1>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6 py-6">
          {currentConversation && currentConversation.messages.length > 0 ? (
            <div className="space-y-4 max-w-3xl mx-auto">
              {currentConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xl rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs opacity-60 mt-2">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 text-gray-100 rounded-lg px-4 py-3">
                    <div className="flex gap-2 items-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-lg">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h2 className="text-2xl font-semibold mb-2">Start a Conversation</h2>
                <p className="text-gray-400 mb-6">
                  Ask me anything and I'll help you find answers
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="justify-start text-left border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-red-900 text-red-100 border-t border-red-700">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              <p className="text-sm">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-100 hover:text-red-50"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
          {!currentConversationId ? (
            <div className="text-center text-gray-400 mb-4">
              <p className="text-sm">Create a new conversation to start chatting</p>
            </div>
          ) : null}
          <div className="flex gap-3 max-w-3xl mx-auto">
            <Input
              type="text"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!currentConversationId || isLoading}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500"
            />
            <Button
              onClick={handleSendClick}
              disabled={!inputValue.trim() || !currentConversationId || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
