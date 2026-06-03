import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary global : attrape toute erreur de rendu React non gérée et
 * affiche un écran de secours plutôt qu'un écran blanc silencieux.
 * Inclut un bouton pour recharger la page (récupère la plupart des états
 * corrompus en mémoire en réinitialisant le JS runtime).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Erreur de rendu:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-canvas p-8 text-center">
          <div className="text-6xl">⚠️</div>
          <div className="space-y-2">
            <h1 className="font-serif text-2xl text-foreground">Une erreur inattendue s'est produite</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              L'application a rencontré un problème. Rechargez la page pour réessayer.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Recharger la page
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("jabot-store");
                localStorage.removeItem("jabot_token");
                localStorage.removeItem("jabot_active_tree");
                window.location.href = "/";
              }}
              className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Réinitialiser la session
            </button>
          </div>
          {import.meta.env.DEV && (
            <details className="max-w-lg rounded-xl border border-border bg-card p-4 text-left">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Détails (dev)</summary>
              <pre className="mt-2 overflow-auto text-xs text-destructive whitespace-pre-wrap">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
