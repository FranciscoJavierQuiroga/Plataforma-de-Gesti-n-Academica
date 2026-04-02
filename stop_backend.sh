#!/bin/bash

echo "🛑 Deteniendo todos los servicios backend..."

# Función para detener un servicio
stop_service() {
    local service_name=$1
    local pid_file="/tmp/zappa_${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "✓ $service_name detenido (PID: $pid)"
        fi
        rm "$pid_file"
    fi
}

# Detener todos los servicios
stop_service "login_service"
stop_service "students_service"
stop_service "teachers_service"
stop_service "administrator_service"
stop_service "groups_service"
stop_service "grades_service"


# Matar cualquier proceso Python que siga corriendo en los puertos
for port in 5000 5001 5002 5003 5004 5005 5006; do
    lsof -ti:$port | xargs kill -9 2>/dev/null
done

echo "✅ Todos los servicios han sido detenidos"