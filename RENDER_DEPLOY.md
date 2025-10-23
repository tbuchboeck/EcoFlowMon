# Quick Render Deployment (Mobile-Friendly)

## Option 1: Blueprint (Automatic - Recommended)

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **New** → **Blueprint**
3. Connect your GitHub account if not connected
4. Select repository: `EcoFlowMon`
5. Render detects `render.yaml` automatically
6. Click **Apply**
7. Go to the created service → **Environment**
8. Click **Add Environment Variable** (do this twice):
   - `ECOFLOW_ACCESS_KEY` = your access key
   - `ECOFLOW_SECRET_KEY` = your secret key
9. Click **Manual Deploy** → **Deploy latest commit**
10. Wait 2-3 minutes for deployment
11. Your metrics URL will be shown (e.g., `https://ecoflowmon.onrender.com`)

## Option 2: Manual Web Service

If Blueprint doesn't work, create manually:

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **New** → **Web Service** ⚠️ (Important: NOT "Static Site"!)
3. Connect GitHub repository: `EcoFlowMon`
4. Configure:
   - **Name**: `ecoflowmon`
   - **Environment**: `Docker`
   - **Region**: Choose closest to you
   - **Branch**: `main` or your claude branch
   - **Plan**: `Free`
5. Click **Advanced** and add **Environment Variables**:
   - `ECOFLOW_ACCESS_KEY` = your access key
   - `ECOFLOW_SECRET_KEY` = your secret key
   - `COLLECTION_INTERVAL` = `60`
   - `METRICS_PORT` = `9090`
6. Click **Create Web Service**
7. Wait for deployment (2-3 minutes)

## Verify It's Working

After deployment, check these URLs (replace with your actual URL):

- **Homepage**: `https://ecoflowmon.onrender.com/`
  - Should show JSON with app info
- **Health**: `https://ecoflowmon.onrender.com/health`
  - Should return `OK`
- **Metrics**: `https://ecoflowmon.onrender.com/metrics`
  - Should show Prometheus metrics

## Troubleshooting

### "Service is not responding"
- Check logs in Render dashboard
- Verify environment variables are set correctly
- Make sure you selected "Web Service" not "Static Site"

### "Build failed"
- Check the Dockerfile exists in your repository
- Verify you're deploying from the correct branch

### "No metrics showing"
- Wait 60 seconds after deployment (first collection interval)
- Check logs for API errors
- Verify EcoFlow credentials are correct

## Connect to Prometheus/Grafana

Once deployed, add to your Prometheus config:

```yaml
scrape_configs:
  - job_name: 'ecoflow-cloud'
    scheme: https
    static_configs:
      - targets: ['ecoflowmon.onrender.com']
    metrics_path: /metrics
```

## Important Notes

- ⏰ Free tier: Service may sleep after 15 min of inactivity
- 🔄 First request after sleep takes ~30 seconds to wake up
- 💰 Free tier includes 750 hours/month (enough for 24/7 operation)
- 🔒 HTTPS is automatic and free
- 📊 Logs available in Render dashboard

## Alternative: Use Render Shell

From Render dashboard, you can also:
1. Go to your service
2. Click **Shell** tab
3. Run: `curl http://localhost:9090/health`
4. Verify the service is running internally
