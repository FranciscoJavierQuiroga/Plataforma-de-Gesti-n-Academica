#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Iniciando servicios backend..."

# Cargar variables de entorno desde .env
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "📋 Cargando variables de entorno..."
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# Activar entorno virtual si existe
if [ -d "$SCRIPT_DIR/backend/.venv" ]; then
    source "$SCRIPT_DIR/backend/.venv/bin/activate"
fi

# Iniciar servicios en background
cd "$SCRIPT_DIR/backend"

echo "📡 Iniciando Login Service (puerto 5000)..."
python login_service/app.py &
PIDS[0]=$!

echo "👨‍🎓 Iniciando Students Service (puerto 5001)..."
python students_service/app.py &
PIDS[1]=$!

echo "👨‍🏫 Iniciando Teachers Service (puerto 5002)..."
python teachers_service/app.py &
PIDS[2]=$!

echo "👨‍💼 Iniciando Administrator Service (puerto 5003)..."
python administrator_service/app.py &
PIDS[3]=$!

echo "📚 Iniciando Groups Service (puerto 5004)..."
python groups_service/app.py &
PIDS[4]=$!

echo "📊 Iniciando Grades Service (puerto 5005)..."
python grades_service/app.py &
PIDS[5]=$!

# ✅ NUEVO: Servicio de Cursos/Asignaturas
echo "📖 Iniciando Courses Service (puerto 5006)..."
python courses_service/app.py &
PIDS[6]=$!

echo ""
echo "✅ Todos los servicios iniciados"
echo "📋 PIDs: ${PIDS[@]}"
echo ""
echo "Para detener todos los servicios, ejecuta: ./stop_backend.sh"
