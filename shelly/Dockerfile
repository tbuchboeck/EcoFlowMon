FROM python:3.12-slim
WORKDIR /app
COPY exporter.py .
ENV METRICS_PORT=9092 SCRAPE_INTERVAL=60
CMD ["python", "exporter.py"]
