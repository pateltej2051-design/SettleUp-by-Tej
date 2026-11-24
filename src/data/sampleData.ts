import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Expense, Group, GroupMember, UserProfile } from '../types';
import { computeEqualSplits, generateId, generateInviteCode } from '../utils/finance';

export const DEMO_USER: UserProfile = {
  uid: 'demo_user_ananya',
  displayName: 'Ananya Sharma',
  email: 'ananya.sharma@college.edu',
  createdAt: new Date(Date.now() - 86400000 * 14),
};

export function createDemoWorkspaceData(): {
  groups: Group[];
  membersByGroup: Record<string, GroupMember[]>;
  expensesByGroup: Record<string, Expense[]>;
} {
  const now = Date.now();
  const uid = DEMO_USER.uid;
  const email = DEMO_USER.email;
  const name = DEMO_USER.displayName;

  const g1Id = 'demo_group_goa_trip';
  const g2Id = 'demo_group_flat_402';
  const g3Id = 'demo_group_canteen';

  const groups: Group[] = [
    {
      id: g1Id,
      name: 'Goa Trip',
      category: 'Trip',
      inviteCode: 'SU-GOA42',
      createdBy: uid,
      memberUids: [uid, 'demo_uid_rohan', 'demo_uid_kabir', 'demo_uid_meera'],
      memberEmails: [email, 'rohan.verma@college.edu', 'kabir.nair@college.edu', 'meera.iyer@college.edu'],
      createdAt: new Date(now - 86400000 * 6),
      updatedAt: new Date(now - 3600000 * 3),
    },
    {
      id: g2Id,
      name: 'Flat 402 Rent & Wi-Fi',
      category: 'Home',
      inviteCode: 'SU-FLT02',
      createdBy: uid,
      memberUids: [uid, 'demo_uid_priya', 'demo_uid_dev'],
      memberEmails: [email, 'priya.menon@workmail.in', 'dev.patel@workmail.in'],
      createdAt: new Date(now - 86400000 * 12),
      updatedAt: new Date(now - 86400000 * 1),
    },
    {
      id: g3Id,
      name: 'Canteen Lunch',
      category: 'Food',
      inviteCode: 'SU-CNT09',
      createdBy: 'demo_uid_rohan',
      memberUids: [uid, 'demo_uid_rohan', 'demo_uid_meera'],
      memberEmails: [email, 'rohan.verma@college.edu', 'meera.iyer@college.edu'],
      createdAt: new Date(now - 86400000 * 3),
      updatedAt: new Date(now - 7200000),
    },
  ];

  const membersByGroup: Record<string, GroupMember[]> = {
    [g1Id]: [
      { id: 'm_goa_ananya', groupId: g1Id, uid, email, displayName: name, role: 'owner', addedByUid: uid, joinedAt: new Date(now - 86400000 * 6) },
      { id: 'm_goa_rohan', groupId: g1Id, uid: 'demo_uid_rohan', email: 'rohan.verma@college.edu', displayName: 'Rohan Verma', role: 'member', addedByUid: uid, joinedAt: new Date(now - 86400000 * 6) },
      { id: 'm_goa_kabir', groupId: g1Id, uid: 'demo_uid_kabir', email: 'kabir.nair@college.edu', displayName: 'Kabir Nair', role: 'member', addedByUid: uid, joinedAt: new Date(now - 86400000 * 5) },
      { id: 'm_goa_meera', groupId: g1Id, uid: 'demo_uid_meera', email: 'meera.iyer@college.edu', displayName: 'Meera Iyer', role: 'member', addedByUid: uid, joinedAt: new Date(now - 86400000 * 5) },
    ],
    [g2Id]: [
      { id: 'm_flat_ananya', groupId: g2Id, uid, email, displayName: name, role: 'owner', addedByUid: uid, joinedAt: new Date(now - 86400000 * 12) },
      { id: 'm_flat_priya', groupId: g2Id, uid: 'demo_uid_priya', email: 'priya.menon@workmail.in', displayName: 'Priya Menon', role: 'member', addedByUid: uid, joinedAt: new Date(now - 86400000 * 12) },
      { id: 'm_flat_dev', groupId: g2Id, uid: 'demo_uid_dev', email: 'dev.patel@workmail.in', displayName: 'Dev Patel', role: 'member', addedByUid: uid, joinedAt: new Date(now - 86400000 * 11) },
    ],
    [g3Id]: [
      { id: 'm_can_rohan', groupId: g3Id, uid: 'demo_uid_rohan', email: 'rohan.verma@college.edu', displayName: 'Rohan Verma', role: 'owner', addedByUid: 'demo_uid_rohan', joinedAt: new Date(now - 86400000 * 3) },
      { id: 'm_can_ananya', groupId: g3Id, uid, email, displayName: name, role: 'member', addedByUid: 'demo_uid_rohan', joinedAt: new Date(now - 86400000 * 3) },
      { id: 'm_can_meera', groupId: g3Id, uid: 'demo_uid_meera', email: 'meera.iyer@college.edu', displayName: 'Meera Iyer', role: 'member', addedByUid: 'demo_uid_rohan', joinedAt: new Date(now - 86400000 * 3) },
    ],
  };

  const expensesByGroup: Record<string, Expense[]> = {
    [g1Id]: [
      {
        id: 'exp_goa_villa',
        groupId: g1Id,
        type: 'expense',
        title: 'Anjuna Beach Villa (2 Nights)',
        amount: 9600,
        paidByMemberId: 'm_goa_ananya',
        paidByName: name,
        splitType: 'equal',
        splits: computeEqualSplits(9600, ['m_goa_ananya', 'm_goa_rohan', 'm_goa_kabir', 'm_goa_meera']),
        participantIds: ['m_goa_ananya', 'm_goa_rohan', 'm_goa_kabir', 'm_goa_meera'],
        settledToMemberId: '',
        settledToName: '',
        createdByUid: uid,
        createdAt: new Date(now - 86400000 * 4),
      },
      {
        id: 'exp_goa_scooters',
        groupId: g1Id,
        type: 'expense',
        title: 'Scooter Rentals & Fuel',
        amount: 2400,
        paidByMemberId: 'm_goa_kabir',
        paidByName: 'Kabir Nair',
        splitType: 'equal',
        splits: computeEqualSplits(2400, ['m_goa_ananya', 'm_goa_rohan', 'm_goa_kabir', 'm_goa_meera']),
        participantIds: ['m_goa_ananya', 'm_goa_rohan', 'm_goa_kabir', 'm_goa_meera'],
        settledToMemberId: '',
        settledToName: '',
        createdByUid: 'demo_uid_kabir',
        createdAt: new Date(now - 86400000 * 2),
      },
      {
        id: 'exp_goa_settle_meera',
        groupId: g1Id,
        type: 'settlement',
        title: 'Settlement from Meera Iyer',
        amount: 1000,
        paidByMemberId: 'm_goa_meera',
        paidByName: 'Meera Iyer',
        splitType: 'settlement',
        splits: { m_goa_ananya: 1000 },
        participantIds: ['m_goa_ananya'],
        settledToMemberId: 'm_goa_ananya',
        settledToName: name,
        createdByUid: 'demo_uid_meera',
        createdAt: new Date(now - 3600000 * 10),
      },
    ],
    [g2Id]: [
      {
        id: 'exp_flat_wifi',
        groupId: g2Id,
        type: 'expense',
        title: 'ACT Fibernet Wi-Fi Bill',
        amount: 1497,
        paidByMemberId: 'm_flat_priya',
        paidByName: 'Priya Menon',
        splitType: 'equal',
        splits: computeEqualSplits(1497, ['m_flat_ananya', 'm_flat_priya', 'm_flat_dev']),
        participantIds: ['m_flat_ananya', 'm_flat_priya', 'm_flat_dev'],
        settledToMemberId: '',
        settledToName: '',
        createdByUid: 'demo_uid_priya',
        createdAt: new Date(now - 86400000 * 5),
      },
      {
        id: 'exp_flat_elec',
        groupId: g2Id,
        type: 'expense',
        title: 'BESCOM Electricity Bill',
        amount: 2150,
        paidByMemberId: 'm_flat_priya',
        paidByName: 'Priya Menon',
        splitType: 'exact',
        splits: { m_flat_ananya: 750, m_flat_priya: 700, m_flat_dev: 700 },
        participantIds: ['m_flat_ananya', 'm_flat_priya', 'm_flat_dev'],
        settledToMemberId: '',
        settledToName: '',
        createdByUid: 'demo_uid_priya',
        createdAt: new Date(now - 86400000 * 1),
      },
    ],
    [g3Id]: [
      {
        id: 'exp_can_dosa',
        groupId: g3Id,
        type: 'expense',
        title: 'Masala Dosa & Filter Coffee',
        amount: 540,
        paidByMemberId: 'm_can_ananya',
        paidByName: name,
        splitType: 'equal',
        splits: computeEqualSplits(540, ['m_can_rohan', 'm_can_ananya', 'm_can_meera']),
        participantIds: ['m_can_rohan', 'm_can_ananya', 'm_can_meera'],
        settledToMemberId: '',
        settledToName: '',
        createdByUid: uid,
        createdAt: new Date(now - 7200000),
      },
    ],
  };

  return { groups, membersByGroup, expensesByGroup };
}

export async function seedSampleGroupsToFirestore(user: UserProfile): Promise<void> {
  const batch = writeBatch(db);
  const myEmail = user.email.trim().toLowerCase();

  const sampleSpecs = [
    {
      name: 'Goa Trip',
      category: 'Trip' as const,
      friends: [
        { email: 'rohan.verma@college.edu', displayName: 'Rohan Verma' },
        { email: 'kabir.nair@college.edu', displayName: 'Kabir Nair' },
      ],
      expenses: [
        { title: 'Beach Shack Dinner', amount: 3600, paidByOwner: true, splitType: 'equal' as const },
        { title: 'Cab from Madgaon Station', amount: 1500, paidByOwner: false, splitType: 'equal' as const },
      ],
    },
    {
      name: 'Flat 402 Rent & Wi-Fi',
      category: 'Home' as const,
      friends: [
        { email: 'priya.menon@workmail.in', displayName: 'Priya Menon' },
        { email: 'dev.patel@workmail.in', displayName: 'Dev Patel' },
      ],
      expenses: [
        { title: 'Wi-Fi & Electricity Bill', amount: 3300, paidByOwner: true, splitType: 'equal' as const },
      ],
    },
    {
      name: 'Canteen Lunch',
      category: 'Food' as const,
      friends: [{ email: 'meera.iyer@college.edu', displayName: 'Meera Iyer' }],
      expenses: [
        { title: 'South Indian Thali & Cold Coffee', amount: 460, paidByOwner: false, splitType: 'equal' as const },
      ],
    },
  ];

  for (const spec of sampleSpecs) {
    const groupId = generateId('grp');
    const ownerMemberId = generateId('mem');
    const friendMembers = spec.friends.map((f) => ({
      id: generateId('mem'),
      email: f.email.toLowerCase(),
      displayName: f.displayName,
    }));

    const groupRef = doc(db, 'groups', groupId);
    batch.set(groupRef, {
      id: groupId,
      name: spec.name,
      category: spec.category,
      inviteCode: generateInviteCode(),
      createdBy: user.uid,
      memberUids: [user.uid],
      memberEmails: [myEmail, ...friendMembers.map((f) => f.email)],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const ownerMemberRef = doc(db, 'groups', groupId, 'members', ownerMemberId);
    batch.set(ownerMemberRef, {
      id: ownerMemberId,
      groupId,
      uid: user.uid,
      email: myEmail,
      displayName: user.displayName,
      role: 'owner',
      addedByUid: user.uid,
      joinedAt: serverTimestamp(),
    });

    for (const fm of friendMembers) {
      const friendRef = doc(db, 'groups', groupId, 'members', fm.id);
      batch.set(friendRef, {
        id: fm.id,
        groupId,
        uid: '',
        email: fm.email,
        displayName: fm.displayName,
        role: 'member',
        addedByUid: user.uid,
        joinedAt: serverTimestamp(),
      });
    }

    const allMemberIds = [ownerMemberId, ...friendMembers.map((f) => f.id)];
    for (const exp of spec.expenses) {
      const expenseId = generateId('exp');
      const payerId = exp.paidByOwner ? ownerMemberId : friendMembers[0].id;
      const payerName = exp.paidByOwner ? user.displayName : friendMembers[0].displayName;
      const splits = computeEqualSplits(exp.amount, allMemberIds);

      const expRef = doc(db, 'groups', groupId, 'expenses', expenseId);
      batch.set(expRef, {
        id: expenseId,
        groupId,
        type: 'expense',
        title: exp.title,
        amount: exp.amount,
        paidByMemberId: payerId,
        paidByName: payerName,
        splitType: exp.splitType,
        splits,
        participantIds: allMemberIds,
        settledToMemberId: '',
        settledToName: '',
        createdByUid: user.uid,
        createdAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'groups');
  }
}
