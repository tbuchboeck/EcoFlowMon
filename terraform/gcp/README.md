# GCP Deployment - Always Free Tier

Deploy EcoFlowMon to Google Cloud Platform using the **Always Free Tier** (e2-micro VM).

## Cost Estimate

- **VM (e2-micro):** $0/month (Always Free)
- **Storage (30GB):** $0/month (Always Free)
- **Egress Traffic:** 1GB/month free, then $0.12/GB
- **Expected Total:** $0-2/month

## Prerequisites

1. **GCP Account**
   - Sign up at https://cloud.google.com/free
   - $300 credit for 90 days + Always Free tier
   - Credit card required (but won't be charged within free tier limits)

2. **Create GCP Project**
   ```bash
   # Install gcloud CLI
   # macOS: brew install google-cloud-sdk
   # Linux: https://cloud.google.com/sdk/docs/install

   # Login and create project
   gcloud auth login
   gcloud projects create ecoflowmon-PROJECT_ID --name="EcoFlowMon"
   gcloud config set project ecoflowmon-PROJECT_ID

   # Enable required APIs
   gcloud services enable compute.googleapis.com
   gcloud services enable cloudresourcemanager.googleapis.com
   ```

3. **Install Terraform**
   ```bash
   # macOS
   brew install terraform

   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

## Setup Instructions

### 1. Configure Terraform Variables

```bash
cd terraform/gcp
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:
- `project_id`: Your GCP project ID
- `ecoflow_access_key`: Your EcoFlow API access key
- `ecoflow_secret_key`: Your EcoFlow API secret key
- `grafana_password`: Choose a secure password for Grafana

### 2. Initialize and Deploy

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy infrastructure
terraform apply
```

This will:
- Create an e2-micro VM in **us-east1** (South Carolina - closest to Europe)
- Configure firewall rules for ports 80, 443, 3000
- Install Docker and Docker Compose
- Clone the repository
- Start Prometheus, Grafana, and EcoFlow Collector

**Deployment takes ~5-10 minutes.**

### 3. Access Grafana

After deployment completes, Terraform will output:

```
Outputs:

external_ip = "X.X.X.X"
grafana_url = "http://X.X.X.X:3000"
```

Access Grafana at the provided URL:
- Username: `admin`
- Password: (the one you set in terraform.tfvars)

## Post-Deployment

### SSH into VM

```bash
# Get instance details
terraform output

# SSH into the instance
gcloud compute ssh ecoflowmon --zone=us-east1-b

# Check services
docker ps
docker-compose -f /opt/ecoflowmon/docker-compose.gcp.yml logs -f
```

### Update Application

```bash
# SSH into VM
gcloud compute ssh ecoflowmon --zone=us-east1-b

# Run update script
sudo /opt/ecoflowmon/update.sh
```

Or use the GitHub Actions workflow (see below).

### Monitor Costs

```bash
# Check current costs
gcloud billing projects describe ecoflowmon-PROJECT_ID --format=json

# Set up budget alerts (recommended!)
# Go to: https://console.cloud.google.com/billing/budgets
```

## GitHub Actions CI/CD

To enable automatic deployments on push to main:

### 1. Create GCP Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deployer"

# Grant necessary permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/compute.instanceAdmin.v1"

# Create and download key
gcloud iam service-accounts keys create key.json \
    --iam-account=github-actions@PROJECT_ID.iam.gserviceaccount.com

# Base64 encode the key (for GitHub Secret)
cat key.json | base64 -w 0  # Linux
cat key.json | base64        # macOS
```

### 2. Add GitHub Secrets

Go to: `https://github.com/tbuchboeck/EcoFlowMon/settings/secrets/actions`

Add these secrets:
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: The base64-encoded service account key
- `GCP_INSTANCE_NAME`: `ecoflowmon`
- `GCP_ZONE`: `us-east1-b`

### 3. Workflow is Ready!

The GitHub Actions workflow in `.github/workflows/gcp-deploy.yml` will:
- Build Docker image on every push to main
- SSH into your GCP VM
- Pull latest code
- Restart services

## Troubleshooting

### Check VM Status

```bash
gcloud compute instances list
gcloud compute instances describe ecoflowmon --zone=us-east1-b
```

### View Logs

```bash
# SSH into VM
gcloud compute ssh ecoflowmon --zone=us-east1-b

# View container logs
cd /opt/ecoflowmon
docker-compose -f docker-compose.gcp.yml logs -f

# View startup logs
sudo journalctl -u google-startup-scripts.service
```

### Restart Services

```bash
gcloud compute ssh ecoflowmon --zone=us-east1-b
cd /opt/ecoflowmon
docker-compose -f docker-compose.gcp.yml restart
```

### Common Issues

1. **Port 3000 not accessible**
   - Check firewall: `gcloud compute firewall-rules list`
   - Ensure VM is running: `gcloud compute instances list`

2. **Out of memory**
   - e2-micro has 1GB RAM
   - Check: `docker stats`
   - May need to add swap (will slow down but prevent crashes)

3. **Exceeded free tier**
   - Monitor: https://console.cloud.google.com/billing
   - Set up budget alerts!

## Cleanup / Destroy

To remove all resources:

```bash
cd terraform/gcp
terraform destroy
```

This will delete the VM and all associated resources.

## Cost Optimization Tips

1. **Stop VM when not needed**
   ```bash
   gcloud compute instances stop ecoflowmon --zone=us-east1-b
   ```
   Note: You still pay for storage (~$0.60/month for 30GB)

2. **Schedule auto-shutdown**
   - Use Cloud Scheduler to stop VM at night
   - ~50% cost savings if running 12h/day

3. **Monitor traffic**
   - First 1GB/month egress is free
   - After that: $0.12/GB
   - Access Grafana sparingly or use VPN

## Support

- GCP Always Free: https://cloud.google.com/free/docs/free-cloud-features
- Terraform GCP Provider: https://registry.terraform.io/providers/hashicorp/google/latest/docs
- Issues: https://github.com/tbuchboeck/EcoFlowMon/issues
