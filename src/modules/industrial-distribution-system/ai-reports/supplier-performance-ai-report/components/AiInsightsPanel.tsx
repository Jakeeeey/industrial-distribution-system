/**
 * AI Insights Banner Component
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Fixed unwanted page scrolling on chat input: Replaced global element.scrollIntoView() with scoped chatContainerRef.scrollTop
 * - Markdown rendering via react-markdown (clean typography, no raw asterisks)
 * - Removed internal AI model name
 * - Interactive Q&A conversational message chat with max-h-96 scroll limit & session reset
 * - Executive Overview structured into 3 C-Suite Strategic Pillars (Commercial, Logistics, Governance)
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { AiInsightResponse, AiTierSlug, ChatMessage } from '../types';
import {
    Sparkles,
    X,
    AlertCircle,
    BarChart3,
    MessageSquare,
    Send,
    RotateCcw,
    Bot,
    User,
    ShieldAlert,
    TrendingDown,
    Scale,
} from 'lucide-react';

interface AiInsightsPanelProps {
    aiInsight: AiInsightResponse | null;
    activeTier: AiTierSlug;
    isAiLoading: boolean;
    onDismiss: () => void;
    onAskCustomQuery: (query: string) => Promise<void>;
}

export const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({
    aiInsight,
    activeTier,
    isAiLoading,
    onDismiss,
    onAskCustomQuery,
}) => {
    // Two-screen view state: 'overview' vs 'qa'
    const [activeScreen, setActiveScreen] = useState<'overview' | 'qa'>('overview');
    const [userQuestion, setUserQuestion] = useState('');
    const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);

    // Conversational Chat message history
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    // Scoped container ref (only scrolls inner chat container, NOT the outer window)
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const isExecutive = activeTier === 'executive';

    // Auto-scroll ONLY the inner chat container to the latest message without scrolling the main browser window
    useEffect(() => {
        if (activeScreen === 'qa' && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages, isSubmittingQuery, activeScreen]);

    // Append AI response to chat thread when new answer arrives
    useEffect(() => {
        if (aiInsight?.qaAnswer && aiInsight.userQuery) {
            setChatMessages((prev) => {
                // Avoid duplicating the same answer
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === aiInsight.qaAnswer) {
                    return prev;
                }
                return [
                    ...prev,
                    {
                        id: `ai-${Date.now()}`,
                        role: 'assistant',
                        content: aiInsight.qaAnswer!,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                ];
            });
        }
    }, [aiInsight?.qaAnswer, aiInsight?.userQuery]);

    // Handle sending a chat message
    const handleSendChat = async (queryText?: string) => {
        const textToSubmit = (queryText || userQuestion).trim();
        if (!textToSubmit) return;

        // Append user message immediately
        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: textToSubmit,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, userMsg]);
        setUserQuestion('');
        setIsSubmittingQuery(true);

        try {
            await onAskCustomQuery(textToSubmit);
        } finally {
            setIsSubmittingQuery(false);
        }
    };

    // Close and reset chat history completely
    const handleClose = () => {
        setChatMessages([]);
        setUserQuestion('');
        onDismiss();
    };

    if (isAiLoading && !aiInsight) {
        return (
            <div className="w-full bg-purple-50/70 border border-purple-200/80 rounded-2xl p-5 shadow-xs animate-pulse dark:bg-purple-950/20 dark:border-purple-900/60">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 animate-spin" />
                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                        Centralized Core AI Engine synthesizing supplier delivery intelligence...
                    </span>
                </div>
                <div className="mt-3 h-4 bg-purple-200/50 rounded w-3/4" />
                <div className="mt-2 h-4 bg-purple-200/30 rounded w-1/2" />
            </div>
        );
    }

    if (!aiInsight) {
        return null;
    }

    const tierTitle = aiInsight.tierName || activeTier.toUpperCase();

    return (
        <div className="w-full bg-[#FAF7FD] border border-purple-200/90 rounded-2xl p-5 sm:p-6 shadow-xs relative transition-all dark:bg-[#1a1523] dark:border-purple-900/60 space-y-4">
            {/* Header: Title + Screen Switcher (Executive Tier Only) + Dismiss Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-purple-100 dark:border-purple-900/40 gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-purple-800 dark:text-purple-300">
                        AI {tierTitle} INSIGHTS
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {/* Screen Switcher (Executive Tier Only) */}
                    {isExecutive && (
                        <div className="inline-flex items-center p-0.5 bg-purple-100/70 dark:bg-purple-950/70 rounded-lg border border-purple-200/80 dark:border-purple-800/60 text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => setActiveScreen('overview')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                                    activeScreen === 'overview'
                                        ? 'bg-white dark:bg-purple-900 text-purple-900 dark:text-purple-100 shadow-2xs font-semibold'
                                        : 'text-purple-700 dark:text-purple-300 hover:text-purple-900'
                                }`}
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                                Executive Overview
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveScreen('qa')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                                    activeScreen === 'qa'
                                        ? 'bg-white dark:bg-purple-900 text-purple-900 dark:text-purple-100 shadow-2xs font-semibold'
                                        : 'text-purple-700 dark:text-purple-300 hover:text-purple-900'
                                }`}
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Interactive Q&A
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1 rounded-md text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-950 transition-colors"
                        title="Dismiss Insight & Reset Chat"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* SCREEN 1: EXECUTIVE-GRADE OVERVIEW WITH 3 STRATEGIC PILLARS */}
            {activeScreen === 'overview' && (
                <div className="space-y-4">
                    {/* Executive Summary Paragraph with Markdown support */}
                    <div className="text-xs sm:text-[13px] leading-relaxed text-foreground/90 font-medium">
                        <ReactMarkdown>{aiInsight.summary}</ReactMarkdown>
                    </div>

                    {/* Executive Strategic Pillars (If Executive Tier) */}
                    {isExecutive && aiInsight.executivePillars && aiInsight.executivePillars.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                            {aiInsight.executivePillars.map((p, idx) => (
                                <div
                                    key={idx}
                                    className="p-3.5 rounded-xl border border-purple-200/80 bg-white/80 dark:bg-purple-950/40 dark:border-purple-850 shadow-2xs space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200 flex items-center gap-1">
                                            {idx === 0 && <TrendingDown className="h-3.5 w-3.5 text-rose-500" />}
                                            {idx === 1 && <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
                                            {idx === 2 && <Scale className="h-3.5 w-3.5 text-blue-500" />}
                                            {p.pillar}
                                        </span>
                                        <span
                                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                                p.status === 'CRITICAL'
                                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                    : p.status === 'ACTION_REQUIRED'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            }`}
                                        >
                                            {p.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-snug">
                                        {p.findings}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* Two-Column Bulleted Layout: Key Exposures vs Strategic Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-purple-100/80 dark:border-purple-900/40">
                        {/* Left Column: Key Exposures & Risks */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                                <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                                KEY EXPOSURES & RISKS
                            </div>
                            <ul className="space-y-2 text-xs text-foreground/85 pl-2">
                                {aiInsight.keyExposures.map((exp, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <span className="text-muted-foreground mt-0.5">•</span>
                                        <span className="leading-snug">
                                            <ReactMarkdown>{exp}</ReactMarkdown>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Right Column: Strategic Actions */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                                STRATEGIC ACTIONS
                            </div>
                            <ul className="space-y-2 text-xs text-foreground/85 pl-2">
                                {aiInsight.strategicActions.map((act, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <span className="text-muted-foreground mt-0.5">•</span>
                                        <span className="leading-snug">
                                            <ReactMarkdown>{act}</ReactMarkdown>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* SCREEN 2: CONVERSATIONAL MESSAGE CHAT INTERFACE */}
            {activeScreen === 'qa' && (
                <div className="space-y-3">
                    {/* Chat Messages Scroll Container with max-h-96 limit and scoped container ref */}
                    <div
                        ref={chatContainerRef}
                        className="max-h-96 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-purple-200"
                    >
                        {/* Welcome message if no chat history */}
                        {chatMessages.length === 0 && (
                            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 text-xs">
                                <Bot className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                                <div className="space-y-1 text-purple-950 dark:text-purple-200">
                                    <p className="font-semibold">Welcome to the Executive Copilot Chat.</p>
                                    <p className="text-muted-foreground text-[11px]">
                                        Ask direct questions regarding supplier reliability, lead-time variances, and negotiation strategies. Messages remain active during this session and reset upon closing.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Render Conversation Thread */}
                        {chatMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex items-start gap-2.5 ${
                                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5">
                                        <Bot className="h-3.5 w-3.5" />
                                    </div>
                                )}

                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-purple-600 text-white font-medium rounded-tr-none'
                                            : 'bg-white dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800 text-foreground rounded-tl-none prose prose-xs dark:prose-invert max-w-none'
                                    }`}
                                >
                                    {msg.role === 'assistant' ? (
                                        <div className="space-y-2 prose-headings:font-bold prose-headings:text-xs prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span>{msg.content}</span>
                                    )}
                                    <div
                                        className={`text-[9px] mt-1 text-right ${
                                            msg.role === 'user' ? 'text-purple-200' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {msg.timestamp}
                                    </div>
                                </div>

                                {msg.role === 'user' && (
                                    <div className="p-1.5 rounded-lg bg-muted text-foreground shrink-0 mt-0.5">
                                        <User className="h-3.5 w-3.5" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading pulse bubble while generating */}
                        {isSubmittingQuery && (
                            <div className="flex items-start gap-2.5 justify-start">
                                <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5 animate-spin">
                                    <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                                </div>
                                <div className="rounded-2xl px-4 py-2.5 bg-white dark:bg-purple-950/50 border border-purple-200 text-xs text-muted-foreground rounded-tl-none animate-pulse">
                                    Analyzing operational data with Gemini...
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40">
                        <span className="text-[10px] text-muted-foreground font-semibold">Quick chips:</span>
                        {[
                            'What can we do to lessen the degree of high risk vendors?',
                            'Top 3 delivery bottlenecks',
                            'Renegotiation target suppliers',
                        ].map((chip) => (
                            <button
                                key={chip}
                                type="button"
                                onClick={() => handleSendChat(chip)}
                                disabled={isSubmittingQuery}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100/70 text-purple-800 hover:bg-purple-200/80 dark:bg-purple-900/60 dark:text-purple-200 transition-colors disabled:opacity-50 truncate max-w-xs"
                            >
                                ⚡ {chip}
                            </button>
                        ))}
                    </div>

                    {/* Bottom Pinned Prompt Input Bar */}
                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="text"
                            value={userQuestion}
                            onChange={(e) => setUserQuestion(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendChat();
                                }
                            }}
                            placeholder="Type an inquiry and press Enter..."
                            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-purple-200 bg-white/95 dark:bg-purple-950/40 dark:border-purple-800 text-foreground focus:outline-hidden focus:ring-1 focus:ring-purple-500 shadow-2xs"
                        />
                        {chatMessages.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setChatMessages([])}
                                className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-input bg-background"
                                title="Clear conversation"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => handleSendChat()}
                            disabled={isSubmittingQuery || !userQuestion.trim()}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 shadow-xs transition-all disabled:opacity-50 shrink-0"
                        >
                            <Send className="h-3.5 w-3.5" />
                            Send
                        </button>
                    </div>
                </div>
            )}

            {/* Advisory Disclaimer (Model Name Removed) */}
            <div className="pt-3 border-t border-purple-100/60 dark:border-purple-900/30 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                    {aiInsight.disclaimer}
                </span>
            </div>
        </div>
    );
};
