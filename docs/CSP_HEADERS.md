# Content-Security-Policy (CSP) pour maintx.org

Si les polices Google (Outfit) ou les images Unsplash sont bloquées en production, c’est que votre **serveur ou hébergeur** envoie un en-tête `Content-Security-Policy` plus strict que la meta tag du `index.html` (l’en-tête HTTP prime sur la meta).

## Directives à inclure

À ajouter ou à adapter dans la CSP envoyée par le serveur (nginx, Vercel, Netlify, etc.) :

| Directive     | Valeur à inclure |
|---------------|------------------|
| **style-src** | `'self' 'unsafe-inline' https://fonts.googleapis.com` |
| **font-src**  | `'self' https://fonts.gstatic.com` |
| **img-src**   | `'self' https://images.unsplash.com data: blob:` |

Le reste (default-src, script-src, connect-src) peut rester comme aujourd’hui.

## Exemples par hébergeur

### Vercel (`vercel.json` à la racine du frontend ou du monorepo)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://maintx.org https://*.maintx.org;"
        }
      ]
    }
  ]
}
```

### Netlify (`public/_headers` ou `_headers` à la racine)

```
/*
  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://maintx.org https://*.maintx.org;
```

### Nginx

```nginx
add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://maintx.org https://*.maintx.org;";
```

Après modification, redéployer ou recharger la config du serveur.

## 502 sur /api/auth/refresh

Une **502 Bad Gateway** sur `POST https://maintx.org/api/auth/refresh` indique que le reverse proxy (ou le load balancer) ne peut pas joindre le backend ou que le backend a planté. À vérifier :

- Le backend (Node) est bien démarré et écoute sur l’URL utilisée par le proxy.
- Les timeouts proxy/backend sont suffisants.
- Les logs du backend et du proxy pour cette requête (erreur 502, timeouts, crash).
