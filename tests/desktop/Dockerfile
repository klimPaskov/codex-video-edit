FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb x11vnc openbox x11-apps x11-utils dbus-x11 ffmpeg \
    ca-certificates git python3 python3-venv python3-jsonschema \
    libgtk-3-0 libnss3 libasound2 libgbm1 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=755 start-desktop.sh /usr/local/bin/start-desktop
USER node
WORKDIR /home/node
ENV DISPLAY=:99
ENTRYPOINT ["/usr/local/bin/start-desktop"]
