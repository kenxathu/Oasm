package config

import (
	"fmt"
	"strings"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

const (
	MinWorkerInstances = 1
	MaxWorkerInstances = 10
)

type Config struct {
	ApiKey            string `mapstructure:"api_key"`
	MaxConcurrency    int    `mapstructure:"max_concurrency"`
<<<<<<< HEAD
=======
	Instances         int    `mapstructure:"instances"`
>>>>>>> main
	GrpcHost          string `mapstructure:"grpc_host"`
	GrpcPort          int    `mapstructure:"grpc_port"`
	ToolPath          string `mapstructure:"tool_path"`
	Network           string `mapstructure:"network"`
	WorkspaceRoot     string `mapstructure:"workspace_root"`
	JobTimeoutSeconds int    `mapstructure:"job_timeout_seconds"`
}

func LoadConfig() (*Config, error) {
	_ = godotenv.Load(".env")

	viper.SetEnvPrefix("WORKER")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	viper.SetDefault("api_key", "")
	viper.SetDefault("network", "")
	viper.SetDefault("max_concurrency", 10)
	viper.SetDefault("instances", MinWorkerInstances)
	viper.SetDefault("grpc_host", "localhost")
	viper.SetDefault("grpc_port", 16276)
	viper.SetDefault("tool_path", "oasm-tools")
	viper.SetDefault("workspace_root", "agent-sessions")
	viper.SetDefault("job_timeout_seconds", 300)

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	if cfg.Instances < MinWorkerInstances || cfg.Instances > MaxWorkerInstances {
		return nil, fmt.Errorf(
			"worker instances must be between %d and %d",
			MinWorkerInstances,
			MaxWorkerInstances,
		)
	}

	return &cfg, nil
}
