import Link from "next/link";

export default function NotFound() {
  return (
    <div className="section">
      <div className="wrap center stack" style={{ gap: 16, alignItems: "center" }}>
        <span className="eyebrow">404</span>
        <h1 className="display h-xl red">LOST SIGNAL</h1>
        <p className="lede" style={{ marginInline: "auto" }}>
          That page does not exist — but the beat store is right here.
        </p>
        <span className="row" style={{ gap: 10 }}>
          <Link href="/beats" className="btn btn--primary">Browse beats</Link>
          <Link href="/" className="btn btn--ghost">Back home</Link>
        </span>
      </div>
    </div>
  );
}
