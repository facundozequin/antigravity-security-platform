FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (none for now)

# Copy Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Source
COPY . .

# Create package structure if flat
RUN touch app/__init__.py

# Generate gRPC Python Code
# We output to 'app' package so we can import as 'from app import agent_pb2' or relative
RUN python -m grpc_tools.protoc -I./proto --python_out=./app --grpc_python_out=./app ./proto/agent.proto

# Fix imports in generated code if necessary (protoc generates absolute imports often)
# But with python 3 and package structure it might be tricky.
# We'll see. Often easier to just put generated files in a 'generated' package.
# Let's clean this up: Put generated code in `app/generated`.

RUN mkdir -p app/generated
RUN touch app/generated/__init__.py
RUN python -m grpc_tools.protoc -I./proto --python_out=./app/generated --grpc_python_out=./app/generated ./proto/agent.proto

# Fix for grpc generated imports being absolute by default:
# The generated grpc file tries to `import agent_pb2`.
# In `app/generated`, it needs to be `from . import agent_pb2`.
# We can use a sed replacement or just add the generated path to PYTHONPATH.
ENV PYTHONPATH="${PYTHONPATH}:/app/app/generated"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
