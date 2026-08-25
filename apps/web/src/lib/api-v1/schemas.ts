import { z } from 'zod';

export const uuid = z.string().uuid();
export const projectRole = z.enum(['owner', 'admin', 'member', 'viewer', 'guest']);
export const evidenceType = z.enum(['meeting', 'browser_collection', 'upload', 'drive_file', 'link']);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(20_000).nullable().optional(),
  team_id: uuid.optional(),
  lead_user_id: uuid.optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).default('medium'),
  start_date: z.iso.date().optional(),
  target_date: z.iso.date().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(25).default([]),
}).refine((value) => !value.start_date || !value.target_date || value.start_date <= value.target_date, {
  message: 'target_date debe ser posterior a start_date', path: ['target_date'],
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived']).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
  health: z.enum(['on_track', 'at_risk', 'off_track', 'none']).optional(),
  lead_user_id: uuid.nullable().optional(),
  start_date: z.iso.date().nullable().optional(),
  target_date: z.iso.date().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(25).optional(),
}).strict();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(50_000).nullable().optional(),
  status_id: uuid.optional(),
  priority_id: uuid.nullable().optional(),
  assignee_id: uuid.nullable().optional(),
  due_date: z.iso.date().nullable().optional(),
  evidence_id: uuid.optional(),
  evidence_item_id: uuid.optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ evidence_id: true, evidence_item_id: true });

export const addMemberSchema = z.object({ user_id: uuid, role: projectRole.default('member') });
export const updateMemberSchema = z.object({ role: projectRole });

export const evidenceItemSchema = z.object({
  type: z.enum(['tab', 'decision', 'agreement', 'risk', 'question', 'excerpt']),
  position: z.number().int().min(0),
  title: z.string().max(500).optional(),
  content: z.string().max(51_200).optional(),
  source_url: z.string().url().max(4_000).optional(),
  source_hash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const createEvidenceSchema = z.object({
  type: evidenceType.exclude(['meeting', 'upload']),
  source_system: z.string().trim().min(1).max(50),
  external_reference: z.string().trim().min(1).max(500).optional(),
  version: z.number().int().positive().default(1),
  title: z.string().trim().min(1).max(500),
  summary: z.string().max(20_000).optional(),
  content_hash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  items: z.array(evidenceItemSchema).max(100).default([]),
});

export const browserCollectionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  external_reference: z.string().trim().min(1).max(500),
  version: z.number().int().positive(),
  summary: z.string().max(20_000).optional(),
  tabs: z.array(evidenceItemSchema.extend({ type: z.literal('tab') })).min(1).max(50),
});

export const meetingImportSchema = z.object({
  approved: z.literal(true),
  evidence: z.object({
    external_reference: z.string().trim().min(1).max(500),
    version: z.number().int().positive().default(1),
    title: z.string().trim().min(1).max(500),
    summary: z.string().max(20_000),
    content_hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }),
  items: z.array(evidenceItemSchema).max(200).default([]),
  tasks: z.array(z.object({
    mode: z.enum(['create', 'link', 'ignore']),
    issue_id: uuid.optional(),
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(50_000).optional(),
    assignee_id: uuid.optional(),
    due_date: z.iso.date().optional(),
    evidence_item_position: z.number().int().min(0).default(0),
  }).refine((task) => task.mode === 'ignore' || (task.mode === 'link' ? Boolean(task.issue_id) : Boolean(task.title)), {
    message: 'La acción requiere issue_id o title según el modo',
  })).max(100).default([]),
});

export const uploadIntentSchema = z.object({
  files: z.array(z.object({
    name: z.string().trim().min(1).max(255),
    mime_type: z.string().trim().min(1).max(150),
    size: z.number().int().positive().max(20 * 1024 * 1024),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  })).min(1).max(10),
});

export const uploadCompleteSchema = z.object({ evidence_id: uuid });
