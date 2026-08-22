# Deployment Options

EcoFlowMon can be deployed to various cloud platforms. Choose the option that best fits your needs.

## Quick Comparison

| Platform | Cost (Year 1) | Cost (Year 2+) | Region | Latency (EU) | Setup Time | Maintenance |
|----------|---------------|----------------|--------|--------------|------------|-------------|
| **GCP Always Free** | **$0-24** 🏆 | **$0-24** 🏆 | USA (us-east1) | ~80-100ms | 30min | Medium |
| **AWS Free Tier → Lightsail** | $0 | $60 | EU (Frankfurt) | ~20ms | 30min | Medium |
| **Fly.io** | $43 | $43 | EU (Frankfurt) | ~20ms | ✅ **5min** | ✅ **Low** |
| **Render** | $84 | $84 | Variable | Variable | 10min | Low |

## Detailed Comparison

### 1. GCP Always Free (Recommended for Budget)

**Best for:** Maximum cost savings, hobby projects

**Specs:**
- VM: e2-micro (1 vCPU, 1GB RAM)
- Storage: 30GB HDD
- Traffic: 1GB/month free, then $0.12/GB
- Region: us-east1 (South Carolina)

**Pros:**
- ✅ Completely free (within limits)
- ✅ Generous specs (1GB RAM)
- ✅ Always Free (not time-limited)
- ✅ 30GB storage

**Cons:**
- ❌ USA only (80-100ms latency to EU)
- ❌ Traffic limit (1GB/month)
- ❌ Manual setup required
- ❌ More maintenance

**Setup:** [terraform/gcp/README.md](terraform/gcp/README.md)

**Estimated Traffic Usage:**
- Light usage (1-2x/day): ~500MB/month ✅ Free
- Medium usage (5-10x/day): ~1-2GB/month → ~$0-12/year
- Heavy usage (20+x/day): ~3-5GB/month → ~$24-48/year

---

### 2. AWS EC2 Free Tier → Lightsail

**Best for:** EU region preference, 12 months free trial

**Specs:**
- VM: t3.micro (2 vCPUs, 1GB RAM)
- Storage: 30GB SSD
- Traffic: 15GB/month free
- Region: eu-central-1 (Frankfurt)

**Pros:**
- ✅ 12 months free
- ✅ EU region (low latency)
- ✅ More CPU than GCP
- ✅ After free tier: Lightsail $5/month

**Cons:**
- ❌ Only 12 months free
- ❌ After 12 months: ~$5-7.50/month
- ❌ Manual setup required

**Cost:**
- Months 1-12: $0
- Months 13+: $5/month (Lightsail) or $7.50/month (EC2 t3.micro)

---

### 3. Fly.io (Recommended for Simplicity)

**Best for:** Easy setup, EU region, minimal maintenance

**Specs:**
- VM: shared-cpu-1x (1GB RAM)
- Storage: 3GB SSD + 3GB persistent volume
- Traffic: 160GB/month
- Region: fra (Frankfurt)

**Pros:**
- ✅ Extremely easy setup (5 minutes)
- ✅ EU region (low latency)
- ✅ GitHub Actions CI/CD included
- ✅ Minimal maintenance
- ✅ PaaS - managed infrastructure

**Cons:**
- ❌ Costs $3.60/month ($43/year)
- ❌ Limited storage (3GB)

**Setup:** Already configured! See [fly.toml](fly.toml)

**Quick start:**
```bash
fly scale vm shared-cpu-1x --memory 1024 --app ecoflowmon
```

---

### 4. Render (Not Recommended)

**Best for:** If you're already using Render

**Pros:**
- ✅ Very easy setup
- ✅ Automatic CI/CD

**Cons:**
- ❌ Expensive ($7/month for 512MB RAM)
- ❌ Less RAM than alternatives
- ❌ Less control

**Cost:** $84/year

---

## Recommendation by Use Case

### I want the cheapest option possible
→ **GCP Always Free** ($0-24/year)
- Accept 80-100ms latency from EU
- Manual setup & maintenance
- [Setup Guide](terraform/gcp/README.md)

### I want EU region and low cost
→ **AWS Free Tier (12 months) → Fly.io**
- Use AWS free tier for first year ($0)
- Switch to Fly.io after ($43/year)
- AWS Setup: Coming soon

### I want the easiest setup
→ **Fly.io** ($43/year)
- Already configured and running!
- Just upgrade: `fly scale vm shared-cpu-1x --memory 1024`

### I want the best of everything
→ **GCP Always Free** (cost) + **Fly.io** (production)
- Use GCP for testing/backup ($0)
- Use Fly.io for production ($43/year)
- Total: $43/year with redundancy

---

## Migration Guide

### From Render to Fly.io
Already done! Just:
1. Set GitHub secret: `FLY_API_TOKEN`
2. Push to main branch
3. Delete Render service

### From Render to GCP
1. Follow [GCP Setup](terraform/gcp/README.md)
2. Verify GCP deployment works
3. Delete Render service

### From Fly.io to GCP
1. Follow [GCP Setup](terraform/gcp/README.md)
2. Update DNS (if any)
3. Delete Fly.io app: `fly apps destroy ecoflowmon`

---

## Current Setup

Production runs on the **GCP Always Free e2-micro VM** — four Docker containers
(`prometheus`, `grafana`, `ecoflow-collector`, `smartmeter-exporter`) started from
`docker-compose.gcp.yml`. Render and Fly.io are no longer in use.

### There is no automated deploy to the VM

GitHub Actions (`.github/workflows/deploy.yml`) builds the image and pushes it to
`ghcr.io` on every push to `main`. **Rolling the containers on the VM is manual.**

A `gcp-deploy.yml` workflow used to claim otherwise. It never ran successfully: it
referenced the repository secrets `GCP_SA_KEY` and `GCP_PROJECT_ID`, neither of
which was ever created, so `google-github-actions/auth` aborted after ~10 s on
every push to `main` and the VM was never contacted. The workflow was removed
rather than left as a permanently-red check. Its commands are preserved below.

### Manual deploy

```bash
gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command="\
  cd /opt/ecoflowmon && \
  sudo git pull origin main && \
  sudo docker compose -f docker-compose.gcp.yml pull && \
  sudo docker compose -f docker-compose.gcp.yml up -d --force-recreate"
```

Verify afterwards:

```bash
gcloud compute ssh "$INSTANCE" --zone="$ZONE" --command="docker ps"
gcloud compute instances describe "$INSTANCE" --zone="$ZONE" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

> **Confirm `$INSTANCE` and `$ZONE` once before relying on them.** The repository
> (`terraform/gcp/variables.tf`, `terraform/gcp/README.md`, `DOCUMENTATION.md`)
> says `ecoflowmon` / `us-east1-b`; the operator's notes say `ecoflowmon-d` /
> `us-east1-d`. `gcloud compute instances list` settles it. The Terraform defaults
> were deliberately left untouched — changing a zone default can plan a
> destroy/recreate.

> The old workflow used `docker-compose` (v1). Current images ship Compose v2, so
> the commands above use `docker compose`. If the workflow is ever restored,
> `gcloud compute ssh` from a runner also typically needs `--tunnel-through-iap`.

### Restoring an automated deploy

It needs a credential that does not exist yet — either a service-account key in
`GCP_SA_KEY` plus `GCP_PROJECT_ID`, or (preferred, no long-lived key) Workload
Identity Federation. Both are configured in the GCP console first; adding the
workflow back without them reproduces the original failure exactly.

---

## Support

For deployment questions, create an issue:
https://github.com/tbuchboeck/EcoFlowMon/issues
