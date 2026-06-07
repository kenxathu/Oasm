package config

import (
	"strings"
	"testing"

	"github.com/spf13/viper"
)

func resetConfigTest(t *testing.T) {
	t.Helper()
	viper.Reset()
	t.Setenv("WORKER_API_KEY", "")
	t.Setenv("WORKER_MAX_CONCURRENCY", "")
	t.Setenv("WORKER_INSTANCES", "")
	t.Setenv("WORKER_GRPC_HOST", "")
	t.Setenv("WORKER_GRPC_PORT", "")
	t.Setenv("WORKER_TOOL_PATH", "")
	t.Setenv("WORKER_NETWORK", "")
	t.Setenv("WORKER_WORKSPACE_ROOT", "")
	t.Setenv("WORKER_JOB_TIMEOUT_SECONDS", "")
}

func TestLoadConfigDefaultsToOneWorkerInstance(t *testing.T) {
	resetConfigTest(t)

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig returned error: %v", err)
	}

	if cfg.Instances != MinWorkerInstances {
		t.Fatalf("expected %d worker instance, got %d", MinWorkerInstances, cfg.Instances)
	}
}

func TestLoadConfigAcceptsMaximumWorkerInstances(t *testing.T) {
	resetConfigTest(t)
	t.Setenv("WORKER_INSTANCES", "10")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig returned error: %v", err)
	}

	if cfg.Instances != MaxWorkerInstances {
		t.Fatalf("expected %d worker instances, got %d", MaxWorkerInstances, cfg.Instances)
	}
}

func TestLoadConfigRejectsWorkerInstancesBelowMinimum(t *testing.T) {
	resetConfigTest(t)
	t.Setenv("WORKER_INSTANCES", "0")

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("expected LoadConfig to reject worker instances below minimum")
	}

	if !strings.Contains(err.Error(), "worker instances must be between 1 and 10") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadConfigRejectsWorkerInstancesAboveMaximum(t *testing.T) {
	resetConfigTest(t)
	t.Setenv("WORKER_INSTANCES", "11")

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("expected LoadConfig to reject worker instances above maximum")
	}

	if !strings.Contains(err.Error(), "worker instances must be between 1 and 10") {
		t.Fatalf("unexpected error: %v", err)
	}
}
