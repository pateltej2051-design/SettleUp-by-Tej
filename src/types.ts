export type GroupCategory = 'Trip' | 'Home' | 'Food' | 'College' | 'General';

export type SplitType = 'equal' | 'exact' | 'settlement';

export type ExpenseEntryType = 'expense' | 'settlement';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: Date;
}

export interface Group {
  id: string;
  name: string;
  category: GroupCategory;
  inviteCode: string;
  createdBy: string;
  memberUids: string[];
  memberEmails: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'member';
  addedByUid: string;
  joinedAt: Date;
}

export interface Expense {
  id: string;
  groupId: string;
  type: ExpenseEntryType;
  title: string;
  amount: number;
  paidByMemberId: string;
  paidByName: string;
  splitType: SplitType;
  splits: Record<string, number>;
  participantIds: string[];
  settledToMemberId: string;
  settledToName: string;
  createdByUid: string;
  createdAt: Date;
}

export interface SimplifiedDebt {
  fromMemberId: string;
  fromName: string;
  fromEmail: string;
  toMemberId: string;
  toName: string;
  toEmail: string;
  amount: number;
}

export interface MemberBalance {
  member: GroupMember;
  netBalance: number; // positive = owed to them, negative = they owe
}

export interface ActivityItem {
  expense: Expense;
  groupName: string;
  groupCategory: GroupCategory;
  myMemberId: string | null;
  myNetImpact: number; // positive = lent/received, negative = borrowed/paid
}
