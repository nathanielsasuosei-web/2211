import Link from "next/link";
import { all } from "@/lib/db";
import { listOrders, decorateOrders } from "@/lib/repo";
import { formatDateTime, methodChip, statusChip } from "@/lib/view";
import { moneyLabel } from "@/lib/config";
import OrderControls from "@/components/OrderControls";
import { IconCard } from "@/components/icons";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Orders" };

const FILTERS = [
  { id: "", label: "All" },
  { id: "in_review", label: "Needs review" },
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "delivered", label: "Delivered" },
  { id: "paid", label: "Paid" },
  { id: "failed", label: "Failed" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ref?: string }>;
}) {
  const { status, ref } = await searchParams;
  const orders: Order[] = ref
    ? ((await all<Order>("SELECT * FROM orders WHERE reference LIKE $1 ORDER BY created_at DESC LIMIT 60", [`%${ref}%`])) as Order[])
    : await listOrders({ status: status || undefined, limit: 120 });
  const decorated = await decorateOrders(orders);

  const totals = decorated.reduce(
    (acc, o) => {
      acc.count += 1;
      if (["paid", "delivered"].includes(o.status)) acc.revenue += o.amount_cents;
      if (["pending", "awaiting_payment", "in_review"].includes(o.status)) acc.pending += 1;
      return acc;
    },
    { count: 0, revenue: 0, pending: 0 },
  );

  return (
    <section className="stack" style={{ gap: 16 }}>
      <div className="row row--between row--wrap" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow"><IconCard size={12} /> Revenue</span>
          <h2 className="display h-md">Orders &amp; payments</h2>
        </div>
        <div className="row row--wrap" style={{ gap: 8 }}>
          <span className="chip">{totals.count} orders</span>
          <span className="chip chip--ok">{moneyLabel(totals.revenue)} collected</span>
          <span className="chip chip--warn">{totals.pending} awaiting</span>
        </div>
      </div>

      <div className="row row--wrap" style={{ gap: 8 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.id || "all"}
            href={f.id ? `/admin/orders?status=${f.id}` : "/admin/orders"}
            className={`chip ${status === f.id || (!status && !f.id) ? "chip--red" : ""}`}
          >
            {f.label}
          </Link>
        ))}
        <form className="row" style={{ gap: 6, marginLeft: "auto" }}>
          <input name="ref" defaultValue={ref ?? ""} className="input" placeholder="Search reference…" style={{ width: 200, padding: "8px 12px" }} />
          <button type="submit" className="btn btn--dark btn--sm">Find</button>
        </form>
      </div>

      {decorated.length === 0 ? (
        <div className="empty">
          <h4>No orders match this filter</h4>
          <p>Orders appear here the moment an artist starts checkout.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Artist</th>
                <th>Beat / licence</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {decorated.map((o) => {
                const status_ = statusChip(o.status);
                const method = methodChip(o.method);
                return (
                  <tr key={o.id}>
                    <td className="mono tiny">{o.reference}</td>
                    <td>
                      <div className="stack" style={{ gap: 2 }}>
                        <Link href={`/admin/artists?q=${encodeURIComponent(o.buyer?.email ?? "")}`} style={{ fontWeight: 700, fontSize: 13.5 }}>
                          {o.buyer?.name ?? "—"}
                        </Link>
                        <span className="tiny dim mono">{o.buyer?.email}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack" style={{ gap: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{o.beat?.title ?? "—"}</span>
                        <span className="tiny dim">{o.provider_ref ? `ref: ${o.provider_ref}` : o.bank_reference ? `bank: ${o.bank_reference}` : "—"}</span>
                      </div>
                    </td>
                    <td className="mono">{moneyLabel(o.amount_cents, o.currency)}</td>
                    <td><span className={`chip ${method.tone}`}>{method.label}</span></td>
                    <td><span className={`chip ${status_.tone}`}>{status_.label}</span></td>
                    <td className="tiny muted">{formatDateTime(o.created_at)}</td>
                    <td>
                      <OrderControls
                        reference={o.reference}
                        status={o.status}
                        amount={moneyLabel(o.amount_cents, o.currency)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
