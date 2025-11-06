# 🚀 Fly.io Deployment Guide - EcoFlowMon

Dieser Guide führt dich durch die Migration von Render.com zu Fly.io mit **persistenter Speicherung**.

## Warum Fly.io?

✅ **Komplett kostenlos** (Free Tier)
✅ **3GB persistente Speicherung** (Daten überleben Deployments!)
✅ **Kein Auto-Pause** (VM läuft 24/7)
✅ **Bessere Performance**

---

## Schritt 1: Fly.io Account erstellen

1. Gehe zu: https://fly.io/app/sign-up
2. Registriere dich mit GitHub oder Email
3. **Keine Kreditkarte nötig** für Free Tier!

---

## Schritt 2: Fly CLI installieren

### Auf Linux/Mac:
```bash
curl -L https://fly.io/install.sh | sh
```

### Auf Windows:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Verifizieren:
```bash
fly version
```

---

## Schritt 3: Bei Fly.io einloggen

```bash
fly auth login
```

Dies öffnet deinen Browser für die Authentifizierung.

---

## Schritt 4: App erstellen (einmalig)

Im EcoFlowMon-Verzeichnis:

```bash
cd /pfad/zu/EcoFlowMon

# App erstellen (nutzt fly.toml)
fly apps create ecoflowmon --org personal
```

**Wichtig:** Der Name `ecoflowmon` muss **global unique** sein auf Fly.io.
Falls schon vergeben, wähle einen anderen Namen wie:
- `ecoflowmon-yourname`
- `ecoflowmon-123`

Dann passe in `fly.toml` Zeile 3 an: `app = "dein-gewählter-name"`

---

## Schritt 5: Secrets setzen

Deine EcoFlow API Keys und Grafana Passwort als Secrets speichern:

```bash
# EcoFlow API Credentials
fly secrets set ECOFLOW_ACCESS_KEY="dein-access-key"
fly secrets set ECOFLOW_SECRET_KEY="dein-secret-key"

# Grafana Admin Password
fly secrets set GF_SECURITY_ADMIN_PASSWORD="dein-sicheres-passwort"
```

---

## Schritt 6: Persistent Volume erstellen

```bash
# 3GB Volume für Prometheus Daten (kostenlos im Free Tier!)
fly volumes create prometheus_data --region fra --size 3
```

**Region:** `fra` = Frankfurt (Deutschland)

**Größe:** 3GB ist kostenlos, reicht für Monate/Jahre an Metriken!

---

## Schritt 7: Deployen! 🚀

```bash
fly deploy
```

Dies wird:
1. Docker Image bauen
2. Zu Fly.io hochladen
3. VM mit persistent volume starten
4. Deine App deployen

**Dauer:** ~3-5 Minuten beim ersten Mal

---

## Schritt 8: Verifizieren

### App URL anzeigen:
```bash
fly status
```

Deine App läuft unter: `https://ecoflowmon.fly.dev`
(oder deinem gewählten Namen)

### Logs ansehen:
```bash
fly logs
```

### Dashboard öffnen:
```bash
fly open
```

Dies öffnet deine Grafana-Dashboard im Browser!

**Login:** 
- Username: `admin`
- Password: (was du in Schritt 5 gesetzt hast)

---

## Schritt 9: Monitoring (optional)

### SSH in die VM:
```bash
fly ssh console
```

### Prometheus Daten prüfen:
```bash
fly ssh console
ls -lh /prometheus/data
```

Du solltest deine persistente Datenbank sehen!

---

## Wichtige Befehle

```bash
# Status prüfen
fly status

# Logs live ansehen
fly logs

# VM neustarten
fly machine restart

# Secrets auflisten
fly secrets list

# App löschen (falls nötig)
fly apps destroy ecoflowmon
```

---

## Nach dem Deployment

✅ **Deine Daten sind jetzt persistent!**
- Bei jedem `fly deploy` bleiben die Prometheus-Daten erhalten
- Historie geht nicht mehr verloren
- 30 Tage (oder mehr) Historie immer verfügbar

✅ **VM läuft 24/7**
- Kein Auto-Pause
- Kontinuierliche Datensammlung
- Kein UptimeRobot mehr nötig

✅ **Kostenlos**
- Free Tier: 3 VMs mit je 256MB RAM
- 3GB persistente Speicherung
- 160GB Traffic/Monat

---

## Troubleshooting

### "App name already taken"
→ Wähle einen anderen Namen in `fly.toml` Zeile 3

### "Volume not found"
→ Stelle sicher, dass du Schritt 6 gemacht hast: `fly volumes create`

### "Out of memory"
→ Free Tier hat 256MB RAM. Das sollte reichen, aber check Logs: `fly logs`

### "Deployment failed"
→ Check Logs: `fly logs`
→ Verify Dockerfile builds: `docker build -t test .`

---

## Support

- Fly.io Docs: https://fly.io/docs
- Fly.io Community: https://community.fly.io
- Dein Claude Code Assistant: Frag einfach! 😊

---

**Viel Erfolg! 🚀**

Nach dem Deployment hast du ein vollständiges, kostenloses Monitoring-System mit persistenter Speicherung!
