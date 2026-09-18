# Early

Site statique compatible GitHub Pages.

## Publication

1. Pousser la branche `main` sur GitHub.
2. Dans **Settings > Pages**, choisir **GitHub Actions** comme source.
3. Le workflow `.github/workflows/pages.yml` publie automatiquement le dossier `public/`.

## Backend Vercel

Le dossier `api/` fournit le login utilisateur/mot de passe, la session et le logout. Déployer ce projet sur Vercel, puis définir ces variables dans **Project Settings > Environment Variables** :

- `AUTH_USERNAME` : nom de l'utilisateur autorisé
- `AUTH_PASSWORD_HASH` : hash scrypt au format `salt:hash`
- `SESSION_SECRET` : clé aléatoire longue, différente par environnement
- `FRONTEND_ORIGIN` : URL exacte du site GitHub Pages

Générer un hash sans l'écrire dans le dépôt :

```bash
node -e "const c=require('crypto'),p=process.argv[1],s=c.randomBytes(16).toString('hex'); console.log(s+':'+c.scryptSync(p,s,64).toString('hex'))" 'mot-de-passe-local'
```

Remplacer `https://YOUR-VERCEL-PROJECT.vercel.app` dans `public/index.html` et `public/dashboard.html` par l'URL réelle de l'API Vercel. Le mot de passe et les clés restent uniquement dans Vercel.
