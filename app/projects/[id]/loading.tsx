export default function ProjectLoading() {
  return (
    <main className="detail-shell">
      <div className="detail-container route-project-loading" aria-busy="true" aria-label="Loading project">
        <div className="route-loading-back" />
        <section className="detail-hero">
          <div className="route-loading-title" />
          <div className="route-loading-subtitle" />
          <div className="route-loading-meta" />
        </section>
        <section className="detail-task-panel">
          <div className="route-loading-task-header" />
          {[0, 1, 2, 3].map((item) => (
            <div className="route-loading-task-row" key={item} />
          ))}
        </section>
      </div>
    </main>
  );
}
