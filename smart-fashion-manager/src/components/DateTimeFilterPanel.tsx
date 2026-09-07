/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { Calendar, Clock, RotateCcw, Filter, ChevronDown, Check } from 'lucide-react';
import { DATE_PRESETS, calculatePresetDates } from '../utils/dateFilter';

interface DateTimeFilterPanelProps {
  title?: string;
}

export const DateTimeFilterPanel: React.FC<DateTimeFilterPanelProps> = ({ title }) => {
  const { dateFilter, setDateFilter } = useAppState();

  // Local state for the filter panel inputs (updates global state on Apply)
  const [localPreset, setLocalPreset] = useState(dateFilter.preset);
  const [localFromDate, setLocalFromDate] = useState(dateFilter.fromDate);
  const [localToDate, setLocalToDate] = useState(dateFilter.toDate);
  const [localStartTime, setLocalStartTime] = useState(dateFilter.startTime || '');
  const [localEndTime, setLocalEndTime] = useState(dateFilter.endTime || '');
  const [showTimeFilters, setShowTimeFilters] = useState(!!(dateFilter.startTime || dateFilter.endTime));

  // Sync with global state when it changes
  useEffect(() => {
    setLocalPreset(dateFilter.preset);
    setLocalFromDate(dateFilter.fromDate);
    setLocalToDate(dateFilter.toDate);
    setLocalStartTime(dateFilter.startTime || '');
    setLocalEndTime(dateFilter.endTime || '');
    setShowTimeFilters(!!(dateFilter.startTime || dateFilter.endTime));
  }, [dateFilter]);

  // Handle Preset change
  const handlePresetChange = (presetId: string) => {
    setLocalPreset(presetId);
    if (presetId !== 'custom') {
      const dates = calculatePresetDates(presetId);
      setLocalFromDate(dates.fromDate);
      setLocalToDate(dates.toDate);
    }
  };

  // Handle Apply
  const handleApply = () => {
    setDateFilter({
      preset: localPreset,
      fromDate: localFromDate,
      toDate: localToDate,
      startTime: showTimeFilters ? localStartTime : '',
      endTime: showTimeFilters ? localEndTime : '',
    });
  };

  // Handle Reset to Today
  const handleReset = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultFilter = {
      preset: 'today',
      fromDate: todayStr,
      toDate: todayStr,
      startTime: '',
      endTime: '',
    };
    setDateFilter(defaultFilter);
    setLocalPreset('today');
    setLocalFromDate(todayStr);
    setLocalToDate(todayStr);
    setLocalStartTime('');
    setLocalEndTime('');
    setShowTimeFilters(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg space-y-4 print-hide" id="pos-enterprise-filter-panel">
      {/* Title & Subtitle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-300">
            {title || 'Enterprise Date & Time Filter Engine'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live Synchronized Feed</span>
        </div>
      </div>

      {/* Inputs row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {/* Preset Select */}
        <div className="md:col-span-3 space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Quick Date Preset
          </label>
          <div className="relative">
            <select
              id="filter-preset-select"
              value={localPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-xs py-2 px-3 text-amber-100 font-bold focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none appearance-none cursor-pointer transition"
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-950 text-slate-300 font-normal">
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Dates - From */}
        <div className="md:col-span-2.5 space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-amber-500/80" /> From Date
          </label>
          <div className="relative premium-date-container group">
            <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
            <input
              id="filter-from-date"
              type="date"
              value={localFromDate}
              onChange={(e) => {
                setLocalFromDate(e.target.value);
                setLocalPreset('custom');
              }}
              className="peer w-full bg-slate-950 border border-slate-800 rounded-lg text-xs py-2 pl-9 pr-3 text-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition"
            />
          </div>
        </div>

        {/* Dates - To */}
        <div className="md:col-span-2.5 space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-amber-500/80" /> To Date
          </label>
          <div className="relative premium-date-container group">
            <Calendar className="absolute left-3 w-4 h-4 text-amber-500/70 group-hover:text-amber-400 peer-disabled:text-slate-600 transition-colors pointer-events-none z-30" />
            <input
              id="filter-to-date"
              type="date"
              value={localToDate}
              onChange={(e) => {
                setLocalToDate(e.target.value);
                setLocalPreset('custom');
              }}
              className="peer w-full bg-slate-950 border border-slate-800 rounded-lg text-xs py-2 pl-9 pr-3 text-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition"
            />
          </div>
        </div>

        {/* Optional Time Filters */}
        <div className="md:col-span-4 flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 select-none">
                <Clock className="w-3 h-3 text-amber-500/80" /> Start Time
              </label>
              <button
                id="toggle-time-filters"
                type="button"
                onClick={() => setShowTimeFilters(!showTimeFilters)}
                className={`text-[9px] font-bold uppercase tracking-wider ${showTimeFilters ? 'text-amber-500' : 'text-slate-500'} hover:text-amber-400 transition`}
              >
                {showTimeFilters ? 'Remove Time' : '+ Add Time'}
              </button>
            </div>
            {showTimeFilters ? (
              <div className="flex items-center gap-2">
                <input
                  id="filter-start-time"
                  type="time"
                  value={localStartTime}
                  onChange={(e) => setLocalStartTime(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg text-xs py-2 px-3 text-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  id="filter-end-time"
                  type="time"
                  value={localEndTime}
                  onChange={(e) => setLocalEndTime(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg text-xs py-2 px-3 text-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition"
                />
              </div>
            ) : (
              <div className="w-full bg-slate-950/40 border border-slate-800/60 rounded-lg text-xs py-2 px-3 text-slate-600 italic select-none">
                All Day Transactions Billed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Button controls */}
      <div className="flex justify-end items-center gap-3 border-t border-slate-850 pt-3">
        <button
          id="btn-filter-reset"
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-950/30 px-3 py-1.5 rounded-lg transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
        <button
          id="btn-filter-apply"
          type="button"
          onClick={handleApply}
          className="flex items-center gap-1.5 text-xs text-slate-950 bg-amber-500 hover:bg-amber-400 font-black uppercase tracking-widest px-5 py-1.5 rounded-lg border border-amber-600/20 shadow-lg shadow-amber-500/5 hover:scale-[1.01] active:scale-[0.99] transition"
        >
          <Check className="w-4 h-4 text-slate-950" />
          <span>Apply Filter Range</span>
        </button>
      </div>
    </div>
  );
};
