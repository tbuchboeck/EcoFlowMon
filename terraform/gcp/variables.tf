variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-east1"
}

variable "zone" {
  description = "GCP zone for VM instance"
  type        = string
  default     = "us-east1-b"
}

variable "ecoflow_access_key" {
  description = "EcoFlow API Access Key"
  type        = string
  sensitive   = true
}

variable "ecoflow_secret_key" {
  description = "EcoFlow API Secret Key"
  type        = string
  sensitive   = true
}

variable "grafana_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
}
