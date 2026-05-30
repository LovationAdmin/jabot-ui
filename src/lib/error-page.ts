export function renderErrorPage(message = "Une erreur inattendue s'est produite.") {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Erreur — Jabot</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: oklch(0.985 0.005 80); color: oklch(0.27 0.015 60); }
    .box { text-align: center; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: oklch(0.52 0.015 60); }
    a { color: oklch(0.39 0.105 55); }
  </style>
</head>
<body>
  <div class="box">
    <h1>Erreur serveur</h1>
    <p>${message}</p>
    <p><a href="/">Retour à l'accueil</a></p>
  </div>
</body>
</html>`;
}
