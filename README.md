# Retirement Simulator Workspace

This repository keeps the official retirement life planner and older reference apps side by side.

## Apps

- `apps/retirement-life-planner`: official version with detailed tax, social-insurance, and asset-use planning logic
- `apps/retirement-life-planner-public`: public-facing version under redesign
- `apps/us-options-risk-planner`: public pilot for hand-entered US stock options position management
- `apps/current`: old reference version

## Common commands

```bash
npm run serve:local
npm run serve:retirement-life-planner
npm run serve:public
npm run build:retirement-life-planner
npm run build:public
npm run test:retirement-life-planner
npm run test:public
```

The official local URL is `http://127.0.0.1:5175/`.

The public-facing app uses `http://127.0.0.1:5176/` during local development.

## LAN sharing

The official app is also deployed on the QNAP for home LAN access:

```text
http://192.168.10.156:5175/
```

Redeploy the latest build to QNAP with:

```bash
scripts/deploy-qnap-lan.sh
```
