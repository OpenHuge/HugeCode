FROM mcr.microsoft.com/devcontainers/base:bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    clang \
    fakeroot \
    libayatana-appindicator3-dev \
    libdbus-1-dev \
    libevent-2.1-7 \
    libgstreamer-plugins-bad1.0-0 \
    libglib2.0-dev \
    librsvg2-dev \
    libgtk-3-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    libx264-164 \
    patchelf \
    pkg-config \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*
