#!/usr/bin/env bash
set -euo pipefail
repo_example="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/onramper-log-tests.XXXXXX")"
trap 'rm -rf "$test_dir"' EXIT
xcrun swiftc -swift-version 5 -module-cache-path "$test_dir/ModuleCache" \
  "$repo_example/ios/OnramperRNDemo/DemoDailyLogStore.swift" \
  "$repo_example/tests-native/DemoDailyLogStoreTests.swift" \
  -o "$test_dir/log-tests"
"$test_dir/log-tests"
