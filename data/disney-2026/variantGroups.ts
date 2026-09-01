// Shared identifiers for mutually-exclusive event groups -- only one member
// of a group is ever drawn into the same grid (docs/grid-content-pipeline.md
// §5). Always reference these constants from bingoes.ts rather than typing a
// raw string, so a typo is a compile error instead of silently starting a
// new, unintended group of size one.
export const VariantGroup = {
  RIDE_BREAKDOWN: "ride-breakdown",
  FLIGHT_TIMING: "flight-timing",
  MERCH: "merch",
  SECURITY_INCIDENT: "security-incident",
  SHOOTER: "shooter",
  FALL: "fall",
  FORGOT: "forgot"
} as const;

export type VariantGroupId = (typeof VariantGroup)[keyof typeof VariantGroup];
