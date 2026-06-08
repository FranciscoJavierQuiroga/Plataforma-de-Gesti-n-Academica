#!/bin/bash
# Deploy Zappa services using pre-built Python 3.11 (no Docker needed)
# This script downloads a standalone Python 3.11 binary and uses it for deployment.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

PYTHON_VERSION="3.11.15"
PBS_TAG="20260602"
PYTHON_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_TAG}/cpython-${PYTHON_VERSION}%2B${PBS_TAG}-x86_64-unknown-linux-gnu-install_only.tar.gz"
INSTALL_DIR="/tmp/python311-zappa"
VENV_DIR="/tmp/zappa-venv"

SERVICES=(
    "login_service"
    "teachers_service"
    "students_service"
    "groups_service"
    "administrator_service"
)

STAGE="dev"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

download_python() {
    if [ -f "$INSTALL_DIR/bin/python3.11" ]; then
        echo -e "${GREEN}✅ Python 3.11 already downloaded${NC}"
        return 0
    fi

    echo -e "${YELLOW}📥 Downloading Python ${PYTHON_VERSION}...${NC}"
    mkdir -p "$INSTALL_DIR"
    curl -L --progress-bar "$PYTHON_URL" -o /tmp/python311.tar.gz
    
    echo -e "${YELLOW}📦 Extracting Python...${NC}"
    tar -xzf /tmp/python311.tar.gz -C "$INSTALL_DIR" --strip-components=1
    rm /tmp/python311.tar.gz
    
    echo -e "${GREEN}✅ Python installed to $INSTALL_DIR${NC}"
}

setup_venv() {
    if [ -f "$VENV_DIR/bin/zappa" ]; then
        echo -e "${GREEN}✅ Virtual environment already set up${NC}"
        return 0
    fi

    echo -e "${YELLOW}🔧 Creating virtual environment...${NC}"
    "$INSTALL_DIR/bin/python3.11" -m venv "$VENV_DIR"
    
    echo -e "${YELLOW}📦 Installing Zappa, AWS CLI, and boto3...${NC}"
    "$VENV_DIR/bin/pip" install --quiet --upgrade pip
    "$VENV_DIR/bin/pip" install --quiet awscli zappa==0.58.0 boto3
    
    echo -e "${GREEN}✅ Virtual environment ready${NC}"
}

deploy_service() {
    local service="$1"
    echo -e "${YELLOW}🚀 Deploying $service to stage '$STAGE'...${NC}"
    
    cd "$PROJECT_ROOT/backend/$service"
    "$VENV_DIR/bin/zappa" update "$STAGE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $service deployed successfully${NC}"
    else
        echo -e "${RED}❌ $service deployment failed${NC}"
        return 1
    fi
}

# Main
target="${1:-all}"

# Check AWS credentials
if [ ! -d "$HOME/.aws" ]; then
    echo -e "${RED}❌ AWS credentials not found at ~/.aws${NC}"
    echo "Please configure AWS CLI first: aws configure"
    exit 1
fi

download_python
setup_venv

if [ "$target" == "all" ]; then
    echo -e "${YELLOW}📦 Deploying all services to stage '$STAGE'...${NC}"
    echo ""
    
    failed=()
    for service in "${SERVICES[@]}"; do
        if ! deploy_service "$service"; then
            failed+=("$service")
        fi
        echo ""
    done
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🎉 Deployment Summary${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    for service in "${SERVICES[@]}"; do
        if [[ " ${failed[*]} " =~ [[:space:]]${service}[[:space:]] ]]; then
            echo -e "${RED}  ❌ $service — FAILED${NC}"
        else
            echo -e "${GREEN}  ✅ $service — OK${NC}"
        fi
    done
    
    if [ ${#failed[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}⚠️  ${#failed[@]} service(s) failed to deploy${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ All services deployed successfully!${NC}"
else
    found=false
    for service in "${SERVICES[@]}"; do
        if [ "$service" == "$target" ]; then
            found=true
            deploy_service "$service"
            break
        fi
    done
    
    if [ "$found" == false ]; then
        echo -e "${RED}❌ Unknown service: $target${NC}"
        echo "Available services: ${SERVICES[*]}"
        exit 1
    fi
fi
