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

	return &pb.GetSiteConfigResponse{
		Filename:   baseName,
		Content:    string(content),
		FormatType: "nginx-conf",
	}, nil
}

// Fail2Ban Implementation (Mocks for MVP)
func (s *server) GetFail2BanBans(ctx context.Context, in *pb.GetBansRequest) (*pb.GetBansResponse, error) {
	bans := []*pb.BanEntry{
		{Ip: "45.33.32.156", Jail: "nginx-http-auth", BannedAt: "2026-04-06T12:00:00Z", BanTime: 3600, Reason: "Too many 401s"},
		{Ip: "103.21.244.0", Jail: "fail2ban-nginx-limit", BannedAt: "2026-04-06T11:00:00Z", BanTime: 86400, Reason: "Rate limit exceeded"},
	}
	return &pb.GetBansResponse{Bans: bans}, nil
}

func (s *server) BanIP(ctx context.Context, in *pb.BanIPRequest) (*pb.ActionResponse, error) {
	log.Printf("Banning IP: %s (Reason: %s)", in.Ip, in.Reason)
	return &pb.ActionResponse{Success: true, Message: fmt.Sprintf("IP %s banned successfully", in.Ip)}, nil
}

func (s *server) UnbanIP(ctx context.Context, in *pb.UnbanIPRequest) (*pb.ActionResponse, error) {
	log.Printf("Unbanning IP: %s", in.Ip)
	return &pb.ActionResponse{Success: true, Message: fmt.Sprintf("IP %s unbanned successfully", in.Ip)}, nil
}

func (s *server) GetFail2BanJails(ctx context.Context, in *pb.GetJailsRequest) (*pb.GetJailsResponse, error) {
	jails := []*pb.JailInfo{
		{Name: "nginx-http-auth", Enabled: true, Maxretry: 5, Bantime: 3600, CurrentlyBanned: 12},
		{Name: "nginx-botsearch", Enabled: true, Maxretry: 2, Bantime: 86400, CurrentlyBanned: 4},
		{Name: "sshd", Enabled: true, Maxretry: 3, Bantime: 3600, CurrentlyBanned: 7},
	}
	return &pb.GetJailsResponse{Jails: jails}, nil
}

// Logs Streaming (Simulation)
func (s *server) StreamLogs(in *pb.StreamLogsRequest, stream pb.AgentService_StreamLogsServer) error {
	log.Printf("Starting log stream for: %s", in.Source)
	// In a real implementation, we would tail files. 
	// For MVP, we send one initial log and keep the connection open or send a few.
	entry := &pb.LogEntry{
		Timestamp: "2026-04-06T13:00:00Z",
		Source:    in.Source,
		Level:     "INFO",
		Message:   "Log stream initialized for " + in.Source,
	}
	if err := stream.Send(entry); err != nil {
		return err
	}
	return nil
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
