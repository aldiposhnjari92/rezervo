export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

/** Orari i një dite; `null` do të thotë "mbyllur". */
export type DayHours = { start: string; end: string } | null;

export type WorkingHours = Record<DayKey, DayHours>;

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  owner_email: string;
  phone: string | null;
  working_hours: WorkingHours;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  buffer_minutes: number;
  min_notice_minutes: number;
  booking_window_days: number;
  /** "HH:mm" ose null. */
  break_start: string | null;
  break_end: string | null;
  /** Hyjnë te koka e faturës; të dyja opsionale. */
  nipt: string | null;
  address: string | null;
};

export type InvoiceKind = "booking" | "subscription";

export type InvoiceLine = {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

/**
 * Fatura ruan shitësin, blerësin dhe rreshtat si fotografi të momentit — nëse
 * biznesi ndryshon emrin nesër, fatura e djeshme mbetet ashtu siç u dha.
 *
 * SHËNIM: nuk është faturë e fiskalizuar. Nuk ka NSLF/NIVF dhe asgjë nuk i
 * dërgohet sistemit të tatimeve.
 */
export type Invoice = {
  id: string;
  business_id: string;
  kind: InvoiceKind;
  number: string;
  issued_on: string;
  booking_id: string | null;
  period_start: string | null;
  period_end: string | null;
  seller_name: string;
  seller_nipt: string | null;
  seller_address: string | null;
  buyer_name: string;
  buyer_nipt: string | null;
  buyer_address: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  note: string | null;
  created_at: string;
};

export type Closure = {
  id: string;
  business_id: string;
  closed_on: string;
  reason: string | null;
  created_at: string;
};

export type Service = {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at: string;
};

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export type Booking = {
  id: string;
  business_id: string;
  service_id: string;
  customer_name: string;
  /** Null për walk-in-et që i shton pronari pa numër. */
  customer_phone: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  created_at: string;
  created_by: "customer" | "owner";
  note: string | null;
};

export type BookingWithService = Booking & {
  services: Pick<Service, "id" | "name" | "duration_minutes" | "price"> | null;
};

/** Forma që kthen rpc `get_public_business`. */
export type PublicBusiness = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  working_hours: WorkingHours;
  buffer_minutes: number;
  min_notice_minutes: number;
  booking_window_days: number;
  break_start: string | null;
  break_end: string | null;
  /** Datat "yyyy-MM-dd" ku biznesi është i mbyllur. */
  closures: string[];
  services: PublicService[];
};

export type CustomerRow = {
  customer_key: string;
  customer_name: string;
  customer_phone: string | null;
  visits: number;
  completed: number;
  no_shows: number;
  cancelled: number;
  first_visit: string;
  last_visit: string;
  total_spent: number;
};

export type PublicService = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};

export type TakenSlot = { start_time: string; end_time: string };

export const DAY_LABELS_SQ: Record<DayKey, string> = {
  monday: "E hënë",
  tuesday: "E martë",
  wednesday: "E mërkurë",
  thursday: "E enjte",
  friday: "E premte",
  saturday: "E shtunë",
  sunday: "E diel",
};

export const DAY_LABELS_SHORT_SQ: Record<DayKey, string> = {
  monday: "Hën",
  tuesday: "Mar",
  wednesday: "Mër",
  thursday: "Enj",
  friday: "Pre",
  saturday: "Sht",
  sunday: "Die",
};

export const STATUS_LABELS_SQ: Record<BookingStatus, string> = {
  confirmed: "Konfirmuar",
  cancelled: "Anuluar",
  completed: "Përfunduar",
  no_show: "Nuk erdhi",
};

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { start: "09:00", end: "18:00" },
  tuesday: { start: "09:00", end: "18:00" },
  wednesday: { start: "09:00", end: "18:00" },
  thursday: { start: "09:00", end: "18:00" },
  friday: { start: "09:00", end: "18:00" },
  saturday: { start: "09:00", end: "14:00" },
  sunday: null,
};
