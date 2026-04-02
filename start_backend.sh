#!/bin/bash

echo "🚀 Iniciando servicios backend..."

# Activar entorno virtual si existe
if [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
fi

# Iniciar servicios en background
cd backend

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
