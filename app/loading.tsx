export default function DashboardLoading() {
  return (
    <div className="route-loading-shell">
      <header className="route-loading-header" />
      <main className="route-loading-content" aria-busy="true" aria-label="Loading dashboard">
        <div className="route-loading-toolbar" />
        {[0, 1, 2].map((item) => (
          <div className="route-loading-panel" key={item}>
            <div className="route-loading-panel-title" />
            <div className="route-loading-row" />
            <div className="route-loading-row" />
          </div>
        ))}
      </main>
    </div>
  );
}
