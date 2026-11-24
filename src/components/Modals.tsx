import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { GroupCategory, GroupMember } from '../types';
import {
  computeEqualSplits,
  deriveDisplayNameFromEmail,
  formatINR,
  fromPaise,
  toPaise,
} from '../utils/finance';

const CATEGORIES: GroupCategory[] = ['Trip', 'Home', 'Food', 'College', 'General'];

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
  onCreateGroup: (payload: {
    name: string;
    category: GroupCategory;
    members: { email: string; displayName: string }[];
  }) => Promise<void>;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
  onCreateGroup,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GroupCategory>('Trip');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [invitedMembers, setInvitedMembers] = useState<{ email: string; displayName: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCategory('Trip');
      setMemberEmail('');
      setMemberName('');
      setInvitedMembers([]);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddInvite = () => {
    setError(null);
    const normalizedEmail = memberEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address for the member.');
      return;
    }
    if (normalizedEmail === currentUserEmail.toLowerCase()) {
      setError('You are automatically included as the group creator.');
      return;
    }
    if (invitedMembers.some((m) => m.email === normalizedEmail)) {
      setError('This email is already added to the list.');
      return;
    }
    if (invitedMembers.length >= 19) {
      setError('Groups support up to 20 members.');
      return;
    }
    const cleanName = memberName.trim() || deriveDisplayNameFromEmail(normalizedEmail);
    setInvitedMembers((prev) => [...prev, { email: normalizedEmail, displayName: cleanName.slice(0, 80) }]);
    setMemberEmail('');
    setMemberName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 80) {
      setError('Please enter a group name (1–80 characters).');
      return;
    }

    // If user typed an email in the field but forgot to click "+ Add", validate and include it smoothly
    let finalMembers = [...invitedMembers];
    if (memberEmail.trim()) {
      const normalized = memberEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        setError('Please enter a valid email address or clear the member email field.');
        return;
      }
      if (normalized !== currentUserEmail.toLowerCase() && !finalMembers.some((m) => m.email === normalized)) {
        finalMembers.push({
          email: normalized,
          displayName: memberName.trim() || deriveDisplayNameFromEmail(normalized),
        });
      }
    }

    setSaving(true);
    try {
      await onCreateGroup({
        name: trimmedName,
        category,
        members: finalMembers,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create group.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 id="create-group-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Create New Group
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="group-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Goa Trip, Flat 402 Rent & Wi-Fi"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                    category === cat
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Add Members by Email
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Enter your friends&apos; registered email addresses. You are already included.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="friend@example.com"
                className="sm:col-span-6 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Name (optional)"
                maxLength={80}
                className="sm:col-span-4 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                type="button"
                onClick={handleAddInvite}
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 py-2 px-3 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {invitedMembers.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {invitedMembers.map((m) => (
                  <li key={m.email} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{m.displayName}</span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInvitedMembers((prev) => prev.filter((item) => item.email !== m.email))}
                      aria-label={`Remove ${m.email}`}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 transition-colors"
            >
              {saving ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEmails: string[];
  onAddMember: (email: string, displayName: string) => Promise<void>;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  existingEmails,
  onAddMember,
}) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setDisplayName('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (existingEmails.includes(normalized)) {
      setError('This person is already a member of this group.');
      return;
    }
    if (existingEmails.length >= 20) {
      setError('This group has reached the 20-member limit.');
      return;
    }

    const name = displayName.trim() || deriveDisplayNameFromEmail(normalized);
    setSaving(true);
    try {
      await onAddMember(normalized, name.slice(0, 80));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add member.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 id="add-member-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Add Group Member
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="member-email-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Registered Email Address
            </label>
            <input
              id="member-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div>
            <label htmlFor="member-name-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Display Name (Optional)
            </label>
            <input
              id="member-name-input"
              type="text"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Auto-filled from email if blank"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 transition-colors"
            >
              {saving ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  members: GroupMember[];
  defaultPayerMemberId: string;
  onAddExpense: (payload: {
    title: string;
    amount: number;
    paidByMemberId: string;
    splitType: 'equal' | 'exact';
    splits: Record<string, number>;
  }) => Promise<void>;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  groupName,
  members,
  defaultPayerMemberId,
  onAddExpense,
}) => {
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState(defaultPayerMemberId);
  const [splitType, setSplitType] = useState<'equal' | 'exact'>('equal');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAmountInput('');
      setPaidByMemberId(defaultPayerMemberId || members[0]?.id || '');
      setSplitType('equal');
      setSelectedIds(members.map((m) => m.id));
      const initialExact: Record<string, string> = {};
      for (const m of members) {
        initialExact[m.id] = '';
      }
      setExactInputs(initialExact);
      setError(null);
    }
  }, [isOpen, defaultPayerMemberId, members]);

  if (!isOpen) return null;

  const parsedAmount = Number.parseFloat(amountInput);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

  const equalPreview =
    splitType === 'equal' && validAmount > 0 && selectedIds.length > 0
      ? computeEqualSplits(validAmount, selectedIds)
      : {};

  const exactAllocatedPaise = members.reduce((sum, m) => {
    const val = Number.parseFloat(exactInputs[m.id] || '0');
    return sum + (Number.isFinite(val) && val > 0 ? toPaise(val) : 0);
  }, 0);
  const totalPaise = toPaise(validAmount);
  const remainingPaise = totalPaise - exactAllocatedPaise;

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter an expense title (e.g., Electricity Bill, Dinner).');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10000000) {
      setError('Enter a valid amount greater than ₹0.');
      return;
    }
    if (!paidByMemberId) {
      setError('Please choose who paid for this expense.');
      return;
    }

    let finalSplits: Record<string, number> = {};

    if (splitType === 'equal') {
      if (selectedIds.length === 0) {
        setError('Select at least one member to split this expense.');
        return;
      }
      finalSplits = computeEqualSplits(parsedAmount, selectedIds);
    } else {
      for (const m of members) {
        const val = Number.parseFloat(exactInputs[m.id] || '0');
        if (Number.isFinite(val) && val < 0) {
          setError('Exact split amounts cannot be negative.');
          return;
        }
        if (Number.isFinite(val) && val > 0) {
          finalSplits[m.id] = fromPaise(toPaise(val));
        }
      }
      if (Object.keys(finalSplits).length === 0) {
        setError('Enter at least one member share amount.');
        return;
      }
      if (Math.abs(remainingPaise) > 1) {
        setError(
          `Custom split amounts must add up to ${formatINR(parsedAmount)}. Remaining: ${formatINR(fromPaise(remainingPaise))}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      await onAddExpense({
        title: trimmedTitle.slice(0, 120),
        amount: fromPaise(toPaise(parsedAmount)),
        paidByMemberId,
        splitType,
        splits: finalSplits,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="add-expense-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Add Expense
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{groupName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="expense-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Expense Title
            </label>
            <input
              id="expense-title"
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Electricity Bill, Dinner, Cab Ride"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="expense-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Amount (₹ INR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono-nums text-slate-500">
                  ₹
                </span>
                <input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm font-mono-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div>
              <label htmlFor="expense-paid-by" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Paid By
              </label>
              <select
                id="expense-paid-by"
                value={paidByMemberId}
                onChange={(e) => setPaidByMemberId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Split Type
            </span>
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setSplitType('equal')}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  splitType === 'equal'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Split Equally
              </button>
              <button
                type="button"
                onClick={() => setSplitType('exact')}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  splitType === 'exact'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Custom Exact Amounts
              </button>
            </div>
          </div>

          {splitType === 'equal' ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
              {members.map((m) => {
                const checked = selectedIds.includes(m.id);
                const share = equalPreview[m.id] ?? 0;
                return (
                  <label
                    key={m.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(m.id)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                        {m.displayName}
                      </span>
                    </div>
                    <span className="text-sm font-mono-nums text-slate-600 dark:text-slate-300 shrink-0">
                      {checked && validAmount > 0 ? formatINR(share) : '₹0.00'}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
                {members.map((m) => (
                  <div key={m.id} className="px-3.5 py-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
                      {m.displayName}
                    </span>
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono-nums text-slate-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={exactInputs[m.id] ?? ''}
                        onChange={(e) =>
                          setExactInputs((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full pl-6 pr-2.5 py-1.5 text-sm font-mono-nums text-right rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-500 dark:text-slate-400">
                  Allocated {formatINR(fromPaise(exactAllocatedPaise))} of {formatINR(validAmount)}
                </span>
                <span
                  className={`font-mono-nums font-medium ${
                    Math.abs(remainingPaise) <= 1
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {Math.abs(remainingPaise) <= 1
                    ? 'Balanced'
                    : `${remainingPaise > 0 ? 'Left' : 'Over'}: ${formatINR(fromPaise(Math.abs(remainingPaise)))}`}
                </span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
