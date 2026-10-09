import { notFound, redirect } from "next/navigation";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getSession } from "@/lib/auth";
import { getBeatById, getOrderByRef } from "@/lib/repo";
import DemoCheckout from "@/components/DemoCheckout";
import { moneyLabel } from "@/lib/config";
import { fileUrl } from "@/lib/view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Simulated checkout" };

/**
 * Stands in for the hosted payment page when no gateway keys are configured, so
 * the full purchase → delivery flow can be demoed and tested end to end.
 */
export default async function DemoCheckoutPage({ params }: { params: Promise<{ ref: string }> }) {
  await ensureBootstrapped();
  const { ref } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/checkout/demo/${ref}`)}`);

  const order = await getOrderByRef(ref);
  if (!order) notFound();
  if (["paid", "delivered"].includes(order.status)) redirect(`/order/${order.reference}?status=delivered`);

  const beat = await getBeatById(order.beat_id);
  if (!beat) notFound();

  return (
    <div className="section section--tight">
      <div className="wrap" style={{ maxWidth: 620, marginInline: "auto" }}>
        <DemoCheckout
          reference={order.reference}
          amount={moneyLabel(order.amount_cents, order.currency)}
          beatTitle={beat.title}
          artwork={fileUrl(beat.artwork)}
          email={session.email}
          phone={order.phone}
        />
      </div>
    </div>
  );
}
