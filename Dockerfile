FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --create-home --uid 10001 aniloop && mkdir -p /app/.runtime /app/.tools && chown -R aniloop:aniloop /app
USER aniloop
ENV HOST=0.0.0.0 PORT=8097 ANILOOP_DB=/app/.runtime/community.sqlite3
EXPOSE 8097
VOLUME ["/app/.runtime", "/app/.tools"]
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8097/api/health',timeout=3)" || exit 1
CMD ["python3", "server.py", "--host", "0.0.0.0", "--port", "8097"]
