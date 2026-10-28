import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[m[1]] = val;
  }
});

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });
  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }

  const { data: tasks } = await sb.from('project_tasks').select('*');
  const { data: projects } = await sb.from('client_projects').select('*');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const overdue = (tasks || []).filter(t => t.deadline && t.deadline < todayStr && t.status !== 'done' && t.status !== 'cancelled');
  const blocked = (tasks || []).filter(t => t.status === 'blocked');
  const unassigned = (tasks || []).filter(t => !t.assignee_id && t.status !== 'done' && t.status !== 'cancelled');

  console.log('Overdue count:', overdue.length);
  console.log('Blocked count:', blocked.length);
  console.log('Unassigned count:', unassigned.length);

  // Overlap analysis
  const overdueIds = new Set(overdue.map(t => t.id));
  const blockedIds = new Set(blocked.map(t => t.id));
  const unassignedIds = new Set(unassigned.map(t => t.id));

  const overdueAndUnassigned = overdue.filter(t => unassignedIds.has(t.id));
  const blockedAndUnassigned = blocked.filter(t => unassignedIds.has(t.id));
  const overdueAndBlocked = overdue.filter(t => blockedIds.has(t.id));

  console.log('Overdue AND Unassigned:', overdueAndUnassigned.length);
  console.log('Blocked AND Unassigned:', blockedAndUnassigned.length);
  console.log('Overdue AND Blocked:', overdueAndBlocked.length);

  const uniqueTaskIds = new Set([...overdueIds, ...blockedIds, ...unassignedIds]);
  console.log('Unique exception tasks:', uniqueTaskIds.size);

  // Check client action items
  const tasksByProject: Record<string, any[]> = {};
  for (const t of (tasks || [])) {
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
    tasksByProject[t.project_id].push(t);
  }

  const clientActionItems: any[] = [];
  for (const p of (projects || [])) {
    if (p.status !== 'active' && p.status !== 'on_hold') continue;
    const pTasks = tasksByProject[p.id] || [];
    const blockedOnClient = pTasks.filter(t => t.status === 'blocked' && t.waiting_on === 'client');
    if (blockedOnClient.length > 0) {
      for (const bt of blockedOnClient) {
        clientActionItems.push({ type: 'task', id: bt.id, projectId: p.id, title: bt.title });
      }
    } else if (p.followup_status === 'waiting_for_client' || p.followup_status === 'followup_due') {
      clientActionItems.push({ type: 'project', id: p.id, title: p.title });
    }
  }

  console.log('Client Action total items:', clientActionItems.length);
  clientActionItems.forEach((ca, i) => {
    console.log(`  CA ${i}: type=${ca.type}, id=${ca.id}, inUniqueTasks=${uniqueTaskIds.has(ca.id)}`);
  });

  const allDistinctEntities = new Set([
    ...Array.from(uniqueTaskIds).map(id => `task:${id}`),
    ...clientActionItems.map(ca => `${ca.type}:${ca.id}`)
  ]);
  console.log('Grand Total Distinct Exceptions (tasks + distinct project client actions):', allDistinctEntities.size);
}

check();
