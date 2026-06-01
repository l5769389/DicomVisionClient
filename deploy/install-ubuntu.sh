#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root or with sudo: sudo bash deploy/install-ubuntu.sh" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git ufw

install -m 0755 -d /etc/apt/keyrings
if curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc; then
  chmod a+r /etc/apt/keyrings/docker.asc

  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "Docker official repository is not reachable; falling back to Ubuntu packages." >&2
  rm -f /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.asc
  apt-get update
  apt-get install -y docker.io docker-compose-v2
fi

systemctl enable --now docker

ufw allow OpenSSH
ufw allow 80/tcp
ufw --force enable

if ! grep -q '^vm\.swappiness' /etc/sysctl.conf; then
  echo 'vm.swappiness=20' >> /etc/sysctl.conf
fi

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

sysctl -p || true

echo "Docker, Compose, firewall and 2G swap are ready."
