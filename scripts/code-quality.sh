#!/usr/bin/env bash
# Code quality checks - runs format, lint, and type checks with minimal output
# Only shows errors/warnings and non-zero exit codes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

run_quiet() {
    local name="$1"
    shift
    local output
    local exit_code

    output=$("$@" 2>&1) && exit_code=0 || exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo -e "${RED}FAIL${NC} $name (exit $exit_code)"
        # Show output on failure
        echo "$output" | grep -E "(error|warning|Error|Warning|failed|FAIL)" || echo "$output"
        return $exit_code
    fi

    # Check for warnings in successful output
    local warnings
    warnings=$(echo "$output" | grep -E "(warning|Warning)" | head -5 || true)
    if [ -n "$warnings" ]; then
        echo -e "${GREEN}PASS${NC} $name (with warnings)"
        echo "$warnings"
    fi

    return 0
}

echo "Running code quality checks..."

# Biome check (format + lint)
run_quiet "biome" bun biome check ./src

# Lint + type check
run_quiet "lint" bun run lint

# Build
run_quiet "build" bun run build

# Tests. This gate used to stop at `build`, which is why #84 pushed a branch
# whose `codecov/patch` failed on lines nothing exercised — everything green
# locally, red in CI. Note what this does and does not catch: it fails on a
# broken test, and it writes `coverage/` so the uncovered lines are there to
# read, but it does NOT reproduce Codecov's 85% *patch* target, which scores
# only lines the diff touched. A mid-branch commit legitimately has uncovered
# lines a later commit covers, so a diff-scoped gate does not belong in a
# pre-commit hook.
run_quiet "test" bun run test:coverage

echo -e "${GREEN}All checks passed${NC}"
