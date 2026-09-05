/**
 * Verified source registry for LeptoWatch (TypeScript mirror of protocols/leptospirosis_sources.json).
 * Every citation produced by the system must reference a source_id present here.
 */

export interface VerifiedSource {
  source_id: string;
  organization: string;
  title: string;
  reference: string;
  url: string;
  verified: boolean;
}

export const RULESET_VERSION = "1.0.0";

export const VERIFIED_SOURCES: { version: string; sources: VerifiedSource[] } = {
  version: "1.0.0",
  sources: [
    {
      source_id: "DOH-LEPTO-001",
      organization: "Philippine Department of Health (DOH)",
      title: "Leptospirosis Fast Lanes - DOH public advisories",
      reference: "DOH advisories / Philippine Information Agency coverage (2025-2026)",
      url: "https://pia.gov.ph/news/doh-strengthens-hospital-referral-system-activates-leptospirosis-fast-lanes-in-33-facilities/",
      verified: true,
    },
    {
      source_id: "WHO-LEPTO-001",
      organization: "World Health Organization (WHO)",
      title: "Human leptospirosis: guidance for diagnosis, surveillance and control",
      reference: "WHO/CDS/CSR/EPH 2002.23, WHO 2003",
      url: "https://www.who.int/publications/i/item/human-leptospirosis-guidance-for-diagnosis-surveillance-and-control",
      verified: true,
    },
    {
      source_id: "CDC-LEPTO-001",
      organization: "US Centers for Disease Control and Prevention (CDC)",
      title: "Clinical Overview of Leptospirosis",
      reference: "CDC Leptospirosis Healthcare Professionals, updated June 2026",
      url: "https://www.cdc.gov/leptospirosis/hcp/clinical-overview/index.html",
      verified: true,
    },
  ],
};

export const SOURCE_REGISTRY: Record<string, VerifiedSource> = Object.fromEntries(
  VERIFIED_SOURCES.sources.map((s) => [s.source_id, s])
);

export const DOH_FAST_LANE = "DOH-LEPTO-001";
export const WHO_GUIDANCE = "WHO-LEPTO-001";
export const CDC_OVERVIEW = "CDC-LEPTO-001";