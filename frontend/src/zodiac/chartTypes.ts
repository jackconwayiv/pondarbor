/** Subset of backend natal_chart JSON — sufficient for Zodiackary UI. */

export type ChartPoint = {
  longitude_deg: number;
  sign: string;
  retrograde?: boolean;
  house?: number;
};

export type NatalChartPayload = {
  schema_version: number;
  meta: Record<string, unknown>;
  points: Record<string, ChartPoint>;
  angles: Record<string, ChartPoint>;
  houses: {
    system: string;
    cusps_longitude_deg: number[];
  };
  aspects: Array<{
    body_a: string;
    body_b: string;
    type: string;
    nominal_angle_deg: number;
    orb_deg: number;
  }>;
};
