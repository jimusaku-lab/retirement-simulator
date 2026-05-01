# Retirement Simulator Workspace

This repository now keeps the stable app and the tax/social-insurance rewrite side by side.

## Apps

- `apps/current`: current stable retirement simulator
- `apps/next-tax-social`: next version with detailed tax and social-insurance logic

## Common commands

```bash
npm run serve:local
npm run serve:current
npm run serve:next-tax-social
npm run build:current
npm run build:next-tax-social
npm run test:current
npm run test:next-tax-social
```

The stable local URL remains `http://127.0.0.1:5174/`.
