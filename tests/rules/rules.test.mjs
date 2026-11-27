// Firestore security rules tests. Run:  cd tests/rules && npm install && npm test
// (needs Java for the Firebase emulator — CI installs it). Uses a "demo-" project: nothing touches the real one.
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-renewal-reminder',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();
const reminder = (id, extra = {}) => ({ id, name: 'Netflix', date: '2026-12-01', amount: 15.49, cycle: 'monthly', remind: 7, channel: 'email', status: 'active', ...extra });

// ---- profile: users/{uid}
test('owner can create, read, update and delete their profile', async () => {
  const p = doc(alice(), 'users/alice');
  await assertSucceeds(setDoc(p, { stats: { onTime: 0, total: 0 }, onboarded: true, notif: false }));
  await assertSucceeds(getDoc(p));
  await assertSucceeds(updateDoc(p, { notif: true }));
  await assertSucceeds(deleteDoc(p));
});

test("nobody else can read or write someone's profile", async () => {
  await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'users/alice'), { onboarded: true }));
  await assertFails(getDoc(doc(bob(), 'users/alice')));
  await assertFails(setDoc(doc(bob(), 'users/alice'), { onboarded: false }));
  await assertFails(getDoc(doc(anon(), 'users/alice')));
});

test('profile rejects unknown fields and more than 5 push devices', async () => {
  await assertFails(setDoc(doc(alice(), 'users/alice'), { isAdmin: true }));
  const six = Array.from({ length: 6 }, (_, i) => ({ endpoint: `https://push/${i}`, keys: {} }));
  await assertFails(setDoc(doc(alice(), 'users/alice'), { push: six }));
  await assertSucceeds(setDoc(doc(alice(), 'users/alice'), { push: six.slice(0, 5) }));
});

test('a reminder may have its own currency: USD, EUR or UAH', async () => {
  const rec = (c) => ({ id: 'r1', name: 'Megogo', date: '2026-12-01', currency: c });
  for (const c of ['USD', 'EUR', 'UAH']) await assertSucceeds(setDoc(doc(alice(), 'users/alice/reminders/r1'), rec(c)));
  await assertFails(setDoc(doc(alice(), 'users/alice/reminders/r1'), rec('GBP')));
});

test('profile currency must be USD, EUR or UAH', async () => {
  for (const c of ['USD', 'EUR', 'UAH']) await assertSucceeds(setDoc(doc(alice(), 'users/alice'), { currency: c }));
  await assertFails(setDoc(doc(alice(), 'users/alice'), { currency: 'GBP' }));
  await assertFails(setDoc(doc(alice(), 'users/alice'), { currency: 5 }));
});

test('old all-in-one reminders list is still accepted (for moving old accounts), max 500', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice'), { reminders: [reminder('a')] }));
  await assertFails(setDoc(doc(alice(), 'users/alice'), { reminders: Array.from({ length: 501 }, (_, i) => reminder(`r${i}`)) }));
});

// ---- one record per reminder: users/{uid}/reminders/{id}
test('owner can create, read, update and delete their reminder records', async () => {
  const r = doc(alice(), 'users/alice/reminders/netflix');
  await assertSucceeds(setDoc(r, reminder('netflix', { note: 'Shared account', history: [] })));
  await assertSucceeds(getDoc(r));
  await assertSucceeds(updateDoc(r, { status: 'kept' }));
  await assertSucceeds(getDocs(collection(alice(), 'users/alice/reminders')));
  await assertSucceeds(deleteDoc(r));
});

test("nobody else can read or write someone's reminders", async () => {
  await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'users/alice/reminders/netflix'), reminder('netflix')));
  await assertFails(getDoc(doc(bob(), 'users/alice/reminders/netflix')));
  await assertFails(getDocs(collection(bob(), 'users/alice/reminders')));
  await assertFails(setDoc(doc(bob(), 'users/alice/reminders/x'), reminder('x')));
  await assertFails(deleteDoc(doc(bob(), 'users/alice/reminders/netflix')));
  await assertFails(getDoc(doc(anon(), 'users/alice/reminders/netflix')));
});

test('reminder records are validated', async () => {
  const at = (id) => doc(alice(), `users/alice/reminders/${id}`);
  await assertFails(setDoc(at('a'), reminder('other')));                                   // id must match the record
  await assertFails(setDoc(at('b'), reminder('b', { evil: true })));                       // unknown field
  await assertFails(setDoc(at('c'), reminder('c', { name: '' })));                         // empty name
  await assertFails(setDoc(at('d'), reminder('d', { name: 'x'.repeat(81) })));             // name too long
  await assertFails(setDoc(at('e'), reminder('e', { date: '1/12/2026' })));                // date format
  await assertFails(setDoc(at('f'), reminder('f', { note: 'x'.repeat(1001) })));           // note too long
  await assertFails(setDoc(at('g'), reminder('g', { link: 'x'.repeat(501) })));            // link too long
  await assertFails(setDoc(at('h'), reminder('h', { history: Array(201).fill({ type: 'edited' }) })));
  await assertSucceeds(setDoc(at('ok'), reminder('ok', { note: 'x'.repeat(1000), emailedOn: '2026-11-25' })));
});

// ---- server-only and everything else
test('"sent" records and any other collection are closed to browsers', async () => {
  await assertFails(getDoc(doc(alice(), 'sent/alice__netflix__2026-11-25__email')));
  await assertFails(setDoc(doc(alice(), 'sent/alice__netflix__2026-11-25__email'), { kind: 'email' }));
  await assertFails(getDocs(collection(alice(), 'sent')));
  await assertFails(setDoc(doc(alice(), 'admin/settings'), { x: 1 }));
});
