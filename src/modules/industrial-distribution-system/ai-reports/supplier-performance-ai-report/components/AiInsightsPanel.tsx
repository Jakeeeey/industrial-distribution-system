/**
 * AI Insights Banner Component
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Removed 'Offline Engine' diagnostic badge for a clean, uniform UI
 * - Soft purple theme matching reference
 * - Status paragraph + 3 Key Exposures + 3 Strategic Actions
 */

'use client';

import React from 'react';
import { AiInsightResponse, AiTierSlug } from '../types';
import { Sparkles, X, AlertCircle } from 'lucide-react';

interface AiInsightsPanelProps {
    aiInsight: AiInsightResponse | null;
    activeTier: AiTierSlug;
    isAiLoading: boolean;
    onDismiss: () => void;
}

export const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({
    aiInsight,
    activeTier,
    isAiLoading,
    onDismiss,
}) => {
    if (isAiLoading) {
        return (
            <div className="w-full bg-purple-50/70 border border-purple-200/80 rounded-2xl p-5 shadow-xs animate-pulse dark:bg-purple-950/20 dark:border-purple-900/60">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 animate-spin" />
                    <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                        Gemini AI analyzing supplier delivery patterns...
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
        <div className="w-full bg-[#FAF7FD] border border-purple-200/90 rounded-2xl p-5 sm:p-6 shadow-xs relative transition-all dark:bg-[#1a1523] dark:border-purple-900/60">
            {/* Header with Title & Dismiss Button - Clean without offline badge */}
            <div className="flex items-center justify-between pb-3 border-b border-purple-100 dark:border-purple-900/40">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-purple-800 dark:text-purple-300">
                        AI {tierTitle} INSIGHTS
                    </h2>
                </div>

                <button
                    type="button"
                    onClick={onDismiss}
                    className="p-1 rounded-md text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-950 transition-colors"
                    title="Dismiss Insight"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Main Executive Summary Paragraph */}
            <div className="pt-3 text-xs sm:text-[13px] leading-relaxed text-foreground/90">
                {aiInsight.summary}
            </div>

            {/* Two-Column Bulleted Layout: Key Exposures vs Strategic Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 pt-4 border-t border-purple-100/80 dark:border-purple-900/40">
                {/* Left Column: Key Exposures & Risks */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                        <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                        KEY EXPOSURES & RISKS
                    </div>
                    <ul className="space-y-2 text-xs text-foreground/80 pl-2">
                        {aiInsight.keyExposures.map((exp, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="text-muted-foreground mt-0.5">•</span>
                                <span className="leading-snug">{exp}</span>
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
                    <ul className="space-y-2 text-xs text-foreground/80 pl-2">
                        {aiInsight.strategicActions.map((act, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="text-muted-foreground mt-0.5">•</span>
                                <span className="leading-snug">{act}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Advisory Disclaimer */}
            <div className="mt-4 pt-3 border-t border-purple-100/60 dark:border-purple-900/30 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    {aiInsight.disclaimer}
                </span>
                <span className="text-[10px] hidden sm:inline text-purple-700/70 dark:text-purple-300/70">
                    Model: {aiInsight.model}
                </span>
            </div>
        </div>
    );
};
