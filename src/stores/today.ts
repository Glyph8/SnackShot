import { format } from 'date-fns';
import { create } from 'zustand';

interface TodayState {
  viewDate: string; // 'yyyy-MM-dd'
  setViewDate: (date: string) => void;
  resetToToday: () => void;
}

export const useTodayStore = create<TodayState>((set) => ({
  viewDate: format(new Date(), 'yyyy-MM-dd'),
  setViewDate: (date) => set({ viewDate: date }),
  resetToToday: () => set({ viewDate: format(new Date(), 'yyyy-MM-dd') }),
}));
