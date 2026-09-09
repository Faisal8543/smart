/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface AiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ isOpen, onClose }) => {
  const { products, invoices, expenses, settings } = useAppState();
  const storeName = settings?.storeProfile?.name || 'SMART FASHION';
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: `Greetings. I am your ${storeName} AI Business Partner. I can analyze your sales logs, review inventory, forecast upcoming trends, or draft high-end promotional copies. Ask me anything!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Package current business data to ground the AI's responses
  const getBusinessContextData = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const lowStockItems = products.filter(p => p.currentStock <= p.minStockAlert).map(p => ({
      name: p.name,
      sku: p.sku,
      current: p.currentStock,
      alertThreshold: p.minStockAlert,
    }));

    const todaySales = invoices
      .filter(inv => inv.date.startsWith(todayStr))
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    const totalSales = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

    // Group expenses by category
    const expenseStats: Record<string, number> = {};
    expenses.forEach((e) => {
      expenseStats[e.category] = (expenseStats[e.category] || 0) + e.amount;
    });

    return {
      productCount: products.length,
      lowStockItems,
      todaySales,
      totalSales,
      expenseStats,
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);

    try {
      const context = getBusinessContextData();
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userMsg.text,
          businessData: context,
          history: messages.slice(-6), // Send last 6 messages to keep context short and sweet
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error(data.error || 'Server error calling AI Assistant');
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Forgive me, but I encountered an error connecting to the intelligence bridge: ${err.message || 'Verification timed out'}. Please confirm your API key and retry.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed right-0 w-full sm:w-96 bg-slate-900 border-l border-amber-500/20 z-35 shadow-2xl flex flex-col justify-between select-none"
      style={{
        top: 'var(--header-height)',
        height: 'calc(100vh - var(--header-height))',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-amber-500/10 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-amber-500/20 bg-amber-500/5 flex items-center justify-center text-amber-500">
            <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-amber-100">AI Business Partner</h3>
            <p className="text-[9px] text-amber-500/60 uppercase tracking-widest font-semibold">Smart Fashion Intel</p>
          </div>
        </div>
        <button
          id="close-ai-panel"
          onClick={onClose}
          className="text-slate-400 hover:text-amber-500 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col max-w-[85%] ${
              msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div
              className={`p-3 rounded-2xl text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none whitespace-pre-wrap'
              }`}
            >
              {msg.text}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 font-mono">{msg.timestamp}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-amber-500 text-xs font-medium mr-auto p-2 bg-slate-900/50 rounded-xl border border-slate-800/60 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating business advice...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-slate-950 border-t border-amber-500/10">
        {/* Quick Suggestion Tags */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
          {[
            'Write a high-end promo for Tuxedos',
            'Analyze my low-stock list',
            'How are my sales today?',
            'Suggest cost saving measures',
          ].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setPrompt(tag)}
              className="text-[10px] whitespace-nowrap bg-slate-900 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/20 text-slate-400 hover:text-amber-300 px-2.5 py-1 rounded-full transition"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="relative flex items-center">
          <input
            id="ai-prompt-input"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Review showroom performance..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl py-3 pl-4 pr-12 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
            disabled={loading}
          />
          <button
            id="send-ai-prompt"
            type="submit"
            className="absolute right-2 w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition disabled:opacity-50"
            disabled={!prompt.trim() || loading}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
