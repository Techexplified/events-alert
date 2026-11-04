import { z } from 'zod';

export const ALLOWED_ALERT_TYPES = [
  'stuck-in-list',
  'no-activity',
  'overdue-in-list',
  'due-soon-unassigned',
  'custom-condition'
];

export const MAX_CONDITIONS_BYTES = 20 * 1024; // 20 KB

/**
 * Validates and normalizes conditions for 'due-soon-unassigned' alerts:
 * - mode must be 'before' or 'on'
 * - days required and an integer 1..30 when mode is 'before', and ignored/stripped when 'on'
 * - strips filters.members
 */
export function validateDueSoonUnassignedConditions(conditions, ctx = null, path = ['conditions']) {
  if (!conditions || typeof conditions !== 'object') {
    const error = 'conditions must be an object';
    ctx?.addIssue?.({
      code: z.ZodIssueCode.custom,
      message: error,
      path
    });
    return { ok: false, error };
  }

  const rawMode =
    conditions.mode ||
    (conditions.dueDateCondition === 'before-due-date' || conditions.timing === 'before-due-date'
      ? 'before'
      : conditions.dueDateCondition === 'on-due-date' || conditions.timing === 'on-due-date'
      ? 'on'
      : undefined);

  if (rawMode !== 'before' && rawMode !== 'on') {
    const error = "mode must be 'before' or 'on'";
    ctx?.addIssue?.({
      code: z.ZodIssueCode.custom,
      message: error,
      path: [...path, 'mode']
    });
    return { ok: false, error };
  }

  conditions.mode = rawMode;

  if (rawMode === 'before') {
    const rawDays = conditions.days !== undefined ? conditions.days : conditions.dueSoonDays;
    const numDays = Number(rawDays);
    if (rawDays === undefined || rawDays === null || !Number.isInteger(numDays) || numDays < 1 || numDays > 30) {
      const error = "days is required and must be an integer between 1 and 30 when mode is 'before'";
      ctx?.addIssue?.({
        code: z.ZodIssueCode.custom,
        message: error,
        path: [...path, 'days']
      });
      return { ok: false, error };
    }
    conditions.days = numDays;
  } else if (rawMode === 'on') {
    delete conditions.days;
    delete conditions.dueSoonDays;
  }

  if (conditions.filters && typeof conditions.filters === 'object') {
    if ('members' in conditions.filters) {
      delete conditions.filters.members;
    }
  }

  return { ok: true, conditions };
}

// Plain object validation and size check for conditions
// TODO: per-alert-type conditions schemas, when the scheduled checker is built.
const conditionsObjectSchema = z.record(z.string(), z.any())
  .refine(
    (val) => val !== null && typeof val === 'object' && !Array.isArray(val),
    { message: 'conditions must be a plain object' }
  )
  .refine(
    (val) => {
      try {
        const json = JSON.stringify(val);
        return new TextEncoder().encode(json).length <= MAX_CONDITIONS_BYTES;
      } catch {
        return false;
      }
    },
    { message: 'conditions serialized size exceeds 20 KB limit' }
  );

export const recipientsSchema = z.object({
  mode: z.enum(['me', 'specific', 'all'], {
    errorMap: () => ({ message: "recipients.mode must be 'me', 'specific', or 'all'" })
  }),
  frequency: z.enum(['immediate', 'daily', 'weekly'], {
    errorMap: () => ({ message: "recipients.frequency must be 'immediate', 'daily', or 'weekly'" })
  }),
  members: z.array(z.any()).max(500, 'recipients.members cannot exceed 500 entries').optional().default([]),
  creator: z.object({
    id: z.string(),
    name: z.string().optional()
  }).passthrough().optional(),
  extraEmails: z.array(z.string().trim().toLowerCase().email())
    .optional()
    .default([])
    .transform((arr) => [...new Set(arr)])
    .refine((arr) => arr.length <= 10, { message: 'recipients.extraEmails cannot exceed 10 entries' })
});

/**
 * Validates request body for creating a new alert.
 * Never accepts createdBy*, id, status, or timestamps.
 */
export const createAlertSchema = z.object({
  alertType: z.enum(ALLOWED_ALERT_TYPES, {
    errorMap: () => ({ message: `alertType must be one of: ${ALLOWED_ALERT_TYPES.join(', ')}` })
  }),
  boardId: z.string().trim().min(1, 'boardId is required'),
  boardName: z.string().trim().min(1, 'boardName is required'),
  conditions: conditionsObjectSchema,
  recipients: recipientsSchema
}).superRefine((data, ctx) => {
  // conditions.alertType must match the alert's alertType
  if (!data.conditions || data.conditions.alertType !== data.alertType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "conditions.alertType must match alertType",
      path: ['conditions', 'alertType']
    });
  }

  if (data.alertType === 'due-soon-unassigned' && data.conditions) {
    validateDueSoonUnassignedConditions(data.conditions, ctx, ['conditions']);
  }
});

/**
 * Validates request body for updating an alert (PATCH).
 * Accepts status (active or paused) and/or { conditions, recipients }.
 */
export const updateAlertSchema = z.object({
  status: z.enum(['active', 'paused'], {
    errorMap: () => ({ message: "status must be 'active' or 'paused'" })
  }).optional(),
  conditions: conditionsObjectSchema.optional(),
  recipients: recipientsSchema.optional()
}).superRefine((data, ctx) => {
  if (data.status === undefined && data.conditions === undefined && data.recipients === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one of status, conditions, or recipients must be provided'
    });
  }

  if (data.conditions && data.conditions.alertType === 'due-soon-unassigned') {
    validateDueSoonUnassignedConditions(data.conditions, ctx, ['conditions']);
  }
});

/**
 * Helper to ensure forbidden fields are not present in the raw request body.
 */
export function checkForbiddenFields(rawBody, { isCreate = true } = {}) {
  if (!rawBody || typeof rawBody !== 'object') return null;

  const forbiddenKeys = isCreate
    ? ['id', 'status', 'createdAt', 'updatedAt', 'createdByMemberId', 'createdByName']
    : ['id', 'boardId', 'boardName', 'alertType', 'createdAt', 'updatedAt', 'createdByMemberId', 'createdByName'];

  for (const key of Object.keys(rawBody)) {
    if (key.startsWith('createdBy') || forbiddenKeys.includes(key)) {
      return `Field '${key}' cannot be modified in the request body`;
    }
  }

  return null;
}
