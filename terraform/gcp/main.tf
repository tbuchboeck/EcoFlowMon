terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# e2-micro VM instance (Always Free eligible)
resource "google_compute_instance" "ecoflowmon" {
  name         = "ecoflowmon"
  machine_type = "e2-micro"
  zone         = var.zone

  tags = ["http-server", "https-server", "ecoflowmon"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"  # Ubuntu 22.04 LTS
      size  = 30  # 30GB - Always Free eligible
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {
      # Ephemeral external IP
    }
  }

  metadata = {
    google-logging-enabled = "true"
    user-data              = file("${path.module}/cloud-init.yaml")
    ecoflow_access_key     = var.ecoflow_access_key
    ecoflow_secret_key     = var.ecoflow_secret_key
    grafana_password       = var.grafana_password
  }

  service_account {
    email  = google_service_account.ecoflowmon.email
    scopes = ["cloud-platform"]
  }

  # Allow stopping for maintenance
  allow_stopping_for_update = true

  lifecycle {
    ignore_changes = [
      metadata["ssh-keys"],
    ]
  }
}

# Service account for the VM
resource "google_service_account" "ecoflowmon" {
  account_id   = "ecoflowmon-sa"
  display_name = "EcoFlowMon Service Account"
}

# Firewall rule for HTTP
resource "google_compute_firewall" "http" {
  name    = "ecoflowmon-allow-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server"]
}

# Firewall rule for HTTPS
resource "google_compute_firewall" "https" {
  name    = "ecoflowmon-allow-https"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["https-server"]
}

# Firewall rule for Grafana (port 3000)
resource "google_compute_firewall" "grafana" {
  name    = "ecoflowmon-allow-grafana"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["3000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ecoflowmon"]
}

# Output the external IP
output "external_ip" {
  value       = google_compute_instance.ecoflowmon.network_interface[0].access_config[0].nat_ip
  description = "External IP address of the EcoFlowMon instance"
}

output "instance_name" {
  value       = google_compute_instance.ecoflowmon.name
  description = "Name of the EcoFlowMon instance"
}

output "grafana_url" {
  value       = "http://${google_compute_instance.ecoflowmon.network_interface[0].access_config[0].nat_ip}:3000"
  description = "Grafana dashboard URL"
}
