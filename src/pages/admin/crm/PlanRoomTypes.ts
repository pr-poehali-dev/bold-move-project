export const THUMBNAIL_MAX = 8000;

export interface PlanRoom {
  id: number;
  name: string;
  thumbnail: string | null;
  data?: object;
  include_in_estimate: boolean;
  active_variant_id: number | null;
  active_variant_name: string | null;
  active_variant_thumbnail: string | null;
  active_variant_data?: object | null;
}

export interface PlanProject {
  name: string;
  client_name: string | null;
  address: string | null;
  phone: string | null;
  status: string;
}

export function getRoomThumb(room: PlanRoom): string | null {
  return room.active_variant_thumbnail || room.thumbnail;
}
