export default function Loading() {
  return (
    <div className="section">
      <div className="wrap stack" style={{ gap: 18 }}>
        <div className="skeleton" style={{ height: 34, width: 220 }} />
        <div className="skeleton" style={{ height: 16, width: "60%" }} />
        <div className="beat-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 320 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
