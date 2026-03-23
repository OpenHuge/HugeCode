FROM mcr.microsoft.com/devcontainers/base:bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    clang \
    libayatana-appindicator3-dev \
    libdbus-1-dev \
    libglib2.0-dev \
    librsvg2-dev \
    libgtk-3-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    patchelf \
    pkg-config \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*
