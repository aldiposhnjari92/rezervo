import type { BookingStatus, WorkingHours } from "./types";

export type AdminOverview = {
  users_total: number;
  businesses_total: number;
  businesses_suspended: number;
  businesses_new_30d: number;
  businesses_active_30d: number;
  services_total: number;
  bookings_total: number;
  bookings_30d: number;
  bookings_upcoming: number;
  status_confirmed: number;
  status_completed: number;
  status_cancelled: number;
  status_no_show: number;
  gmv_total: number;
  gmv_30d: number;
};

export type DailyBookings = {
  day: string;
  bookings: number;
  completed: number;
  no_shows: number;
};

export type AdminBusinessRow = {
  business_id: string;
  owner_id: string;
  name: string;
  slug: string;
  owner_email: string;
  phone: string | null;
  created_at: string;
  suspended_at: string | null;
  services_count: number;
  bookings_total: number;
  bookings_30d: number;
  no_shows: number;
  gmv: number;
  last_booking: string | null;
};

export type OrphanAccount = {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
};

export type AdminAccount = {
  user: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed: boolean;
    is_admin: boolean;
  };
  business: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    created_at: string;
    suspended_at: string | null;
    suspended_reason: string | null;
    working_hours: WorkingHours;
  } | null;
  stats: {
    services: number;
    bookings: number;
    completed: number;
    no_shows: number;
    cancelled: number;
    upcoming: number;
    gmv: number;
  } | null;
  recent_bookings: {
    id: string;
    customer_name: string;
    start_time: string;
    status: BookingStatus;
    service_name: string;
  }[];
  services: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
    is_active: boolean;
  }[];
};

/**
 * Ngjyrat e grafikëve.
 *
 * Të validuara me `validate_palette.js` mbi sfond të bardhë: banda e ndriçimit,
 * dyshemeja e ngopjes, ndarja për daltonizëm dhe kontrasti — të gjitha kalojnë.
 * Renditja NUK është kozmetike: bluja qëndron mes jeshiles dhe portokallisë,
 * sepse jeshile↔portokalli është pikërisht çifti që ngatërrohet te daltonizmi
 * i kuq-jeshil. Mos i ndërro vendet pa e rikontrolluar paletën.
 */
export const STATUS_COLORS: Record<BookingStatus, string> = {
  completed: "#047857",
  confirmed: "#2563eb",
  no_show: "#b45309",
  cancelled: "#94a3b8", // gri: kategori e zbehur, jo ngjyrë serie
};

/** Renditja në shiritin e statuseve — ndjek renditjen e validuar më sipër. */
export const STATUS_ORDER: BookingStatus[] = [
  "completed",
  "confirmed",
  "no_show",
  "cancelled",
];

// ---------------------------------------------------------------------------
//  Paneli i pronarit
// ---------------------------------------------------------------------------

export type OwnerDaily = {
  day: string;
  bookings: number;
  completed: number;
  no_shows: number;
  earnings: number;
};

export type OwnerDashboard = {
  bookings_total: number;
  bookings_period: number;
  upcoming: number;
  today: number;
  status_confirmed: number;
  status_completed: number;
  status_cancelled: number;
  status_no_show: number;
  earnings_total: number;
  earnings_period: number;
  earnings_prev: number;
  lost_no_show: number;
  customers_total: number;
  customers_repeat: number;
  daily: OwnerDaily[];
  by_weekday: { dow: number; bookings: number }[];
  by_hour: { hour: number; bookings: number }[];
  top_services: { name: string; bookings: number; earnings: number }[];
};
