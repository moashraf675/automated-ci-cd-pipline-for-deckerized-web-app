#!/bin/sh

set -eu

ec2_user=${1:?Usage: deploy-via-ssh.sh <user> <host> <image-reference>}
ec2_host=${2:?Usage: deploy-via-ssh.sh <user> <host> <image-reference>}
image_ref=${3:?Usage: deploy-via-ssh.sh <user> <host> <image-reference>}

case "$image_ref" in
  ""|*[!a-zA-Z0-9/._:-]*)
    echo "Invalid Docker image reference." >&2
    exit 2
    ;;
esac

if ! ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=10 \
  -o ServerAliveCountMax=3 \
  -l "$ec2_user" "$ec2_host" "sh -s -- '$image_ref'" \
  < scripts/deploy-remote.sh; then
  echo "::error::SSH deployment to $ec2_host failed. Check EC2_HOST, EC2_USER, EC2_SSH_KEY, network reachability, and SSH ingress rules." >&2
  exit 1
fi
