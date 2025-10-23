# Cloud Deployment Guide

This guide explains how to deploy EcoFlowMon to the cloud using GitHub Actions and various hosting platforms.

## Prerequisites

1. GitHub repository with this code
2. EcoFlow API credentials (Access Key and Secret Key)
3. Account on one of the supported platforms (Render, Railway, or Fly.io)

## Step 1: Configure GitHub Secrets

Your EcoFlow credentials need to be stored as GitHub Secrets:

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name | Value | Required |
|-------------|-------|----------|
| `ECOFLOW_ACCESS_KEY` | Your EcoFlow Access Key | ✅ Yes |
| `ECOFLOW_SECRET_KEY` | Your EcoFlow Secret Key | ✅ Yes |

## Step 2: Choose Your Deployment Platform

### Option A: Render.com (Recommended - Easiest)

**Free tier includes: 750 hours/month**

1. Go to [render.com](https://render.com) and sign up
2. Click **New** → **Blueprint**
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. In the Render dashboard, go to your service
6. Click **Environment** and add:
   - `ECOFLOW_ACCESS_KEY` = your access key
   - `ECOFLOW_SECRET_KEY` = your secret key
7. Click **Manual Deploy** → **Deploy latest commit**

**Access your metrics:**
- Your service URL will be: `https://ecoflowmon.onrender.com/metrics`
- View in browser: `https://ecoflowmon.onrender.com/`

**Configure Prometheus to scrape:**
```yaml
scrape_configs:
  - job_name: 'ecoflow'
    static_configs:
      - targets: ['ecoflowmon.onrender.com:443']
        labels:
          instance: 'ecoflow-cloud'
    scheme: https
```

### Option B: Railway.app

**Free tier includes: $5 credit/month**

1. Go to [railway.app](https://railway.app) and sign up
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway will automatically detect `railway.json`
5. Click on your service → **Variables**
6. Add environment variables:
   - `ECOFLOW_ACCESS_KEY` = your access key
   - `ECOFLOW_SECRET_KEY` = your secret key
7. Click **Settings** → **Generate Domain** to get a public URL

**Optional: Auto-deploy via GitHub Actions**

1. Go to Railway → **Account Settings** → **Tokens**
2. Create a new token
3. Add to GitHub Secrets as `RAILWAY_TOKEN`
4. The workflow will auto-deploy on push to main

**Access your metrics:**
- Your URL will be like: `https://ecoflowmon-production.up.railway.app/metrics`

### Option C: Fly.io

**Free tier includes: 3 shared-cpu VMs with 256MB RAM**

1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. From your repository directory:
   ```bash
   fly launch --no-deploy
   ```
4. Set secrets:
   ```bash
   fly secrets set ECOFLOW_ACCESS_KEY=your_access_key
   fly secrets set ECOFLOW_SECRET_KEY=your_secret_key
   ```
5. Deploy:
   ```bash
   fly deploy
   ```

**Access your metrics:**
- Your URL will be: `https://ecoflowmon.fly.dev/metrics`

## Step 3: Verify Deployment

After deployment, verify your service is running:

1. Visit your service URL (e.g., `https://your-app.onrender.com/`)
2. Check health: `https://your-app.onrender.com/health`
3. View metrics: `https://your-app.onrender.com/metrics`

You should see:
- Health endpoint returns `OK`
- Metrics endpoint shows Prometheus-formatted metrics
- Logs show devices being discovered and metrics collected

## Step 4: Configure External Prometheus

To scrape metrics from your cloud deployment into your local Prometheus:

**Edit your local `prometheus.yml`:**
```yaml
global:
  scrape_interval: 60s

scrape_configs:
  - job_name: 'ecoflow-cloud'
    static_configs:
      - targets: ['your-app.onrender.com:443']  # Use your actual URL
    scheme: https
    metrics_path: /metrics
```

**Restart Prometheus:**
```bash
docker-compose restart prometheus
```

## Step 5: Setup Grafana Cloud (Optional)

For a completely cloud-based solution:

1. Sign up at [grafana.com](https://grafana.com) (free tier available)
2. Go to **Configuration** → **Data Sources** → **Add data source**
3. Select **Prometheus**
4. Enter your cloud Prometheus URL
5. Import the dashboard from `grafana/provisioning/dashboards/ecoflow-dashboard.json`

## GitHub Actions Workflow

The included workflow (`.github/workflows/deploy.yml`) automatically:

1. ✅ Builds Docker image on every push
2. ✅ Pushes to GitHub Container Registry
3. ✅ Triggers deployment (if configured)

**The workflow runs when:**
- Pushing to `main` branch
- Pushing to any `claude/**` branch
- Manually triggered via GitHub Actions UI

## Troubleshooting

### Deployment fails with "Missing environment variables"
- Ensure you've added `ECOFLOW_ACCESS_KEY` and `ECOFLOW_SECRET_KEY` to your platform's environment variables

### Service shows as "unhealthy"
- Check logs in your platform's dashboard
- Verify API credentials are correct
- Ensure you're using the same EcoFlow account as the app

### No metrics appearing
- Visit `/health` endpoint to verify service is running
- Check logs for API errors
- Verify collection interval (default: 60 seconds)
- Ensure devices are online in EcoFlow app

### Prometheus can't scrape metrics
- Verify your app's public URL is accessible
- Check firewall/security group settings
- Ensure you're using `https` scheme for cloud URLs
- Verify the metrics endpoint returns data: `curl https://your-app.com/metrics`

## Cost Considerations

All platforms offer free tiers suitable for this application:

- **Render.com**: 750 hours/month free (1 instance running 24/7)
- **Railway.app**: $5 credit/month (usually enough for small apps)
- **Fly.io**: 3 VMs with 256MB RAM free

The app uses minimal resources:
- ~50-100 MB RAM
- Very low CPU usage
- Minimal bandwidth (API calls only)

## Security Best Practices

1. ✅ **Never commit credentials** - Always use GitHub Secrets or platform environment variables
2. ✅ **Use HTTPS** - All platforms provide free SSL
3. ✅ **Restrict access** - Consider adding authentication if metrics contain sensitive data
4. ✅ **Rotate keys** - Periodically update your EcoFlow API credentials
5. ✅ **Monitor logs** - Check for unauthorized access attempts

## Monitoring the Monitor

Set up alerts for your monitoring service:

```yaml
# Example Prometheus alert rule
groups:
  - name: ecoflow
    rules:
      - alert: EcoFlowMonitorDown
        expr: up{job="ecoflow-cloud"} == 0
        for: 5m
        annotations:
          summary: "EcoFlow monitor is down"
```

## Next Steps

- Configure Grafana dashboards
- Set up alerting rules
- Add more devices to your EcoFlow account
- Customize collection intervals
- Export historical data
