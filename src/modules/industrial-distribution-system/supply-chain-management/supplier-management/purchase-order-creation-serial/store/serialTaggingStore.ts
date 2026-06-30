import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SerialEntry } from '../types/serial-po.types';

export type RapidScanLogItem = {
    serial: string;
    lineId: number | null;
    productName: string;
    branchName: string;
    status: "success" | "error";
    message: string;
};

interface SerialTaggingStore {
    // Dictionary of drafts: poId -> lineId -> array of serial entries
    drafts: Record<number, Record<number, SerialEntry[]>>;
    // Dictionary of rapid scan logs: poId -> array of scanned items
    rapidScanLogs: Record<number, RapidScanLogItem[]>;
    
    addDraft: (poId: number, lineId: number, serial_number: string) => void;
    removeDraft: (poId: number, lineId: number, index: number) => void;
    
    addRapidScanLog: (poId: number, item: RapidScanLogItem) => void;
    clearRapidScanLogs: (poId: number) => void;
    
    clearDraftsForPO: (poId: number) => void;
}

export const useSerialTaggingStore = create<SerialTaggingStore>()(
    persist(
        (set) => ({
            drafts: {},
            rapidScanLogs: {},
            
            addDraft: (poId, lineId, serial_number) => set((state) => {
                const poDrafts = state.drafts[poId] || {};
                const lineDrafts = poDrafts[lineId] || [];
                
                // Avoid duplicates in draft (saved duplicates are checked in the hook)
                if (lineDrafts.some((s) => s.serial_number.toUpperCase() === serial_number.toUpperCase())) {
                    return state;
                }
                
                return {
                    drafts: {
                        ...state.drafts,
                        [poId]: {
                            ...poDrafts,
                            [lineId]: [...lineDrafts, { serial_number, saved: false }],
                        },
                    },
                };
            }),
            
            removeDraft: (poId, lineId, index) => set((state) => {
                const poDrafts = state.drafts[poId] || {};
                const lineDrafts = [...(poDrafts[lineId] || [])];
                
                lineDrafts.splice(index, 1);
                
                return {
                    drafts: {
                        ...state.drafts,
                        [poId]: {
                            ...poDrafts,
                            [lineId]: lineDrafts,
                        },
                    },
                };
            }),
            
            addRapidScanLog: (poId, item) => set((state) => {
                const logs = state.rapidScanLogs[poId] || [];
                // Add to start of array for newest first
                return {
                    rapidScanLogs: {
                        ...state.rapidScanLogs,
                        [poId]: [item, ...logs],
                    },
                };
            }),
            
            clearRapidScanLogs: (poId) => set((state) => {
                const newLogs = { ...state.rapidScanLogs };
                delete newLogs[poId];
                return { rapidScanLogs: newLogs };
            }),
            
            clearDraftsForPO: (poId) => set((state) => {
                const newDrafts = { ...state.drafts };
                const newLogs = { ...state.rapidScanLogs };
                delete newDrafts[poId];
                delete newLogs[poId];
                return { drafts: newDrafts, rapidScanLogs: newLogs };
            }),
        }),
        {
            name: 'ids-serial-tagging-drafts', // Unique key for localStorage
        }
    )
);
