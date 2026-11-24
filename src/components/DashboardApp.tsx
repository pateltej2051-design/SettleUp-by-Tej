import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  FolderPlus,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import type {
  ActivityItem,
  Expense,
  Group,
  GroupCategory,
  GroupMember,
  SimplifiedDebt,
  UserProfile,
} from '../types';
import {
  computeGroupBalances,
  formatINR,
  fromPaise,
  getExpenseUserImpact,
  toPaise,
} from '../utils/finance';
import { ActivityFeedView } from './ActivityFeedView';
import { GroupDetailView } from './GroupDetailView';
import { AddExpenseModal, AddMemberModal, CreateGroupModal } from './Modals';

interface DashboardAppProps {
  user: UserProfile;
  isDemoMode: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  groups: Group[];
  membersByGroup: Record<string, GroupMember[]>;
  expensesByGroup: Record<string, Expense[]>;
  loadingData: boolean;
  onCreateGroup: (payload: {
    name: string;
    category: GroupCategory;
    members: { email: string; displayName: string }[];
  }) => Promise<string>;
  onAddMemberToGroup: (groupId: string, email: string, displayName: string) => Promise<void>;
  onAddExpense: (
    groupId: string,
    payload: {
      title: string;
      amount: number;
      paidByMemberId: string;
      splitType: 'equal' | 'exact';
      splits: Record<string, number>;
    }
  ) => Promise<void>;
  onSettleDebt: (groupId: string, debt: SimplifiedDebt) => Promise<void>;
  onDeleteExpense: (groupId: string, expenseId: string) => Promise<void>;
  onLoadSampleGroups: () => Promise<void>;
}

export const DashboardApp: React.FC<DashboardAppProps> = ({
  user,
  isDemoMode,
  isDark,
  onToggleTheme,
  onLogout,
  groups,
  membersByGroup,
  expensesByGroup,
  loadingData,
  onCreateGroup,
  onAddMemberToGroup,
  onAddExpense,
  onSettleDebt,
  onDeleteExpense,
  onLoadSampleGroups,
}) => {
  const [activeNav, setActiveNav] = useState<'overview' | 'activity' | 'group'>('overview');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [seedingSamples, setSeedingSamples] = useState(false);

  // Per-group summary calculation
  const groupSummaries = useMemo(() => {
    return groups.map((group) => {
      const members = membersByGroup[group.id] || [];
      const expenses = expensesByGroup[group.id] || [];
      const myMember =
        members.find(
          (m) =>
            (m.uid && m.uid === user.uid) ||
            m.email.toLowerCase() === user.email.toLowerCase()
        ) ?? null;

      const { memberBalances, simplifiedDebts } = computeGroupBalances(members, expenses);
      const myBalanceEntry = myMember
        ? memberBalances.find((b) => b.member.id === myMember.id)
        : undefined;
      const myNetBalance = myBalanceEntry?.netBalance ?? 0;

      return {
        group,
        members,
        expenses,
        myMember,
        myNetBalance,
        simplifiedDebts,
      };
    });
  }, [groups, membersByGroup, expensesByGroup, user.uid, user.email]);

  // Dashboard totals in paise to avoid floating point drift
  const { totalYouOwe, totalOwedToYou, netBalance } = useMemo(() => {
    let owePaise = 0;
    let owedPaise = 0;

    for (const summary of groupSummaries) {
      const balPaise = toPaise(summary.myNetBalance);
      if (balPaise < 0) {
        owePaise += Math.abs(balPaise);
      } else if (balPaise > 0) {
        owedPaise += balPaise;
      }
    }

    return {
      totalYouOwe: fromPaise(owePaise),
      totalOwedToYou: fromPaise(owedPaise),
      netBalance: fromPaise(owedPaise - owePaise),
    };
  }, [groupSummaries]);

  // Chronological activity across all groups
  const allActivityItems: ActivityItem[] = useMemo(() => {
    const list: ActivityItem[] = [];
    for (const summary of groupSummaries) {
      const myMemberId = summary.myMember?.id ?? null;
      for (const expense of summary.expenses) {
        list.push({
          expense,
          groupName: summary.group.name,
          groupCategory: summary.group.category,
          myMemberId,
          myNetImpact: getExpenseUserImpact(expense, myMemberId),
        });
      }
    }
    return list.sort((a, b) => b.expense.createdAt.getTime() - a.expense.createdAt.getTime());
  }, [groupSummaries]);

  const activeGroupSummary = useMemo(() => {
    if (!selectedGroupId) return null;
    return groupSummaries.find((s) => s.group.id === selectedGroupId) ?? null;
  }, [groupSummaries, selectedGroupId]);

  const openGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setActiveNav('group');
    setMobileSidebarOpen(false);
  };

  const handleCreateGroupSuccess = async (payload: {
    name: string;
    category: GroupCategory;
    members: { email: string; displayName: string }[];
  }) => {
    const newGroupId = await onCreateGroup(payload);
    setSelectedGroupId(newGroupId);
    setActiveNav('group');
  };

  const handleLoadSamples = async () => {
    setSeedingSamples(true);
    try {
      await onLoadSampleGroups();
    } finally {
      setSeedingSamples(false);
    }
  };

  const breadcrumbLabel =
    activeNav === 'group' && activeGroupSummary
      ? `Groups / ${activeGroupSummary.group.name}`
      : activeNav === 'activity'
        ? 'Activity Feed'
        : 'Overview';

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setActiveNav('overview');
            setSelectedGroupId(null);
            setMobileSidebarOpen(false);
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
        >
          SettleUp
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setActiveNav('overview');
              setSelectedGroupId(null);
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeNav === 'overview'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNav('activity');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeNav === 'activity'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>Activity Feed</span>
          </button>
        </div>

        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Your Groups ({groups.length})
            </span>
            <button
              type="button"
              onClick={() => setCreateGroupOpen(true)}
              aria-label="Create new group"
              className="p-1 rounded-md text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
              No groups yet
            </p>
          ) : (
            <div className="space-y-1">
              {groupSummaries.map(({ group, myNetBalance }) => {
                const isSelected = activeNav === 'group' && selectedGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => openGroup(group.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{group.name}</span>
                    {Math.abs(myNetBalance) >= 0.01 && (
                      <span
                        className={`text-xs font-mono-nums shrink-0 ${
                          myNetBalance > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatINR(myNetBalance, true)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {!isDemoMode && groups.length === 0 && (
          <button
            type="button"
            disabled={seedingSamples}
            onClick={handleLoadSamples}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{seedingSamples ? 'Loading Samples...' : 'Load Sample Groups'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Collapsible Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate">
              {breadcrumbLabel}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCreateGroupOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Group</span>
            </button>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div className="text-right hidden sm:block max-w-[180px]">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user.displayName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isDemoMode ? 'Demo Preview' : user.email}
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isDemoMode ? 'Exit Demo' : 'Logout'}</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {isDemoMode && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Demo Preview Mode:
                </span>{' '}
                Changes stay in this browser session. Sign in with Google or Email to sync across devices in Firestore.
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0 text-left sm:text-right"
              >
                Sign In to Save →
              </button>
            </div>
          )}

          {activeNav === 'group' && activeGroupSummary ? (
            <GroupDetailView
              group={activeGroupSummary.group}
              members={activeGroupSummary.members}
              expenses={activeGroupSummary.expenses}
              currentUid={user.uid}
              currentUserEmail={user.email}
              onBack={() => {
                setActiveNav('overview');
                setSelectedGroupId(null);
              }}
              onOpenAddExpense={() => setAddExpenseOpen(true)}
              onOpenAddMember={() => setAddMemberOpen(true)}
              onSettleDebt={(debt) => onSettleDebt(activeGroupSummary.group.id, debt)}
              onDeleteExpense={(expenseId) => onDeleteExpense(activeGroupSummary.group.id, expenseId)}
            />
          ) : activeNav === 'activity' ? (
            <ActivityFeedView items={allActivityItems} onSelectGroup={openGroup} />
          ) : (
            <div className="space-y-8">
              {/* Top Greeting + Mobile New Group */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    Welcome, {user.displayName}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time shared balances across your groups
                  </p>
                </div>

                <div className="flex items-center gap-2.5 sm:hidden">
                  <button
                    type="button"
                    onClick={() => setCreateGroupOpen(true)}
                    className="inline-flex items-center gap-1.5 py-2 px-4 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Group</span>
                  </button>
                </div>
              </div>

              {/* Three Summary Cards */}
              <section
                aria-label="Balance Summary"
                className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5"
              >
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total You Owe (₹)
                  </div>
                  <div className="mt-2 font-mono-nums text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400">
                    {formatINR(totalYouOwe)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {totalYouOwe > 0.005 ? 'You owe across active groups' : 'Nothing owed right now'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total Owed to You (₹)
                  </div>
                  <div className="mt-2 font-mono-nums text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINR(totalOwedToYou)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {totalOwedToYou > 0.005 ? 'Friends owe you back' : 'No pending incoming dues'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Net Balance (₹)
                  </div>
                  <div
                    className={`mt-2 font-mono-nums text-2xl sm:text-3xl font-bold ${
                      netBalance > 0.005
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : netBalance < -0.005
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formatINR(netBalance, true)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {netBalance > 0.005
                      ? 'Overall owed to you'
                      : netBalance < -0.005
                        ? 'Overall you owe'
                        : 'All settled up'}
                  </p>
                </div>
              </section>

              {/* Groups Grid */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                    Expense Groups
                  </h2>
                  {groups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCreateGroupOpen(true)}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                    >
                      + Create Group
                    </button>
                  )}
                </div>

                {loadingData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className="h-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-5"
                      />
                    ))}
                  </div>
                ) : groups.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-4">
                    <Users className="w-9 h-9 text-slate-400 mx-auto" />
                    <div className="space-y-1">
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                        Create your first expense group
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Start a group for a weekend trip, shared flat rent, or college canteen lunches, or load sample groups to explore immediately.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setCreateGroupOpen(true)}
                        className="inline-flex items-center gap-1.5 py-2 px-4 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create Group</span>
                      </button>

                      {!isDemoMode && (
                        <button
                          type="button"
                          disabled={seedingSamples}
                          onClick={handleLoadSamples}
                          className="inline-flex items-center gap-1.5 py-2 px-4 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>{seedingSamples ? 'Loading...' : 'Load Sample Groups'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupSummaries.map(({ group, members, expenses, myNetBalance, simplifiedDebts }) => {
                      const isPositive = myNetBalance > 0.005;
                      const isNegative = myNetBalance < -0.005;

                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => openGroup(group.id)}
                          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-emerald-500/60 dark:hover:border-emerald-500/50 transition-colors flex flex-col justify-between gap-4 group"
                        >
                          <div className="space-y-1.5 w-full">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                                {group.name}
                              </h3>
                              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 transition-colors" />
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <span>{group.category}</span>
                              <span aria-hidden="true">·</span>
                              <span>{members.length} members</span>
                              <span aria-hidden="true">·</span>
                              <span>{expenses.length} entries</span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between w-full">
                            <div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {isPositive
                                  ? 'Owed to you'
                                  : isNegative
                                    ? 'You owe'
                                    : 'Your balance'}
                              </div>
                              <div
                                className={`font-mono-nums text-lg font-bold ${
                                  isPositive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : isNegative
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {formatINR(Math.abs(myNetBalance))}
                              </div>
                            </div>

                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {simplifiedDebts.length === 0
                                ? 'Settled'
                                : `${simplifiedDebts.length} transfer${simplifiedDebts.length > 1 ? 's' : ''}`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Recent Activity Preview */}
              {allActivityItems.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                      Recent Activity
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveNav('activity')}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                    >
                      View all ({allActivityItems.length})
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
                    {allActivityItems.slice(0, 5).map(({ expense, groupName, myNetImpact, myMemberId }) => (
                      <div
                        key={`${expense.groupId}_${expense.id}`}
                        className="px-5 py-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {expense.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {groupName} · Paid by{' '}
                            {myMemberId === expense.paidByMemberId ? 'You' : expense.paidByName} (
                            {formatINR(expense.amount)})
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {Math.abs(myNetImpact) < 0.01 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <span
                              className={`font-mono-nums text-sm font-semibold ${
                                myNetImpact > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatINR(myNetImpact, true)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateGroupModal
        isOpen={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        currentUserEmail={user.email}
        onCreateGroup={handleCreateGroupSuccess}
      />

      {activeGroupSummary && (
        <>
          <AddMemberModal
            isOpen={addMemberOpen}
            onClose={() => setAddMemberOpen(false)}
            existingEmails={activeGroupSummary.members.map((m) => m.email.toLowerCase())}
            onAddMember={(email, displayName) =>
              onAddMemberToGroup(activeGroupSummary.group.id, email, displayName)
            }
          />

          <AddExpenseModal
            isOpen={addExpenseOpen}
            onClose={() => setAddExpenseOpen(false)}
            groupName={activeGroupSummary.group.name}
            members={activeGroupSummary.members}
            defaultPayerMemberId={
              activeGroupSummary.myMember?.id || activeGroupSummary.members[0]?.id || ''
            }
            onAddExpense={(payload) => onAddExpense(activeGroupSummary.group.id, payload)}
          />
        </>
      )}
    </div>
  );
};
