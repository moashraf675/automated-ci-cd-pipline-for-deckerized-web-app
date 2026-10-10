#!/bin/sh

set -eu

image_ref=${1:?Usage: deploy-remote.sh <image-reference>}
state_dir="$HOME/.cipp-deploy"
release_file="$state_dir/deployed-release.txt"

mkdir -p "$state_dir"
chmod 700 "$state_dir"

previous_image=
if docker container inspect cipp >/dev/null 2>&1; then
  running=$(docker inspect --format '{{.State.Running}}' cipp)
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' cipp)
  if [ "$running" = true ] && {
    [ "$health" = healthy ] ||
    {
      [ "$health" = none ] &&
      docker exec cipp node -e "fetch('http://127.0.0.1:3000/health').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
    }
  }; then
    previous_image=$(docker inspect --format '{{.Config.Image}}' cipp)
  fi
fi

if [ -z "$previous_image" ] && [ -f "$release_file" ]; then
  IFS= read -r previous_image < "$release_file" || true
fi

write_release() {
  tmp_file="$release_file.tmp.$$"
  if ! printf '%s\n%s\n' "$1" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$tmp_file"; then
    rm -f "$tmp_file"
    return 1
  fi
  if ! mv "$tmp_file" "$release_file"; then
    rm -f "$tmp_file"
    return 1
  fi
}

wait_until_healthy() {
  attempt=1
  while [ "$attempt" -le 30 ]; do
    if ! docker container inspect cipp >/dev/null 2>&1; then
      echo "Container cipp disappeared during health check." >&2
      return 1
    fi

    running=$(docker inspect --format '{{.State.Running}}' cipp)
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' cipp)
    if [ "$running" != true ] || [ "$health" = unhealthy ]; then
      echo "Container failed health check (running=$running, health=$health)." >&2
      docker logs --tail 100 cipp >&2 2>&1 || true
      return 1
    fi
    if [ "$health" = healthy ] || {
      [ "$health" = none ] &&
      docker exec cipp node -e "fetch('http://127.0.0.1:3000/health').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
    }; then
      return 0
    fi

    sleep 2
    attempt=$((attempt + 1))
  done

  echo "Container did not become healthy within 60 seconds." >&2
  docker logs --tail 100 cipp >&2 2>&1 || true
  return 1
}

rollback() {
  echo "Deployment failed; attempting rollback to ${previous_image:-no recorded healthy release}." >&2
  if docker container inspect cipp >/dev/null 2>&1; then
    docker logs --tail 100 cipp >&2 2>&1 || true
    docker rm -f cipp >/dev/null 2>&1 || true
  fi

  if [ -z "$previous_image" ]; then
    echo "Rollback unavailable: no previous healthy release is recorded." >&2
    exit 1
  fi

  if ! docker image inspect "$previous_image" >/dev/null 2>&1; then
    if ! docker pull "$previous_image"; then
      echo "Rollback failed: could not retrieve $previous_image." >&2
      exit 1
    fi
  fi

  if ! docker run -d --name cipp --restart unless-stopped -p 80:3000 "$previous_image"; then
    echo "Rollback failed: could not start $previous_image." >&2
    exit 1
  fi
  if ! wait_until_healthy; then
    echo "Rollback failed: $previous_image did not become healthy." >&2
    exit 1
  fi

  if ! write_release "$previous_image"; then
    echo "Warning: could not update the persisted release record after rollback." >&2
  fi
  echo "Rollback succeeded; restored $previous_image." >&2
  exit 1
}

echo "Pulling release $image_ref."
docker pull "$image_ref"

if docker container inspect cipp >/dev/null 2>&1; then
  docker rm -f cipp
fi

if ! docker run -d --name cipp --restart unless-stopped -p 80:3000 "$image_ref"; then
  echo "Failed to start candidate release $image_ref." >&2
  rollback
fi

if ! wait_until_healthy; then
  rollback
fi

if ! write_release "$image_ref"; then
  echo "Could not persist the healthy release record." >&2
  rollback
fi

echo "Deployment succeeded; healthy release $image_ref is recorded in $release_file."
