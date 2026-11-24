export type FiscalYear = {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "closed";
  max_total_heads: number | null;
  max_heads_per_member: number | null;
  head_restrictions_enabled: boolean;
  created_at: string;
  activated_at?: string | null;
};

export type TierSetting = {
  id: number;
  fiscal_year_id: number;
  tier_code: string;
  display_name: string;
  enabled: boolean;
  max_heads_per_member: number | null;
  loan_eligible: boolean;
  loan_limit_mode: "contributions_only" | "tier_maximum" | "unlimited";
  contribution_multiplier: number;
  max_loan_amount: number | null;
};

export type FiscalYearAssignment = {
  id: number;
  fiscal_year_id: number;
  member_id: number;
  tier_code: string;
  assigned_heads: number;
  assigned_at: string;
  member?: { id: number; name: string; heads: number };
};

export type FiscalYearSettings = {
  fiscalYear: FiscalYear;
  tiers: TierSetting[];
  assignments: FiscalYearAssignment[];
};
