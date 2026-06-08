#!/bin/bash

# Script de inicio de infraestructura para Plataforma de Gestión Académica
# Inicia: Keycloak + MongoDB (Docker) + Backend Flask (local) + Frontend Angular (local)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Plataforma de Gestión Académica - Inicio de Infraestructura${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ==========================================
# 1. Verificar Docker
# ==========================================
echo -e "${YELLOW}🔍 Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado. Instálalo primero:${NC}"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker no está corriendo. Inicia el daemon de Docker primero.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker está disponible${NC}"

# ==========================================
# 2. Verificar Docker Compose
# ==========================================
echo -e "${YELLOW}🔍 Verificando Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ Docker Compose no está instalado.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker Compose disponible: $COMPOSE_CMD${NC}"

# ==========================================
# 3. Iniciar contenedores (Keycloak + MongoDB)
# ==========================================
echo ""
echo -e "${YELLOW}🚀 Iniciando contenedores Docker (Keycloak + MongoDB)...${NC}"
cd "$SCRIPT_DIR"

$COMPOSE_CMD up -d

# ==========================================
# 4. Esperar a que Keycloak esté listo
# ==========================================
echo ""
echo -e "${YELLOW}⏳ Esperando a que Keycloak esté listo...${NC}"
MAX_RETRIES=30
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8082/health/ready > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Keycloak está listo en http://localhost:8082${NC}"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -e "   Intento $RETRY/$MAX_RETRIES..."
    sleep 3
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo -e "${RED}⚠️ Keycloak no respondió a tiempo. Revisa los logs:${NC}"
    echo "   docker logs keycloak-plataforma"
    echo ""
    echo -e "${YELLOW}Los contenedores siguen corriendo. Puedes verificar manualmente.${NC}"
fi

# ==========================================
# 5. Esperar a que MongoDB esté listo
# ==========================================
echo ""
echo -e "${YELLOW}⏳ Esperando a que MongoDB esté listo...${NC}"
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker exec mongo-plataforma mongo --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MongoDB está listo en mongodb://localhost:27017${NC}"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -e "   Intento $RETRY/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo -e "${RED}⚠️ MongoDB no respondió a tiempo. Revisa los logs:${NC}"
    echo "   docker logs mongo-plataforma"
fi

# ==========================================
# 6. Iniciar backend services
# ==========================================
echo ""
echo -e "${YELLOW}🐍 Iniciando servicios backend...${NC}"
cd "$SCRIPT_DIR"

# Verificar si hay entorno virtual
if [ -d "backend/.venv" ]; then
    echo -e "${BLUE}   Activando entorno virtual...${NC}"
    source backend/.venv/bin/activate
else
    echo -e "${YELLOW}   ⚠️ No se encontró backend/.venv. Asegúrate de instalar dependencias:${NC}"
    echo "   cd backend && pip install -r requirements.txt"
fi

./start_backend.sh &

# ==========================================
# 7. Instrucciones
# ==========================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Infraestructura iniciada exitosamente${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Servicios disponibles:${NC}"
echo "  • Keycloak Admin:   http://localhost:8082/admin"
echo "    Usuario: admin | Contraseña: admin"
echo ""
echo "  • MongoDB:          mongodb://localhost:27017"
echo "    Usuario: admin | Contraseña: admin123"
echo "    Base de datos: colegio"
echo ""
echo "  • Backend services:   http://localhost:5000-5006"
echo ""
echo -e "${BLUE}Usuarios de prueba (Keycloak):${NC}"
echo "  • admin        / admin123       → Rol: administrador"
echo "  • profesor     / profesor123    → Rol: docente"
echo "  • estudiante   / estudiante123  → Rol: estudiante"
echo ""
echo -e "${YELLOW}Para iniciar el frontend:${NC}"
echo "  ng serve"
echo ""
echo -e "${YELLOW}Para detener todo:${NC}"
echo "  ./stop_infrastructure.sh"
echo ""
echo -e "${YELLOW}Notas:${NC}"
echo "  • El backend usa mock JWT si Keycloak no está disponible."
echo "  • Con Keycloak corriendo, los tokens se validan realmente."
echo "  • Si Keycloak no importa el realm, accede a http://localhost:8082/admin"
echo "    e importa manualmente: keycloak/realm-export.json"
echo ""
