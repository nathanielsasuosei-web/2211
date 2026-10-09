export type Role = "artist" | "admin";

export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "in_review"
  | "paid"
  | "delivered"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "mpesa" | "paystack" | "bank" | "demo";

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  password_hash: string;
  role: Role;
  country: string | null;
  city: string | null;
  bio: string | null;
  avatar: string | null;
  email_opt_in: number;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface Beat {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  genre: string;
  mood: string | null;
  tags: string | null;
  bpm: number | null;
  musical_key: string | null;
  duration_sec: number | null;
  price_cents: number;
  currency: string;
  artwork: string | null;
  preview_file: string | null;
  full_file: string | null;
  trackout_file: string | null;
  is_free: number;
  exclusive_sold: number;
  published: number;
  featured: number;
  plays: number;
  downloads: number;
  likes: number;
  created_at: string;
  updated_at: string;
}

export interface BeatFile {
  id: string;
  beat_id: string;
  label: string;
  file_path: string;
  mime: string | null;
  bytes: number | null;
  included_in: string | null;
  created_at: string;
}

export interface License {
  id: string;
  beat_id: string;
  name: string;
  tier: number;
  price_cents: number;
  currency: string;
  description: string | null;
  perks: string | null;
  allows_exclusive: number;
  created_at: string;
}

export interface Video {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "file" | "youtube" | "vimeo" | "visualizer";
  url: string | null;
  file_path: string | null;
  poster: string | null;
  duration_sec: number | null;
  beat_id: string | null;
  published: number;
  views: number;
  created_at: string;
}

export interface Order {
  id: string;
  reference: string;
  user_id: string;
  beat_id: string;
  license_id: string | null;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: OrderStatus;
  provider: string | null;
  provider_ref: string | null;
  provider_payload: string | null;
  phone: string | null;
  bank_reference: string | null;
  bank_note: string | null;
  failure_reason: string | null;
  delivered_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  user_id: string;
  token: string;
  files: string;
  license_name: string | null;
  download_count: number;
  last_download_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string | null;
  direction: "inbound" | "outbound";
  kind: "contact" | "admin" | "system" | "order";
  from_user_id: string | null;
  to_user_id: string | null;
  from_name: string | null;
  from_email: string | null;
  subject: string;
  body: string;
  is_read: number;
  order_id: string | null;
  beat_id: string | null;
  created_at: string;
}

export interface EmailLogEntry {
  id: string;
  to_address: string;
  subject: string;
  status: "sent" | "queued" | "dev" | "failed";
  transport: string;
  error: string | null;
  attachments: string | null;
  body_preview: string | null;
  user_id: string | null;
  order_id: string | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
