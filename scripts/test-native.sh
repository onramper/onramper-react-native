#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/onramper-native-tests.XXXXXX")"
trap 'rm -rf "$test_dir"' EXIT
xcrun swiftc -swift-version 5 -module-cache-path "$test_dir/ModuleCache" \
  "$repo_root/ios/PreparedIntentRegistry.swift" \
  "$repo_root/tests-native/PreparedIntentLifecycleTests.swift" \
  -o "$test_dir/native-tests"
"$test_dir/native-tests"
