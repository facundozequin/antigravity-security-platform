# Nginx Admin Dashboard

Una solución de administración, monitoreo y auditoría de seguridad para Nginx, diseñada para ser auto-hospedada y segura.

## 🚀 Características
- **Dashboard en tiempo real**: Visualización de tráfico, errores y métricas clave.
- **Administración de Nginx**: Interfaz web para gestionar archivos de configuración de sitios.
- **Arquitectura de Agente Privilegiado**: Un agente ligero en Go para cambios seguros en el sistema de archivos.
- **Analytics con ClickHouse**: Procesamiento de logs de alto rendimiento.
- **Docker-Ready**: Despliegue sencillo con Docker Compose.

## 🏗️ Arquitectura
El proyecto sigue una arquitectura de microservicios:
- **Frontend**: React (Vite) + CSS moderno + Recharts.
- **API**: FastAPI (Python) - Orquestador no privilegiado.
- **Agent**: Go - Agente con privilegios para interactuar con Nginx y el FS.
- **Logs**: Vector + ClickHouse para análisis de tráfico en tiempo real.

## 🛠️ Instalación Local

### Requisitos
- Docker y Docker Compose
- Node.js (opcional, para desarrollo de frontend)
- Python 3.11+ (opcional, para desarrollo de API)

### Ejecutar con Docker
```bash
docker-compose up -d
```
El panel estará disponible en `http://localhost:3000`.

## 📂 Estructura del Proyecto
```text
.
├── agent/            # Agente de sistema en Go (gRPC)
├── api/              # Backend API en Python (FastAPI)
├── frontend/         # Dashboard Web (React + Vite)
├── deploy/           # Archivos de configuración y volumenes
└── docker-compose.yml # Orquestación completa
```

## 🔒 Seguridad
- El Agente corre como root para manejar Nginx, pero solo se comunica vía Unix Socket con la API.
- La API no tiene privilegios de sistema, reduciendo la superficie de ataque.
- Soporte planificado para Fail2Ban y ModSecurity.

## 📄 Licencia
Este proyecto está bajo la licencia MIT.
