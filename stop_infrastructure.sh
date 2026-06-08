#!/bin/bash

# Script de detención de infraestructura para Plataforma de Gestión Académica

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Deteniendo infraestructura...${NC}"

# Detener backend services
cd "$SCRIPT_DIR"
if [ -f "./stop_backend.sh" ]; then
    echo -e "   Deteniendo backend services..."
    ./stop_backend.sh || true
fi

# Detener contenedores Docker
echo -e "   Deteniendo contenedores Docker..."
if command -v docker-compose &> /dev/null; then
    docker-compose down || true
elif docker compose version &> /dev/null; then
    docker compose down || true
fi

echo -e "${GREEN}✅ Infraestructura detenida${NC}"
