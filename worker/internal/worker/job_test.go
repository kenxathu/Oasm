package worker

import (
	"context"
	"testing"
	"time"

	"github.com/oasm-platform/open-asm/grpc-client/go/jobs_registry"
)

func TestIsEmptyOutputSuccessCommand(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		command string
		want    bool
	}{
		{
			name:    "nuclei command",
			command: `sh -lc 'exec nuclei -duc -u "example.com" -j --silent'`,
			want:    true,
		},
		{
			name:    "non nuclei command",
			command: "naabu -host example.com -silent",
			want:    false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := isEmptyOutputSuccessCommand(tt.command); got != tt.want {
				t.Fatalf("isEmptyOutputSuccessCommand() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPingPreflightSkipsPrivateIPScanWhenHostDoesNotRespond(t *testing.T) {
	t.Parallel()

	called := false
	payload, shouldRun := pingPreflightPayload(
		context.Background(),
		&jobs_registry.Job{
			Id:      "job-1",
			Command: strPtr("naabu -host 10.0.0.42 -silent"),
			Asset:   &jobs_registry.Asset{Value: "10.0.0.42"},
		},
		func(context.Context, string) (time.Duration, bool, error) {
			called = true
			return 0, false, nil
		},
	)

	if !called {
		t.Fatal("expected ping probe to be called for private IP scan")
	}
	if shouldRun {
		t.Fatal("expected scan command to be skipped for an unreachable private IP")
	}
	if payload == nil || payload.GetError() {
		t.Fatalf("expected a successful empty payload, got %#v", payload)
	}
	if payload.GetRaw() != "" {
		t.Fatalf("expected empty raw output for skipped scan, got %q", payload.GetRaw())
	}
}

func TestPingPreflightAllowsPrivateIPScanWhenHostResponds(t *testing.T) {
	t.Parallel()

	payload, shouldRun := pingPreflightPayload(
		context.Background(),
		&jobs_registry.Job{
			Id:      "job-1",
			Command: strPtr("nuclei -u 10.0.0.42 -j --silent"),
			Asset:   &jobs_registry.Asset{Value: "10.0.0.42"},
		},
		func(context.Context, string) (time.Duration, bool, error) {
			return 15 * time.Millisecond, true, nil
		},
	)

	if !shouldRun {
		t.Fatal("expected scan command to run for a reachable private IP")
	}
	if payload != nil {
		t.Fatalf("expected no preflight payload for reachable host, got %#v", payload)
	}
}

func TestPingPreflightDoesNotPingPublicTargets(t *testing.T) {
	t.Parallel()

	payload, shouldRun := pingPreflightPayload(
		context.Background(),
		&jobs_registry.Job{
			Id:      "job-1",
			Command: strPtr("naabu -host 8.8.8.8 -silent"),
			Asset:   &jobs_registry.Asset{Value: "8.8.8.8"},
		},
		func(context.Context, string) (time.Duration, bool, error) {
			t.Fatal("did not expect ping probe for public targets")
			return 0, false, nil
		},
	)

	if !shouldRun {
		t.Fatal("expected public target scans to keep existing behavior")
	}
	if payload != nil {
		t.Fatalf("expected no preflight payload for public target, got %#v", payload)
	}
}

func strPtr(value string) *string {
	return &value
}
