import { useEffect, useState } from "react";
import { EmbedViewerPage } from "./pages/EmbedViewerPage.js";
import { WorkflowExamplesPage } from "./pages/WorkflowExamplesPage.js";

type RoutePath = "/" | "/examples" | "/embed";

function normalizePath(pathname: string): RoutePath | null {
  if (pathname === "/") return "/";
  if (pathname === "/examples") return "/examples";
  if (pathname === "/embed") return "/embed";
  return null;
}

function useRoutePath() {
  const [routePath, setRoutePath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(normalizePath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: RoutePath) => {
    if (window.location.pathname === path) return;
    window.history.pushState({}, "", path);
    setRoutePath(path);
  };

  return {
    routePath,
    navigate,
  };
}

function NavLink({
  href,
  currentPath,
  label,
  onNavigate,
}: {
  href: RoutePath;
  currentPath: RoutePath | null;
  label: string;
  onNavigate: (path: RoutePath) => void;
}) {
  const isActive =
    href === "/examples"
      ? currentPath === "/" || currentPath === "/examples"
      : currentPath === href;

  return (
    <a
      href={href}
      className={`nav-link${isActive ? " nav-link--active" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {label}
    </a>
  );
}

export function App() {
  const { routePath, navigate } = useRoutePath();
  const currentPath = routePath ?? "/";

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <div className="brand-lockup">
            <strong>Cyoda Workflow Examples</strong>
            <span>Local demo routes inside `apps/docs-embed-demo`</span>
          </div>
          <nav className="nav-links" aria-label="Demo pages">
            <NavLink
              href="/examples"
              currentPath={routePath}
              label="Workflow playground"
              onNavigate={navigate}
            />
            <NavLink
              href="/embed"
              currentPath={routePath}
              label="Embed viewer example"
              onNavigate={navigate}
            />
          </nav>
        </div>
      </header>

      <main className="app-shell__main">
        {(currentPath === "/" || currentPath === "/examples") && <WorkflowExamplesPage />}
        {currentPath === "/embed" && <EmbedViewerPage />}
        {!routePath && (
          <section className="page-section">
            <div className="page-intro">
              <p className="eyebrow">Route not found</p>
              <h1>Demo page not found</h1>
              <p>Use one of the local demo routes above.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
