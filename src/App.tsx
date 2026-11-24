import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  mapAuthErrorMessage,
  OperationType,
} from './firebase';
import type {
  Expense,
  Group,
  GroupCategory,
  GroupMember,
  SimplifiedDebt,
  UserProfile,
} from './types';
import {
  createDemoWorkspaceData,
  DEMO_USER,
  seedSampleGroupsToFirestore,
} from './data/sampleData';
import { deriveDisplayNameFromEmail, generateId, generateInviteCode } from './utils/finance';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingAuthView } from './components/LandingAuthView';
import { DashboardApp } from './components/DashboardApp';

function toDateValue(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date();
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('settleup-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem('settleup-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoGroups, setDemoGroups] = useState<Group[]>([]);
  const [demoMembers, setDemoMembers] = useState<Record<string, GroupMember[]>>({});
  const [demoExpenses, setDemoExpenses] = useState<Record<string, Expense[]>>({});

  const [liveGroups, setLiveGroups] = useState<Group[]>([]);
  const [liveMembers, setLiveMembers] = useState<Record<string, GroupMember[]>>({});
  const [liveExpenses, setLiveExpenses] = useState<Record<string, Expense[]>>({});
  const [loadingGroups, setLoadingGroups] = useState(false);

  const claimedGroupIdsRef = useRef<Set<string>>(new Set());
  const pendingDisplayNameRef = useRef<string | null>(null);

  // Sync or create user profile in users/{uid}
  const ensureUserProfile = useCallback(async (fbUser: User, explicitDisplayName?: string): Promise<UserProfile> => {
    const email = (fbUser.email || '').trim().toLowerCase();
    const chosenName = (explicitDisplayName || pendingDisplayNameRef.current || fbUser.displayName || '').trim();
    const fallbackName = (chosenName || deriveDisplayNameFromEmail(email)).slice(0, 80);
    const userRef = doc(db, 'users', fbUser.uid);

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const existingName = String(data.displayName || '').trim();
        if (chosenName && chosenName !== existingName) {
          await updateDoc(userRef, { displayName: chosenName.slice(0, 80) });
          return {
            uid: String(data.uid || fbUser.uid),
            displayName: chosenName.slice(0, 80),
            email: String(data.email || email),
            createdAt: toDateValue(data.createdAt),
          };
        }
        return {
          uid: String(data.uid || fbUser.uid),
          displayName: existingName || fallbackName,
          email: String(data.email || email),
          createdAt: toDateValue(data.createdAt),
        };
      }

      await setDoc(userRef, {
        uid: fbUser.uid,
        displayName: fallbackName,
        email,
        createdAt: serverTimestamp(),
      });

      return {
        uid: fbUser.uid,
        displayName: fallbackName,
        email,
        createdAt: new Date(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${fbUser.uid}`);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUserProfile(null);
        setLiveGroups([]);
        setLiveMembers({});
        setLiveExpenses({});
        claimedGroupIdsRef.current.clear();
        setAuthReady(true);
        return;
      }

      setIsDemoMode(false);
      setLoadingGroups(true);
      try {
        const profile = await ensureUserProfile(fbUser);
        setUserProfile(profile);
      } catch (err) {
        console.error('Failed to initialize profile:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [ensureUserProfile]);

  // Real-time Firestore listener for groups where user is listed by UID or verified email
  useEffect(() => {
    if (!firebaseUser || !userProfile || isDemoMode) return;

    setLoadingGroups(true);
    const uidGroupsMap = new Map<string, Group>();
    const emailGroupsMap = new Map<string, Group>();

    const mergeAndPublish = () => {
      const merged = new Map<string, Group>([...emailGroupsMap, ...uidGroupsMap]);
      const sorted = Array.from(merged.values()).sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      setLiveGroups(sorted);
      setLoadingGroups(false);
    };

    const parseGroupDoc = (docSnap: { id: string; data: () => Record<string, unknown> }): Group => {
      const d = docSnap.data();
      return {
        id: String(d.id || docSnap.id),
        name: String(d.name || 'Untitled Group'),
        category: (d.category as GroupCategory) || 'General',
        inviteCode: String(d.inviteCode || ''),
        createdBy: String(d.createdBy || ''),
        memberUids: Array.isArray(d.memberUids) ? d.memberUids.map(String) : [],
        memberEmails: Array.isArray(d.memberEmails) ? d.memberEmails.map((e) => String(e).toLowerCase()) : [],
        createdAt: toDateValue(d.createdAt),
        updatedAt: toDateValue(d.updatedAt),
      };
    };

    const qByUid = query(
      collection(db, 'groups'),
      where('memberUids', 'array-contains', firebaseUser.uid)
    );

    const unsubUid = onSnapshot(
      qByUid,
      (snapshot) => {
        uidGroupsMap.clear();
        snapshot.forEach((docSnap) => {
          uidGroupsMap.set(docSnap.id, parseGroupDoc(docSnap));
        });
        mergeAndPublish();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'groups');
      }
    );

    let unsubEmail: (() => void) | null = null;
    if (firebaseUser.emailVerified && firebaseUser.email) {
      const emailLower = firebaseUser.email.trim().toLowerCase();
      const qByEmail = query(
        collection(db, 'groups'),
        where('memberEmails', 'array-contains', emailLower)
      );

      unsubEmail = onSnapshot(
        qByEmail,
        (snapshot) => {
          emailGroupsMap.clear();
          snapshot.forEach((docSnap) => {
            const grp = parseGroupDoc(docSnap);
            emailGroupsMap.set(docSnap.id, grp);

            // Auto-claim pending invite UID if user joined via verified email
            if (
              !grp.memberUids.includes(firebaseUser.uid) &&
              !claimedGroupIdsRef.current.has(grp.id)
            ) {
              claimedGroupIdsRef.current.add(grp.id);
              void updateDoc(doc(db, 'groups', grp.id), {
                memberUids: arrayUnion(firebaseUser.uid),
                updatedAt: serverTimestamp(),
              }).catch((err) => {
                console.warn('Could not auto-claim group UID:', err);
              });
            }
          });
          mergeAndPublish();
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'groups');
        }
      );
    }

    return () => {
      unsubUid();
      if (unsubEmail) unsubEmail();
    };
  }, [firebaseUser, userProfile, isDemoMode]);

  // Real-time Firestore listeners for members & expenses subcollections of active groups
  useEffect(() => {
    if (!firebaseUser || !userProfile || isDemoMode || liveGroups.length === 0) {
      return;
    }

    const unsubscribers: (() => void)[] = [];

    for (const grp of liveGroups) {
      const membersPath = `groups/${grp.id}/members`;
      const unsubMem = onSnapshot(
        query(collection(db, 'groups', grp.id, 'members'), orderBy('joinedAt', 'asc')),
        (snapshot) => {
          const list: GroupMember[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id || docSnap.id),
              groupId: String(d.groupId || grp.id),
              uid: String(d.uid || ''),
              email: String(d.email || '').toLowerCase(),
              displayName: String(d.displayName || 'Member'),
              role: d.role === 'owner' ? 'owner' : 'member',
              addedByUid: String(d.addedByUid || ''),
              joinedAt: toDateValue(d.joinedAt),
            };
          });
          setLiveMembers((prev) => ({ ...prev, [grp.id]: list }));

          // Link pending member document with user's UID if verified
          if (firebaseUser.emailVerified && firebaseUser.email) {
            const myEmail = firebaseUser.email.trim().toLowerCase();
            const pendingMember = list.find((m) => m.uid === '' && m.email === myEmail);
            if (pendingMember) {
              void updateDoc(doc(db, 'groups', grp.id, 'members', pendingMember.id), {
                uid: firebaseUser.uid,
                displayName: userProfile.displayName,
              }).catch(() => {
                // Ignore if already claimed
              });
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, membersPath);
        }
      );
      unsubscribers.push(unsubMem);

      const expensesPath = `groups/${grp.id}/expenses`;
      const unsubExp = onSnapshot(
        query(collection(db, 'groups', grp.id, 'expenses'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          const list: Expense[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id || docSnap.id),
              groupId: String(d.groupId || grp.id),
              type: d.type === 'settlement' ? 'settlement' : 'expense',
              title: String(d.title || 'Expense'),
              amount: Number(d.amount || 0),
              paidByMemberId: String(d.paidByMemberId || ''),
              paidByName: String(d.paidByName || 'Member'),
              splitType:
                d.splitType === 'exact'
                  ? 'exact'
                  : d.splitType === 'settlement'
                    ? 'settlement'
                    : 'equal',
              splits: (d.splits && typeof d.splits === 'object' ? d.splits : {}) as Record<
                string,
                number
              >,
              participantIds: Array.isArray(d.participantIds) ? d.participantIds.map(String) : [],
              settledToMemberId: String(d.settledToMemberId || ''),
              settledToName: String(d.settledToName || ''),
              createdByUid: String(d.createdByUid || ''),
              createdAt: toDateValue(d.createdAt),
            };
          });
          setLiveExpenses((prev) => ({ ...prev, [grp.id]: list }));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, expensesPath);
        }
      );
      unsubscribers.push(unsubExp);
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [firebaseUser, userProfile, isDemoMode, liveGroups]);

  // Auth handlers
  const handleEmailSignUp = async (displayName: string, email: string, password: string) => {
    setAuthError(null);
    pendingDisplayNameRef.current = displayName.trim();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      const profile = await ensureUserProfile(cred.user, displayName.trim());
      setUserProfile(profile);
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    } finally {
      pendingDisplayNameRef.current = null;
    }
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    }
  };

  const handleEnterDemo = () => {
    const sample = createDemoWorkspaceData();
    setDemoGroups(sample.groups);
    setDemoMembers(sample.membersByGroup);
    setDemoExpenses(sample.expensesByGroup);
    setIsDemoMode(true);
    setAuthError(null);
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      return;
    }
    await signOut(auth);
  };

  // Workspace mutation handlers (supports both live Firestore and Demo Preview Mode)
  const handleCreateGroup = async (payload: {
    name: string;
    category: GroupCategory;
    members: { email: string; displayName: string }[];
  }): Promise<string> => {
    const activeUser = isDemoMode ? DEMO_USER : userProfile;
    if (!activeUser) throw new Error('You must be signed in to create a group.');

    const groupId = generateId('grp');
    const ownerMemberId = generateId('mem');
    const myEmail = activeUser.email.trim().toLowerCase();
    const inviteCode = generateInviteCode();

    if (isDemoMode) {
      const now = new Date();
      const newGroup: Group = {
        id: groupId,
        name: payload.name,
        category: payload.category,
        inviteCode,
        createdBy: activeUser.uid,
        memberUids: [activeUser.uid],
        memberEmails: [myEmail, ...payload.members.map((m) => m.email.toLowerCase())],
        createdAt: now,
        updatedAt: now,
      };
      const newMembers: GroupMember[] = [
        {
          id: ownerMemberId,
          groupId,
          uid: activeUser.uid,
          email: myEmail,
          displayName: activeUser.displayName,
          role: 'owner',
          addedByUid: activeUser.uid,
          joinedAt: now,
        },
        ...payload.members.map((m) => ({
          id: generateId('mem'),
          groupId,
          uid: '',
          email: m.email.toLowerCase(),
          displayName: m.displayName,
          role: 'member' as const,
          addedByUid: activeUser.uid,
          joinedAt: now,
        })),
      ];
      setDemoGroups((prev) => [newGroup, ...prev]);
      setDemoMembers((prev) => ({ ...prev, [groupId]: newMembers }));
      setDemoExpenses((prev) => ({ ...prev, [groupId]: [] }));
      return groupId;
    }

    const batch = writeBatch(db);
    batch.set(doc(db, 'groups', groupId), {
      id: groupId,
      name: payload.name,
      category: payload.category,
      inviteCode,
      createdBy: activeUser.uid,
      memberUids: [activeUser.uid],
      memberEmails: [myEmail, ...payload.members.map((m) => m.email.toLowerCase())],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'groups', groupId, 'members', ownerMemberId), {
      id: ownerMemberId,
      groupId,
      uid: activeUser.uid,
      email: myEmail,
      displayName: activeUser.displayName,
      role: 'owner',
      addedByUid: activeUser.uid,
      joinedAt: serverTimestamp(),
    });

    for (const invited of payload.members) {
      const memId = generateId('mem');
      batch.set(doc(db, 'groups', groupId, 'members', memId), {
        id: memId,
        groupId,
        uid: '',
        email: invited.email.toLowerCase(),
        displayName: invited.displayName,
        role: 'member',
        addedByUid: activeUser.uid,
        joinedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      return groupId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}`);
    }
  };

  const handleAddMemberToGroup = async (
    groupId: string,
    email: string,
    displayName: string
  ): Promise<void> => {
    const activeUser = isDemoMode ? DEMO_USER : userProfile;
    if (!activeUser) throw new Error('Not signed in.');

    const normalizedEmail = email.trim().toLowerCase();
    const memberId = generateId('mem');

    if (isDemoMode) {
      const newMember: GroupMember = {
        id: memberId,
        groupId,
        uid: '',
        email: normalizedEmail,
        displayName,
        role: 'member',
        addedByUid: activeUser.uid,
        joinedAt: new Date(),
      };
      setDemoMembers((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] || []), newMember],
      }));
      setDemoGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                memberEmails: Array.from(new Set([...g.memberEmails, normalizedEmail])),
                updatedAt: new Date(),
              }
            : g
        )
      );
      return;
    }

    const batch = writeBatch(db);
    batch.update(doc(db, 'groups', groupId), {
      memberEmails: arrayUnion(normalizedEmail),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'groups', groupId, 'members', memberId), {
      id: memberId,
      groupId,
      uid: '',
      email: normalizedEmail,
      displayName,
      role: 'member',
      addedByUid: activeUser.uid,
      joinedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${groupId}/members/${memberId}`);
    }
  };

  const handleAddExpense = async (
    groupId: string,
    payload: {
      title: string;
      amount: number;
      paidByMemberId: string;
      splitType: 'equal' | 'exact';
      splits: Record<string, number>;
    }
  ): Promise<void> => {
    const activeUser = isDemoMode ? DEMO_USER : userProfile;
    if (!activeUser) throw new Error('Not signed in.');

    const membersList = isDemoMode ? demoMembers[groupId] || [] : liveMembers[groupId] || [];
    const payer = membersList.find((m) => m.id === payload.paidByMemberId);
    if (!payer) throw new Error('Selected payer was not found in this group.');

    const expenseId = generateId('exp');
    const participantIds = Object.keys(payload.splits);

    if (isDemoMode) {
      const newExp: Expense = {
        id: expenseId,
        groupId,
        type: 'expense',
        title: payload.title,
        amount: payload.amount,
        paidByMemberId: payer.id,
        paidByName: payer.displayName,
        splitType: payload.splitType,
        splits: payload.splits,
        participantIds,
        settledToMemberId: '',
        settledToName: '',
        createdByUid: activeUser.uid,
        createdAt: new Date(),
      };
      setDemoExpenses((prev) => ({
        ...prev,
        [groupId]: [newExp, ...(prev[groupId] || [])],
      }));
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'groups', groupId, 'expenses', expenseId), {
        id: expenseId,
        groupId,
        type: 'expense',
        title: payload.title,
        amount: payload.amount,
        paidByMemberId: payer.id,
        paidByName: payer.displayName,
        splitType: payload.splitType,
        splits: payload.splits,
        participantIds,
        settledToMemberId: '',
        settledToName: '',
        createdByUid: activeUser.uid,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'groups', groupId), {
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}/expenses/${expenseId}`);
    }
  };

  const handleSettleDebt = async (groupId: string, debt: SimplifiedDebt): Promise<void> => {
    const activeUser = isDemoMode ? DEMO_USER : userProfile;
    if (!activeUser) throw new Error('Not signed in.');

    const expenseId = generateId('stl');
    const title = `${debt.fromName} settled with ${debt.toName}`.slice(0, 120);

    if (isDemoMode) {
      const settlement: Expense = {
        id: expenseId,
        groupId,
        type: 'settlement',
        title,
        amount: debt.amount,
        paidByMemberId: debt.fromMemberId,
        paidByName: debt.fromName,
        splitType: 'settlement',
        splits: { [debt.toMemberId]: debt.amount },
        participantIds: [debt.toMemberId],
        settledToMemberId: debt.toMemberId,
        settledToName: debt.toName,
        createdByUid: activeUser.uid,
        createdAt: new Date(),
      };
      setDemoExpenses((prev) => ({
        ...prev,
        [groupId]: [settlement, ...(prev[groupId] || [])],
      }));
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'groups', groupId, 'expenses', expenseId), {
        id: expenseId,
        groupId,
        type: 'settlement',
        title,
        amount: debt.amount,
        paidByMemberId: debt.fromMemberId,
        paidByName: debt.fromName,
        splitType: 'settlement',
        splits: { [debt.toMemberId]: debt.amount },
        participantIds: [debt.toMemberId],
        settledToMemberId: debt.toMemberId,
        settledToName: debt.toName,
        createdByUid: activeUser.uid,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'groups', groupId), {
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}/expenses/${expenseId}`);
    }
  };

  const handleDeleteExpense = async (groupId: string, expenseId: string): Promise<void> => {
    if (isDemoMode) {
      setDemoExpenses((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter((e) => e.id !== expenseId),
      }));
      return;
    }

    try {
      await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/expenses/${expenseId}`);
    }
  };

  const handleLoadSampleGroups = async (): Promise<void> => {
    if (!userProfile || isDemoMode) return;
    await seedSampleGroupsToFirestore(userProfile);
  };

  return (
    <ErrorBoundary>
      {!authReady ? (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <div className="font-display text-xl font-bold text-slate-900 dark:text-white">
              SettleUp
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading your ledger...
            </p>
          </div>
        </div>
      ) : isDemoMode ? (
        <DashboardApp
          user={DEMO_USER}
          isDemoMode={true}
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          onLogout={handleLogout}
          groups={demoGroups}
          membersByGroup={demoMembers}
          expensesByGroup={demoExpenses}
          loadingData={false}
          onCreateGroup={handleCreateGroup}
          onAddMemberToGroup={handleAddMemberToGroup}
          onAddExpense={handleAddExpense}
          onSettleDebt={handleSettleDebt}
          onDeleteExpense={handleDeleteExpense}
          onLoadSampleGroups={handleLoadSampleGroups}
        />
      ) : firebaseUser && userProfile ? (
        <DashboardApp
          user={userProfile}
          isDemoMode={false}
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          onLogout={handleLogout}
          groups={liveGroups}
          membersByGroup={liveMembers}
          expensesByGroup={liveExpenses}
          loadingData={loadingGroups}
          onCreateGroup={handleCreateGroup}
          onAddMemberToGroup={handleAddMemberToGroup}
          onAddExpense={handleAddExpense}
          onSettleDebt={handleSettleDebt}
          onDeleteExpense={handleDeleteExpense}
          onLoadSampleGroups={handleLoadSampleGroups}
        />
      ) : (
        <LandingAuthView
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          onEmailSignUp={handleEmailSignUp}
          onEmailSignIn={handleEmailSignIn}
          onGoogleSignIn={handleGoogleSignIn}
          onEnterDemo={handleEnterDemo}
          authError={authError}
          clearAuthError={() => setAuthError(null)}
        />
      )}
    </ErrorBoundary>
  );
}
