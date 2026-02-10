import { describe, it, expect } from 'vitest';
import {
  buildContexts,
  buildOfferorContext,
  buildIssuerContext,
  buildManagementMemberContext,
  buildPersonInvolvedContext,
  buildAllContexts,
  getContextId,
  type ContextConfig,
} from '@/lib/xbrl/generator/context-builder';

const VALID_LEI = '529900T8BM49AURSDO55';

function makeConfig(overrides?: Partial<ContextConfig>): ContextConfig {
  return {
    documentDate: '2025-06-15',
    lei: VALID_LEI,
    ...overrides,
  };
}

describe('Context Builder', () => {
  describe('buildContexts', () => {
    it('should create an instant context with the document date', () => {
      const contexts = buildContexts(makeConfig());

      expect(contexts).toHaveLength(1);
      expect(contexts[0]!.id).toBe('ctx_instant');
      expect(contexts[0]!.period).toEqual({ instant: '2025-06-15' });
    });

    it('should include entity with correct scheme and LEI', () => {
      const contexts = buildContexts(makeConfig());

      expect(contexts[0]!.entity.identifier).toBe(VALID_LEI);
      expect(contexts[0]!.entity.scheme).toBe('http://standards.iso.org/iso/17442');
    });

    it('should add a duration context when durationPeriod is provided', () => {
      const contexts = buildContexts(
        makeConfig({
          durationPeriod: { startDate: '2025-01-01', endDate: '2025-12-31' },
        })
      );

      expect(contexts).toHaveLength(2);
      expect(contexts[1]!.id).toBe('ctx_duration');
      expect(contexts[1]!.period).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });
    });

    it('should not add a duration context when durationPeriod is omitted', () => {
      const contexts = buildContexts(makeConfig());

      expect(contexts).toHaveLength(1);
      expect(contexts.every((c) => c.id !== 'ctx_duration')).toBe(true);
    });
  });

  describe('buildOfferorContext', () => {
    it('should create a context with OfferorDimension typed member', () => {
      const ctx = buildOfferorContext(makeConfig());

      expect(ctx.id).toBe('ctx_offeror');
      expect(ctx.scenario?.typedMember?.dimension).toBe('mica:OfferorDimension');
      expect(ctx.scenario?.typedMember?.value).toBe(VALID_LEI);
    });

    it('should use instant period', () => {
      const ctx = buildOfferorContext(makeConfig());

      expect(ctx.period).toEqual({ instant: '2025-06-15' });
    });
  });

  describe('buildIssuerContext', () => {
    it('should create a context with IssuerDimension and separate LEI', () => {
      const issuerLei = '254900OPPU84GM83MG36';
      const ctx = buildIssuerContext(makeConfig(), issuerLei);

      expect(ctx.id).toBe('ctx_issuer');
      expect(ctx.scenario?.typedMember?.dimension).toBe('mica:IssuerDimension');
      expect(ctx.scenario?.typedMember?.value).toBe(issuerLei);
    });

    it('should use entity LEI from config (not issuer LEI) for entity', () => {
      const ctx = buildIssuerContext(makeConfig(), '254900OPPU84GM83MG36');

      expect(ctx.entity.identifier).toBe(VALID_LEI);
    });
  });

  describe('buildManagementMemberContext', () => {
    it('should use offeror dimension for offeror type', () => {
      const ctx = buildManagementMemberContext(makeConfig(), 0, 'offeror');

      expect(ctx.id).toBe('ctx_mgmt_offeror_0');
      expect(ctx.scenario?.typedMember?.dimension).toBe(
        'mica:OfferorManagementBodyMemberDimension'
      );
      expect(ctx.scenario?.typedMember?.value).toBe('member_0');
    });

    it('should use issuer dimension for issuer type', () => {
      const ctx = buildManagementMemberContext(makeConfig(), 1, 'issuer');

      expect(ctx.id).toBe('ctx_mgmt_issuer_1');
      expect(ctx.scenario?.typedMember?.dimension).toBe(
        'mica:IssuerManagementBodyMemberDimension'
      );
    });

    it('should use operator dimension for operator type', () => {
      const ctx = buildManagementMemberContext(makeConfig(), 2, 'operator');

      expect(ctx.id).toBe('ctx_mgmt_operator_2');
      expect(ctx.scenario?.typedMember?.dimension).toBe(
        'mica:OperatorManagementBodyMemberDimension'
      );
    });

    it('should include memberIndex in context id', () => {
      const ctx = buildManagementMemberContext(makeConfig(), 5, 'offeror');

      expect(ctx.id).toBe('ctx_mgmt_offeror_5');
      expect(ctx.scenario?.typedMember?.value).toBe('member_5');
    });
  });

  describe('buildPersonInvolvedContext', () => {
    it('should use duration period when available', () => {
      const config = makeConfig({
        durationPeriod: { startDate: '2025-01-01', endDate: '2025-12-31' },
      });
      const ctx = buildPersonInvolvedContext(config, 0);

      expect(ctx.id).toBe('ctx_person_involved_0');
      expect(ctx.period).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });
    });

    it('should fall back to instant period when no duration', () => {
      const ctx = buildPersonInvolvedContext(makeConfig(), 0);

      expect(ctx.period).toEqual({ instant: '2025-06-15' });
    });

    it('should use PersonInvolvedInImplementationDimension', () => {
      const ctx = buildPersonInvolvedContext(makeConfig(), 3);

      expect(ctx.scenario?.typedMember?.dimension).toBe(
        'mica:PersonInvolvedInImplementationDimension'
      );
      expect(ctx.scenario?.typedMember?.value).toBe('person_3');
    });
  });

  describe('buildAllContexts', () => {
    it('should throw when LEI is missing', () => {
      expect(() => buildAllContexts({})).toThrow('LEI is required');
    });

    it('should create instant, duration, and offeror contexts for minimal data', () => {
      const contexts = buildAllContexts({
        partA: { lei: VALID_LEI } as never,
        documentDate: '2025-06-15',
      });

      const ids = contexts.map((c) => c.id);
      expect(ids).toContain('ctx_instant');
      expect(ids).toContain('ctx_duration');
      expect(ids).toContain('ctx_offeror');
      expect(contexts).toHaveLength(3);
    });

    it('should derive duration period from documentDate year', () => {
      const contexts = buildAllContexts({
        partA: { lei: VALID_LEI } as never,
        documentDate: '2025-06-15',
      });

      const durationCtx = contexts.find((c) => c.id === 'ctx_duration');
      expect(durationCtx?.period).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });
    });

    it('should add issuer context when partB.lei differs from partA.lei', () => {
      const contexts = buildAllContexts({
        partA: { lei: VALID_LEI } as never,
        partB: { lei: '254900OPPU84GM83MG36' } as never,
        documentDate: '2025-06-15',
      });

      const ids = contexts.map((c) => c.id);
      expect(ids).toContain('ctx_issuer');
    });

    it('should not add issuer context when partB.lei equals partA.lei', () => {
      const contexts = buildAllContexts({
        partA: { lei: VALID_LEI } as never,
        partB: { lei: VALID_LEI } as never,
        documentDate: '2025-06-15',
      });

      const ids = contexts.map((c) => c.id);
      expect(ids).not.toContain('ctx_issuer');
    });

    it('should add management body member contexts', () => {
      const contexts = buildAllContexts({
        partA: { lei: VALID_LEI } as never,
        documentDate: '2025-06-15',
        managementBodyMembers: {
          offeror: [{ name: 'Alice' }, { name: 'Bob' }] as never[],
        },
      });

      const ids = contexts.map((c) => c.id);
      expect(ids).toContain('ctx_mgmt_offeror_0');
      expect(ids).toContain('ctx_mgmt_offeror_1');
    });

    it('should add person involved contexts', () => {
      const contexts = buildAllContexts({
        partA: { lei: VALID_LEI } as never,
        documentDate: '2025-06-15',
        projectPersons: [{ name: 'Charlie' }] as never[],
      });

      const ids = contexts.map((c) => c.id);
      expect(ids).toContain('ctx_person_involved_0');
    });
  });

  describe('getContextId', () => {
    it('should return correct id for instant', () => {
      expect(getContextId('instant')).toBe('ctx_instant');
    });

    it('should return correct id for duration', () => {
      expect(getContextId('duration')).toBe('ctx_duration');
    });

    it('should return correct id for offeror', () => {
      expect(getContextId('offeror')).toBe('ctx_offeror');
    });

    it('should return correct id for issuer', () => {
      expect(getContextId('issuer')).toBe('ctx_issuer');
    });

    it('should return correct id for management with index and entity type', () => {
      expect(getContextId('management', 2, 'issuer')).toBe('ctx_mgmt_issuer_2');
    });

    it('should return correct id for person_involved with index', () => {
      expect(getContextId('person_involved', 0)).toBe('ctx_person_involved_0');
    });
  });
});
