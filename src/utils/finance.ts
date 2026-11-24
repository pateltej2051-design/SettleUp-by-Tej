import type { Expense, GroupMember, MemberBalance, SimplifiedDebt } from '../types';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number, showSign = false): string {
  const absVal = Math.abs(amount);
  const formatted = `₹${inrFormatter.format(absVal)}`;
  if (amount < -0.005) {
    return `-${formatted}`;
  }
  if (showSign && amount > 0.005) {
    return `+${formatted}`;
  }
  return formatted;
}

export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

export function computeEqualSplits(totalAmount: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) return {};
  const totalPaise = toPaise(totalAmount);
  const count = memberIds.length;
  const baseShare = Math.floor(totalPaise / count);
  let remainder = totalPaise - baseShare * count;

  const result: Record<string, number> = {};
  for (const id of memberIds) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result[id] = fromPaise(baseShare + extra);
  }
  return result;
}

export function computeGroupBalances(
  members: GroupMember[],
  expenses: Expense[]
): {
  memberBalances: MemberBalance[];
  simplifiedDebts: SimplifiedDebt[];
} {
  const balancePaiseMap: Record<string, number> = {};
  const memberById: Record<string, GroupMember> = {};

  for (const m of members) {
    balancePaiseMap[m.id] = 0;
    memberById[m.id] = m;
  }

  for (const exp of expenses) {
    const paidPaise = toPaise(exp.amount);
    if (balancePaiseMap[exp.paidByMemberId] === undefined) {
      balancePaiseMap[exp.paidByMemberId] = 0;
    }
    balancePaiseMap[exp.paidByMemberId] += paidPaise;

    for (const [participantId, shareAmount] of Object.entries(exp.splits)) {
      if (balancePaiseMap[participantId] === undefined) {
        balancePaiseMap[participantId] = 0;
      }
      balancePaiseMap[participantId] -= toPaise(shareAmount);
    }
  }

  const memberBalances: MemberBalance[] = members.map((member) => ({
    member,
    netBalance: fromPaise(balancePaiseMap[member.id] ?? 0),
  }));

  // Greedy debt simplification using integer paise
  const creditors: { member: GroupMember; amountPaise: number }[] = [];
  const debtors: { member: GroupMember; amountPaise: number }[] = [];

  for (const m of members) {
    const bal = balancePaiseMap[m.id] ?? 0;
    if (bal > 0) {
      creditors.push({ member: m, amountPaise: bal });
    } else if (bal < 0) {
      debtors.push({ member: m, amountPaise: Math.abs(bal) });
    }
  }

  creditors.sort((a, b) => b.amountPaise - a.amountPaise);
  debtors.sort((a, b) => b.amountPaise - a.amountPaise);

  const simplifiedDebts: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settlePaise = Math.min(debtor.amountPaise, creditor.amountPaise);

    if (settlePaise > 0) {
      simplifiedDebts.push({
        fromMemberId: debtor.member.id,
        fromName: debtor.member.displayName,
        fromEmail: debtor.member.email,
        toMemberId: creditor.member.id,
        toName: creditor.member.displayName,
        toEmail: creditor.member.email,
        amount: fromPaise(settlePaise),
      });
    }

    debtor.amountPaise -= settlePaise;
    creditor.amountPaise -= settlePaise;

    if (debtor.amountPaise === 0) i += 1;
    if (creditor.amountPaise === 0) j += 1;
  }

  return { memberBalances, simplifiedDebts };
}

export function getExpenseUserImpact(expense: Expense, myMemberId: string | null): number {
  if (!myMemberId) return 0;
  const paidByMe = expense.paidByMemberId === myMemberId ? toPaise(expense.amount) : 0;
  const myShare = expense.splits[myMemberId] ? toPaise(expense.splits[myMemberId]) : 0;
  return fromPaise(paidByMe - myShare);
}

export function generateId(prefix = 'id'): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SU-';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function deriveDisplayNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Member';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Member';
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .slice(0, 40);
}
