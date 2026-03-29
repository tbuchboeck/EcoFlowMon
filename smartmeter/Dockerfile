FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY exporter.py .

ENV NETZOOE_USERNAME=""
ENV NETZOOE_PASSWORD=""
ENV METRICS_PORT=9091
ENV SCRAPE_INTERVAL=21600
ENV DAILY_PROFILE_DAYS=30
ENV LOG_LEVEL=INFO

CMD ["python", "exporter.py"]
