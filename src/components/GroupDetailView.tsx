import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Plus, Trash2, UserPlus } from 'lucide-react';
import type { Expense, Group, GroupMember, SimplifiedDebt } from '../types';
import { computeGroupBalances, formatINR, getExpenseUserImpact } from '../utils/finance';

interface GroupDetailViewProps {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  currentUid: string;
  currentUserEmail: string;
  onBack: () => void;
  onOpenAddExpense: () => void;
  onOpenAddMember: () => void;
  onSettleDebt: (debt: SimplifiedDebt) => Promise<void>;
  onDeleteExpense: (expenseId: string) => Promise<void>;
}

export const GroupDetailView: React.FC<GroupDetailViewProps> = ({
  group,
  members,
  expenses,
  currentUid,
  currentUserEmail,
  onBack,
  onOpenAddExpense,
  onOpenAddMember,
  onSettleDebt,
  onDeleteExpense,
}) => {
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const myMember = useMemo(
    () =>
      members.find(
        (m) =>
          (m.uid && m.uid === currentUid) ||
          m.email.toLowerCase() === currentUserEmail.toLowerCase()
      ) ?? null,
    [members, currentUid, currentUserEmail]
  );

  const { memberBalances, simplifiedDebts } = useMemo(
    () => computeGroupBalances(members, expenses),
    [members, expenses]
  );

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [expenses]
  );

  const totalGroupSpend = useMemo(
    () =>
      expenses
        .filter((e) => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const handleSettle = async (debt: SimplifiedDebt) => {
    const key = `${debt.fromMemberId}_${debt.toMemberId}`;
    setActionError(null);
    setSettlingKey(key);
    try {
      await onSettleDebt(debt);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not record settlement.');
    } finally {
      setSettlingKey(null);
    }
  };

  const handleDelete = async (expenseId: string) => {
    setActionError(null);
    setDeletingId(expenseId);
    try {
      await onDeleteExpense(expenseId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete entry.');
    } finally {
      setDeletingId(null);
    }
  };

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Group Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Overview</span>
          </button>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {group.name}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{group.category}</span>
            <span aria-hidden="true">·</span>
            <span>{members.length} members</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">Total spent {formatINR(totalGroupSpend)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">Code {group.inviteCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAddMember}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="inline-flex items-center gap-1.5 py-2 px-4 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
          {actionError}
        </div>
      )}

      {/* Simplified Debts & Group Member Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Simplified Settlement Plan */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Simplified Balances
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Minimum transfers needed to settle everyone in {group.name}
              </p>
            </div>
          </div>

          {simplifiedDebts.length === 0 ? (
            <div className="py-8 text-center border-t border-slate-100 dark:border-slate-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                All balances are settled
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No pending transfers in this group.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
              {simplifiedDebts.map((debt) => {
                const key = `${debt.fromMemberId}_${debt.toMemberId}`;
                const isSettling = settlingKey === key;
                const involvesMeAsDebtor = myMember?.id === debt.fromMemberId;
                const involvesMeAsCreditor = myMember?.id === debt.toMemberId;

                return (
                  <li
                    key={key}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        <span className="font-semibold">
                          {involvesMeAsDebtor ? 'You' : debt.fromName}
                        </span>{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          {involvesMeAsDebtor ? 'owe' : 'owes'}
                        </span>{' '}
                        <span className="font-semibold">
                          {involvesMeAsCreditor ? 'you' : debt.toName}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {debt.fromEmail} → {debt.toEmail}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span
                        className={`font-mono-nums text-sm font-semibold ${
                          involvesMeAsDebtor
                            ? 'text-rose-600 dark:text-rose-400'
                            : involvesMeAsCreditor
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatINR(debt.amount)}
                      </span>

                      <button
                        type="button"
                        disabled={isSettling}
                        onClick={() => handleSettle(debt)}
                        className="py-1.5 px-3 text-xs font-medium rounded-lg border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {isSettling ? 'Settling...' : 'Settle Up'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right: Member Net Positions */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Members ({members.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Net balance per person in this group
              </p>
            </div>
          </div>

          <ul className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {memberBalances.map(({ member, netBalance }) => {
              const isMe = myMember?.id === member.id;
              const isPositive = netBalance > 0.005;
              const isNegative = netBalance < -0.005;

              return (
                <li key={member.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {member.displayName} {isMe ? '(You)' : ''}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {member.email}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono-nums text-sm font-semibold ${
                        isPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isNegative
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatINR(netBalance, true)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isPositive ? 'owed' : isNegative ? 'owes' : 'settled'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Expense Ledger */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Expense History ({sortedExpenses.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenAddExpense}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
          >
            + Log expense
          </button>
        </div>

        {sortedExpenses.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No expenses recorded yet in {group.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add your first shared bill to automatically split costs among members.
            </p>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-1.5 py-2 px-4 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Log First Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">Expense</th>
                  <th className="py-3 px-4">Paid By</th>
                  <th className="py-3 px-4">Split</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Your Share</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {sortedExpenses.map((exp) => {
                  const impact = getExpenseUserImpact(exp, myMember?.id ?? null);
                  const canDelete =
                    exp.createdByUid === currentUid || group.createdBy === currentUid;
                  const isSettlement = exp.type === 'settlement';

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-6">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {exp.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {dateFormatter.format(exp.createdAt)}
                          {isSettlement ? ' · Non-cash settlement' : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {myMember?.id === exp.paidByMemberId ? 'You' : exp.paidByName}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {isSettlement
                          ? `To ${myMember?.id === exp.settledToMemberId ? 'You' : exp.settledToName}`
                          : exp.splitType === 'equal'
                            ? `Equal · ${exp.participantIds.length} people`
                            : `Exact · ${exp.participantIds.length} people`}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatINR(exp.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {Math.abs(impact) < 0.01 ? (
                          <span className="text-xs text-slate-400">Not involved</span>
                        ) : (
                          <div>
                            <span
                              className={`font-mono-nums font-semibold ${
                                impact > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatINR(impact, true)}
                            </span>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {isSettlement
                                ? impact > 0
                                  ? 'you paid'
                                  : 'received'
                                : impact > 0
                                  ? 'you lent'
                                  : 'you owe'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {canDelete ? (
                          <button
                            type="button"
                            disabled={deletingId === exp.id}
                            onClick={() => handleDelete(exp.id)}
                            aria-label={`Delete ${exp.title}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
