import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ActivityItem } from '../types';
import { formatINR } from '../utils/finance';

interface ActivityFeedViewProps {
  items: ActivityItem[];
  onSelectGroup: (groupId: string) => void;
}

export const ActivityFeedView: React.FC<ActivityFeedViewProps> = ({ items, onSelectGroup }) => {
  const [filter, setFilter] = useState<'all' | 'expense' | 'settlement'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.expense.type !== filter) return false;
      if (!q) return true;
      return (
        item.expense.title.toLowerCase().includes(q) ||
        item.groupName.toLowerCase().includes(q) ||
        item.expense.paidByName.toLowerCase().includes(q) ||
        item.expense.settledToName.toLowerCase().includes(q)
      );
    });
  }, [items, filter, searchQuery]);

  const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Activity Feed
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Chronological history of all expenses and settlements across your groups
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses or groups..."
              className="pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 w-56"
            />
          </div>

          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'expense', 'settlement'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === tab
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'expense' ? 'Expenses' : 'Settlements'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No matching activity found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Expenses added and settlements recorded in your groups will appear here in chronological order.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredItems.map((item) => {
              const { expense, groupName, myNetImpact, myMemberId } = item;
              const isSettlement = expense.type === 'settlement';

              return (
                <li
                  key={`${expense.groupId}_${expense.id}`}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {expense.title}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectGroup(expense.groupId)}
                        className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        {groupName}
                      </button>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                      {isSettlement ? (
                        <span>
                          {myMemberId === expense.paidByMemberId ? 'You' : expense.paidByName} settled{' '}
                          {formatINR(expense.amount)} with{' '}
                          {myMemberId === expense.settledToMemberId ? 'you' : expense.settledToName}
                        </span>
                      ) : (
                        <span>
                          {myMemberId === expense.paidByMemberId ? 'You' : expense.paidByName} paid{' '}
                          {formatINR(expense.amount)} ({expense.splitType} split)
                        </span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{dateTimeFormatter.format(expense.createdAt)}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    {Math.abs(myNetImpact) < 0.01 ? (
                      <span className="text-xs text-slate-400">No net change</span>
                    ) : (
                      <div>
                        <span
                          className={`font-mono-nums text-sm font-semibold ${
                            myNetImpact > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatINR(myNetImpact, true)}
                        </span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isSettlement
                            ? myNetImpact > 0
                              ? 'settled debt'
                              : 'received'
                            : myNetImpact > 0
                              ? 'owed to you'
                              : 'you owe'}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
