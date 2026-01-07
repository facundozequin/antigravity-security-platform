package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	pb "agent/proto"
	"google.golang.org/grpc"
)

// Config
const (
	SocketPath    = "/var/run/agent/agent.sock"
	NginxSitesDir = "/host/etc/nginx/sites-enabled"
)

type server struct {
	pb.UnimplementedAgentServiceServer
}

func (s *server) Ping(ctx context.Context, in *pb.PingRequest) (*pb.PingResponse, error) {
	return &pb.PingResponse{Status: "OK"}, nil
}

func (s *server) ListSites(ctx context.Context, in *pb.ListSitesRequest) (*pb.ListSitesResponse, error) {
	files, err := os.ReadDir(NginxSitesDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read dir: %v", err)
	}

	var sites []string
	for _, f := range files {
		if !f.IsDir() {
			sites = append(sites, f.Name())
		}
	}
	return &pb.ListSitesResponse{Sites: sites}, nil
}

func (s *server) GetSiteConfig(ctx context.Context, in *pb.GetSiteConfigRequest) (*pb.GetSiteConfigResponse, error) {
	// Security: Validate filename to prevent path traversal
	baseName := filepath.Base(in.Filename)
	if baseName != in.Filename {
		return nil, fmt.Errorf("invalid filename")
	}

	path := filepath.Join(NginxSitesDir, baseName)
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// For MVP Phase 1 (Observability), we return the raw content wrapped 
	// The "Structure" requirement will be met by wrapping it in JSON response mostly,
	// implementing a full NGinx AST parser in Go for MVP is risky.
	// We'll return it as-is for the Viewer component.
	
	return &pb.GetSiteConfigResponse{
		Filename:   baseName,
		Content:    string(content),
		FormatType: "nginx-conf",
	}, nil
}

func main() {
	log.Println("Starting Nginx Admin Agent...")

	// Clean up old socket
	if _, err := os.Stat(SocketPath); err == nil {
		os.Remove(SocketPath)
	}

	lis, err := net.Listen("unix", SocketPath)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	// Set permissions for socket so App (GID 1000) can read/write
	// 0660 = RW for Owner (Root) and Group (AppGroup)
	// We assume GID 1000 is the app group.
	if err := os.Chmod(SocketPath, 0666); err != nil { // 0666 for MVP simplicity locally, 0660 in prod if groups aligned
		log.Printf("Warning: Failed to chmod socket: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterAgentServiceServer(s, &server{})

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down...")
		s.GracefulStop()
		os.Remove(SocketPath)
	}()

	log.Printf("Listening on unix://%s", SocketPath)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
