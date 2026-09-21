# Rummlee

Neighborhood finds for women in the city and the suburbs. Offer this week. Meet at a partner store, never a home address.

**The good stuff, before Saturday.**

This is the rewrite of rummlee.com (TanStack Start + Vercel + Neon). The live domain still pointed at Replit when this was first pushed — do not pause Replit until DNS cutover is verified.

Standing orders for Grok bots: [HANDOFF-AGENT.txt](./HANDOFF-AGENT.txt)

## Stack

- TanStack Start (Vite, React 19, Tailwind 4)
- Better Auth (Google, X, email)
- PGLite in preview, Neon in production
- PWA / Home Screen install

## Scripts

```
npm install
npm run dev          # 0.0.0.0:8080
npm run build        # vite build + db:migrate
npm run typecheck
```

Repo: https://github.com/MKRUnlimitedLLC/Rummlee
Vercel project: rummlee (`prj_Xubg2WZzVX7Lr5VHsunrg9VIbclN`)
