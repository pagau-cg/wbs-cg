# Déploiement WBS CG — Guide complet

## Pré-requis
- Azure CLI (`az`) connecté au compte Construction Gauthier
- Accès au repo GitHub `pagau-cg/wbs-cg`
- Accès à Azure Portal (groupe `rg-wbs-cg`)
- L'app Entra ID de `cg-estimation-app` (même tenant → même enregistrement)

---

## Étape 1 — Créer le container Blob Storage

```bash
az storage container create \
  --name wbs-cg \
  --account-name wbscgstorage \
  --auth-mode login \
  --public-access off
```

---

## Étape 2 — Récupérer la connection string du Storage

```bash
az storage account show-connection-string \
  --name wbscgstorage \
  --resource-group rg-wbs-cg \
  --query connectionString -o tsv
```

Copier la valeur — elle sera utilisée à l'étape 4.

---

## Étape 3 — Configurer les variables d'application de la Static Web App

Dans Azure Portal → Static Web App `wbs-cg` → **Configuration** :

| Nom                        | Valeur                                              |
|----------------------------|-----------------------------------------------------|
| `STORAGE_CONNECTION_STRING`| Connection string copiée à l'étape 2               |
| `AZURE_CLIENT_ID`          | Client ID de l'app Entra ID (`cg-estimation-app`)  |
| `AZURE_CLIENT_SECRET`      | Secret de l'app Entra ID                           |

> ⚠️ Ces valeurs sont sensibles — ne jamais les mettre dans le repo GitHub.

---

## Étape 4 — Enregistrer la nouvelle URL dans Entra ID

Dans **Azure Portal → Entra ID → App registrations → cg-estimation-app** :

1. **Authentication → Redirect URIs** → Ajouter :
   ```
   https://wbs-cg.azurestaticapps.net/.auth/login/aad/callback
   ```
   (remplacer par l'URL réelle de votre Static Web App)

2. Si le domaine personnalisé est configuré, ajouter aussi :
   ```
   https://wbs.constructiongauthier.com/.auth/login/aad/callback
   ```

---

## Étape 5 — Récupérer le token de déploiement GitHub

```bash
az staticwebapp secrets list \
  --name wbs-cg \
  --resource-group rg-wbs-cg \
  --query "properties.apiKey" -o tsv
```

Dans **GitHub → repo `pagau-cg/wbs-cg` → Settings → Secrets and variables → Actions** :

- Ajouter le secret : `AZURE_STATIC_WEB_APPS_API_TOKEN` = valeur ci-dessus

---

## Étape 6 — Structure du repo GitHub

Votre repo doit avoir cette structure **à la racine** :

```
wbs-cg/
├── index.html                          ← L'outil WBS (modifié)
├── staticwebapp.config.json            ← Auth Entra ID
├── api/
│   ├── host.json
│   ├── package.json
│   ├── shared/
│   │   └── storageHelper.js
│   ├── projects/
│   │   ├── function.json
│   │   └── index.js
│   └── listProjects/
│       ├── function.json
│       └── index.js
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## Étape 7 — Premier déploiement

```bash
git add .
git commit -m "feat: add Azure auth + Blob Storage persistence"
git push origin main
```

Le workflow GitHub Actions se déclenche automatiquement.
Surveiller dans **GitHub → Actions**.

---

## Étape 8 — Vérification post-déploiement

1. Ouvrir l'URL de la Static Web App
2. Vous devriez être redirigé vers la page de connexion Microsoft
3. Connectez-vous avec un compte `@constructiongauthier.com`
4. Créer un lot de test et cliquer **☁️ Sauvegarder**
5. Vérifier dans Azure Portal → Storage → container `wbs-cg` :
   - Un blob `users/{upn}/projects/{id}.json` doit apparaître

---

## Structure des données dans Blob Storage

```
wbs-cg (container)
└── users/
    └── jdupont@constructiongauthier.com/
        └── projects/
            ├── projet-alpha.json
            ├── projet-beta-phase-2.json
            └── reno-bureau-3e.json
```

Chaque fichier JSON contient l'état complet du WBS (lots, codes MF,
planification, secteurs, phases) + métadonnées de sauvegarde.

---

## Comportement de l'autosave

| Action                  | Comportement                                              |
|-------------------------|-----------------------------------------------------------|
| Modification d'un lot   | localStorage immédiat + cloud différé (8 secondes)       |
| Bouton ☁️ Sauvegarder   | Cloud immédiat + localStorage                             |
| Chargement page         | Cloud en priorité si projectId connu, sinon localStorage  |
| Hors ligne              | localStorage uniquement (fallback automatique)            |

---

## Dépannage

**Erreur 401 au clic sur Sauvegarder**
→ La session Entra ID a expiré. Recharger la page.

**Erreur 500 dans les Functions**
→ Vérifier que `STORAGE_CONNECTION_STRING` est bien configurée dans les
  Application Settings de la Static Web App.

**Le container `wbs-cg` n'existe pas**
→ Relancer l'étape 1, ou créer manuellement dans Azure Portal.

**Les Functions ne se déploient pas**
→ Vérifier que `api_location: "api"` est correct dans `deploy.yml` et
  que `api/package.json` est bien présent.
