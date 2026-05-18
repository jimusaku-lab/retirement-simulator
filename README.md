# Retirement Simulator Workspace

This repository keeps the official retirement life planner and older reference apps side by side.

## Apps

- `apps/retirement-life-planner`: official version with detailed tax, social-insurance, and asset-use planning logic
- `apps/current`: old reference version

## Common commands

```bash
npm run serve:local
npm run serve:retirement-life-planner
npm run build:retirement-life-planner
npm run test:retirement-life-planner
```

The official local URL is `http://127.0.0.1:5175/`.

## LAN sharing

The official app is also deployed on the QNAP for home LAN access:

```text
http://192.168.10.156:5175/
```

Redeploy the latest build to QNAP with:

```bash
scripts/deploy-qnap-lan.sh
```
