import grpc
import os
import sys

# Import generated code. 
# PYTHONPATH includes app/generated, so we can import directly or via package depending on env.
# We try both for robustness.
try:
    from app.generated import agent_pb2
    from app.generated import agent_pb2_grpc
except ImportError:
    # Local dev fallback if not running in docker and path not set
    try:
        import agent_pb2
        import agent_pb2_grpc
    except:
        print("Warning: gRPC modules not found. Code generation required.")
        agent_pb2 = None
        agent_pb2_grpc = None

SOCKET_PATH = os.getenv("AGENT_SOCKET_PATH", "/var/run/agent/agent.sock")

class AgentClient:
    def __init__(self):
        self.channel = None
        self.stub = None

    def connect(self):
        # gRPC over Unix Socket in Python requires special target string: 'unix://path'
        # or just 'unix:path' depending on version. 'unix:///abs/path' is standard.
        target = f"unix://{SOCKET_PATH}"
        self.channel = grpc.insecure_channel(target)
        self.stub = agent_pb2_grpc.AgentServiceStub(self.channel)
    
    def ping(self) -> str:
        if not self.stub: self.connect()
        try:
            response = self.stub.Ping(agent_pb2.PingRequest())
            return response.status
        except grpc.RpcError as e:
            return f"Error: {e.details()}"

    def list_sites(self) -> list[str]:
        if not self.stub: self.connect()
        try:
            response = self.stub.ListSites(agent_pb2.ListSitesRequest())
            return list(response.sites)
        except grpc.RpcError as e:
            print(f"RPC Error: {e}")
            return []

    def get_site_config(self, filename: str):
        if not self.stub: self.connect()
        try:
            req = agent_pb2.GetSiteConfigRequest(filename=filename)
            response = self.stub.GetSiteConfig(req)
            return {
                "filename": response.filename,
                "content": response.content,
                "format_type": response.format_type
            }
        except grpc.RpcError as e:
            raise Exception(f"Agent Error: {e.details()}")

    def sync_config(self, target: str, filename: str, content: str, reload_after: bool = True) -> bool:
        if not self.stub: self.connect()
        try:
            req = agent_pb2.SyncConfigRequest(
                target=target,
                filename=filename,
                content=content,
                reload_after=reload_after
            )
            response = self.stub.SyncConfig(req)
            if not response.success:
                print(f"Agent Config Sync Failed: {response.message}")
            return response.success
        except grpc.RpcError as e:
            print(f"Agent RPC Error: {e.details()}")
            return False

# Singleton
agent_client = AgentClient()
