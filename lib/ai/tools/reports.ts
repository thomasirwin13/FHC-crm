import 'server-only';

import { tool } from 'ai';
import { z } from 'zod';
import {
  REPORTABLE_ENTITIES,
  ALLOWED_OPERATORS,
  ALLOWED_AGGREGATES,
  ALLOWED_SORT_DIRECTIONS,
  filterConditionSchema,
  DISTRICT_TYPES,
  validateReportFields,
  type ReportDefinition,
} from '@/lib/ai/reports/schema';
import { runReport, previewAudienceFromFilters } from '@/lib/ai/reports/engine';
import { describeSuppressionRules } from '@/lib/ai/reports/suppression';
import { createClient } from '@/lib/supabase/server';
import type { ToolContext } from './registry';

export function createReportTools(ctx: ToolContext) {
  return {
    listReportFields: tool({
      description:
        'Returns the reportable entities, fields, operators, sort options, aggregate functions, and district types available for building reports. Use this before constructing a report or audience filter.',
      inputSchema: z.object({}),
      execute: async () => {
        ctx.onToolCall?.();
        const entities = Object.entries(REPORTABLE_ENTITIES).map(([key, entity]) => ({
          entity: key,
          label: entity.label,
          fields: Object.entries(entity.fields).map(([fieldKey, field]) => ({
            field: fieldKey,
            label: field.label,
            type: field.type,
            ...('values' in field ? { allowedValues: field.values } : {}),
          })),
        }));

        return {
          entities,
          operators: [...ALLOWED_OPERATORS],
          aggregates: [...ALLOWED_AGGREGATES],
          sortDirections: [...ALLOWED_SORT_DIRECTIONS],
          districtTypes: [...DISTRICT_TYPES],
          maxResultLimit: 500,
        };
      },
    }),

    previewAudience: tool({
      description:
        'Preview an audience based on filter criteria. Returns total matching contacts, contactable counts by channel (email/SMS), excluded count, suppression rules applied, and a small sample. Does NOT return the full contact list. Use after constructing filters with listReportFields.',
      inputSchema: z.object({
        filters: z.array(filterConditionSchema).describe('Array of filter conditions'),
        channel: z.enum(['email', 'sms', 'whatsapp']).default('email').describe('Communication channel to check contactability for'),
      }),
      execute: async ({ filters, channel }) => {
        ctx.onToolCall?.();

        const allowedFields = Object.keys(REPORTABLE_ENTITIES.contacts.fields);
        for (const f of filters) {
          if (!allowedFields.includes(f.field)) {
            return { error: `Field '${f.field}' is not allowed. Use listReportFields to see available fields.` };
          }
        }

        const preview = await previewAudienceFromFilters(ctx.teamId, filters, 5);

        return {
          totalMatching: preview.totalMatching,
          contactableEmail: preview.contactability.contactableEmail,
          contactableSms: preview.contactability.contactableSms,
          excluded: preview.contactability.excluded,
          suppressionRules: describeSuppressionRules(channel),
          sample: preview.sample,
          previewId: preview.previewId,
          filterSummary: filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(', '),
        };
      },
    }),

    saveAudienceSegment: tool({
      description:
        'Save an audience segment after the user explicitly requests it. Returns a confirmation preview — does not save until confirmed.',
      inputSchema: z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        filters: z.array(filterConditionSchema),
        estimatedCount: z.number().int().min(0),
        contactableEmail: z.number().int().min(0).default(0),
        contactableSms: z.number().int().min(0).default(0),
        excludedCount: z.number().int().min(0).default(0),
      }),
      execute: async ({ name, description, filters, estimatedCount, contactableEmail, contactableSms, excludedCount }) => {
        ctx.onToolCall?.();
        return {
          needsConfirmation: true,
          confirmationType: 'save_audience_segment',
          preview: {
            name,
            description: description ?? null,
            filterCount: filters.length,
            estimatedCount,
            contactableEmail,
            contactableSms,
            excludedCount,
            filterSummary: filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(', '),
          },
          data: { name, description, filters, estimatedCount, contactableEmail, contactableSms, excludedCount },
        };
      },
    }),

    runSavedReport: tool({
      description:
        'Run an existing saved report by ID. Verifies the report belongs to the current team before executing.',
      inputSchema: z.object({
        reportId: z.number().int().describe('ID of the saved report to run'),
        limit: z.number().int().min(1).max(500).default(100).describe('Maximum rows to return'),
      }),
      execute: async ({ reportId, limit }) => {
        ctx.onToolCall?.();

        const supabase = await createClient();
        const { data: report, error } = await supabase
          .from('saved_reports')
          .select('*')
          .eq('id', reportId)
          .eq('team_id', ctx.teamId)
          .single();

        if (error || !report) {
          return { error: 'Report not found or access denied.' };
        }

        const definition: ReportDefinition = {
          entityType: report.entity_type as any,
          filters: report.filter_definition as any[],
          selectedFields: report.selected_fields as string[],
          sort: report.sort_definition as any,
          groupBy: report.group_by ?? undefined,
          limit,
        };

        const validation = validateReportFields(definition);
        if (!validation.valid) {
          return { error: `Report has invalid fields: ${validation.errors.join(', ')}` };
        }

        const result = await runReport(ctx.teamId, definition);

        await supabase.from('report_runs').insert({
          team_id: ctx.teamId,
          report_id: reportId,
          run_by: ctx.userId,
          result_count: result.totalCount,
          parameters: { limit },
        });

        return {
          reportName: report.name,
          totalCount: result.totalCount,
          rowsReturned: result.rows.length,
          rows: result.rows.slice(0, 20),
          contactability: result.contactability ?? null,
          hasMore: result.rows.length < result.totalCount,
        };
      },
    }),
  };
}
