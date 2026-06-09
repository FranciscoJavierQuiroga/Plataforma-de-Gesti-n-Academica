#!/usr/bin/env python3
"""
Script para generar datos de calificaciones del periodo 1 de 2026.
- Crea periodo 1 de 2026 (cerrado)
- Copia grupos, matriculas y asignaciones de 2025 a 2026
- Genera calificaciones realistas para cada estudiante (3 notas, pesos uniformes)
- Calcula promedios y actualiza campo 'average'
- Marca periodo 1 como cerrado en los grupos
"""

import os
import random
from datetime import datetime
from bson import ObjectId, Timestamp
from pymongo import MongoClient

# Configuración
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://fjquirogap200105_db_user:prueba123.@dbcolegio.b2xb5xo.mongodb.net/colegio?retryWrites=true&w=majority')
ANIO_LECTIVO = "2026"
PERIODO = "1"
NOTAS_POR_MATERIA = 3
PESO_UNIFORME = 0.33

# Conectar a MongoDB
print("Conectando a MongoDB...")
client = MongoClient(MONGO_URI)
db = client['colegio']

# Colecciones
usuarios = db['usuarios']
grupos = db['grupos']
cursos = db['cursos']
matriculas = db['matriculas']
asignaciones = db['asignaciones_docentes']
periodos = db['periodos']

# Tipos de evaluación
TIPOS_EVALUACION = ['Parcial', 'Taller', 'Quiz']


def generar_nota_realista():
    """Genera una nota realista entre 0.5 y 5.0 con distribución gaussiana"""
    # Media 3.0, desviación estándar 1.0
    nota = random.gauss(3.0, 1.0)
    # Limitar entre 0.5 y 5.0
    nota = max(0.5, min(5.0, nota))
    # Redondear a 1 decimal
    return round(nota, 1)


def crear_periodo_1_2026():
    """Crea el periodo 1 de 2026 como cerrado"""
    print("\n📅 Creando periodo 1 de 2026...")
    
    periodo_doc = {
        '_id': ObjectId(),
        'nombre': f'Primer Periodo {ANIO_LECTIVO}',
        'periodo': PERIODO,
        'anio_lectivo': ANIO_LECTIVO,
        'fecha_inicio': datetime(2026, 2, 1),
        'fecha_fin': datetime(2026, 3, 31),
        'fecha_limite_calificaciones': datetime(2026, 3, 30),
        'activo': False,  # Cerrado, ya que ahora es periodo 2
        'nota_minima_aprobacion': 3.0,
        'limite_materias_reprobadas': 3,
        'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
    }
    
    # Insertar si no existe
    existing = periodos.find_one({'periodo': PERIODO, 'anio_lectivo': ANIO_LECTIVO})
    if not existing:
        periodos.insert_one(periodo_doc)
        print(f"✅ Periodo 1 {ANIO_LECTIVO} creado (ID: {periodo_doc['_id']})")
    else:
        print(f"⚠️ Periodo 1 {ANIO_LECTIVO} ya existe (ID: {existing['_id']})")
    
    return periodo_doc


def copiar_grupos_a_2026():
    """Copia grupos de 2025 a 2026"""
    print(f"\n🏫 Copiando grupos a {ANIO_LECTIVO}...")
    
    grupos_2025 = list(grupos.find({'año_lectivo': '2025'}))
    grupos_2026 = []
    
    for g in grupos_2025:
        # Verificar si ya existe
        existing = grupos.find_one({'nombre_grupo': g['nombre_grupo'], 'año_lectivo': ANIO_LECTIVO})
        if existing:
            print(f"  ⚠️ Grupo {g['nombre_grupo']} ya existe para {ANIO_LECTIVO}")
            grupos_2026.append(existing)
            continue
        
        nuevo_grupo = {
            '_id': ObjectId(),
            'nombre_grupo': g['nombre_grupo'],
            'grado': g['grado'],
            'jornada': g['jornada'],
            'año_lectivo': ANIO_LECTIVO,
            'director_grupo': g['director_grupo'],
            'director_info': g['director_info'],
            'capacidad_max': g['capacidad_max'],
            'estudiantes_actuales': g['estudiantes_actuales'],
            'salon_principal': g['salon_principal'],
            'activo': True,
            'periodos_cerrados': [PERIODO],  # Periodo 1 cerrado
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        grupos.insert_one(nuevo_grupo)
        grupos_2026.append(nuevo_grupo)
        print(f"  ✅ Grupo {nuevo_grupo['nombre_grupo']} creado (ID: {nuevo_grupo['_id']})")
    
    return grupos_2026


def copiar_asignaciones_a_2026(grupos_2026):
    """Copia asignaciones_docentes de 2025 a 2026"""
    print(f"\n📚 Copiando asignaciones a {ANIO_LECTIVO}...")
    
    # Crear mapa de grupos 2025 -> 2026
    grupos_2025 = list(grupos.find({'año_lectivo': '2025'}))
    mapa_grupos = {}
    for g25 in grupos_2025:
        g26 = grupos.find_one({'nombre_grupo': g25['nombre_grupo'], 'año_lectivo': ANIO_LECTIVO})
        if g26:
            mapa_grupos[str(g25['_id'])] = g26['_id']
    
    asignaciones_2026 = []
    
    for asig_2025 in asignaciones.find({'anio_lectivo': '2025'}):
        # Obtener nuevo grupo_id
        grupo_id_2025 = str(asig_2025['id_grupo'])
        grupo_id_2026 = mapa_grupos.get(grupo_id_2025)
        
        if not grupo_id_2026:
            print(f"  ⚠️ No se encontró grupo 2026 para asignación {asig_2025['_id']}")
            continue
        
        # Verificar si ya existe
        existing = asignaciones.find_one({
            'id_grupo': grupo_id_2026,
            'id_curso': asig_2025['id_curso'],
            'periodo': PERIODO,
            'anio_lectivo': ANIO_LECTIVO
        })
        
        if existing:
            print(f"  ⚠️ Asignación {asig_2025['curso_info']['nombre_curso']} ya existe")
            asignaciones_2026.append(existing)
            continue
        
        nueva_asignacion = {
            '_id': ObjectId(),
            'id_grupo': grupo_id_2026,
            'id_curso': asig_2025['id_curso'],
            'id_docente': asig_2025['id_docente'],
            'periodo': PERIODO,
            'anio_lectivo': ANIO_LECTIVO,
            'grupo_info': asig_2025['grupo_info'],
            'curso_info': asig_2025['curso_info'],
            'docente_info': asig_2025['docente_info'],
            'salon_asignado': asig_2025.get('salon_asignado', ''),
            'activo': True,
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        asignaciones.insert_one(nueva_asignacion)
        asignaciones_2026.append(nueva_asignacion)
        print(f"  ✅ {nueva_asignacion['curso_info']['nombre_curso']} -> {nueva_asignacion['grupo_info']['nombre_grupo']}")
    
    return asignaciones_2026


def copiar_matriculas_a_2026(grupos_2026):
    """Copia matriculas de 2025 a 2026"""
    print(f"\n📝 Copiando matriculas a {ANIO_LECTIVO}...")
    
    # Crear mapa de grupos 2025 -> 2026
    grupos_2025 = list(grupos.find({'año_lectivo': '2025'}))
    mapa_grupos = {}
    for g25 in grupos_2025:
        g26 = grupos.find_one({'nombre_grupo': g25['nombre_grupo'], 'año_lectivo': ANIO_LECTIVO})
        if g26:
            mapa_grupos[str(g25['_id'])] = g26['_id']
    
    matriculas_2026 = []
    
    for mat_2025 in matriculas.find({'anio_lectivo': '2025', 'estado': 'activa'}):
        estudiante_id = mat_2025['id_estudiante']
        grupo_id_2025 = str(mat_2025['id_grupo'])
        grupo_id_2026 = mapa_grupos.get(grupo_id_2025)
        
        if not grupo_id_2026:
            print(f"  ⚠️ No se encontró grupo 2026 para matricula {mat_2025['_id']}")
            continue
        
        # Verificar si ya existe
        existing = matriculas.find_one({
            'id_estudiante': estudiante_id,
            'anio_lectivo': ANIO_LECTIVO
        })
        
        if existing:
            print(f"  ⚠️ Matricula de {mat_2025['estudiante_info']['nombres']} ya existe")
            matriculas_2026.append(existing)
            continue
        
        nueva_matricula = {
            '_id': ObjectId(),
            'id_estudiante': estudiante_id,
            'id_grupo': grupo_id_2026,
            'anio_lectivo': ANIO_LECTIVO,
            'estado': 'activa',
            'estudiante_info': mat_2025['estudiante_info'],
            'grupo_info': mat_2025['grupo_info'],
            'calificaciones': [],  # Se llenará después
            'observaciones': '',
            'average': 0,
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        matriculas.insert_one(nueva_matricula)
        matriculas_2026.append(nueva_matricula)
        print(f"  ✅ Matricula de {nueva_matricula['estudiante_info']['nombres']} {nueva_matricula['estudiante_info']['apellidos']}")
    
    return matriculas_2026


def generar_calificaciones(matriculas_2026, asignaciones_2026):
    """Genera calificaciones realistas para cada matricula"""
    print(f"\n🎯 Generando calificaciones realistas...")
    
    total_notas = 0
    
    for mat in matriculas_2026:
        grupo_id = mat['id_grupo']
        calificaciones = []
        
        # Obtener asignaciones para este grupo
        asignaciones_grupo = [a for a in asignaciones_2026 if a['id_grupo'] == grupo_id]
        
        for asig in asignaciones_grupo:
            notas = []
            for i in range(NOTAS_POR_MATERIA):
                nota = generar_nota_realista()
                notas.append({
                    'tipo': TIPOS_EVALUACION[i],
                    'nota': nota,
                    'nota_maxima': 5.0,
                    'peso': PESO_UNIFORME,
                    'fecha_eval': datetime(2026, 2 + i, 15),  # Feb, Mar, Abr
                    'comentarios': f'Evaluación {i+1} del periodo'
                })
                total_notas += 1
            
            calificaciones.append({
                'id_asignacion': asig['_id'],
                'periodo': PERIODO,
                'notas': notas
            })
        
        # Calcular promedio general
        todas_notas = []
        for cal in calificaciones:
            todas_notas.extend(cal['notas'])
        
        if todas_notas:
            total = sum(n['nota'] * n['peso'] for n in todas_notas)
            total_peso = sum(n['peso'] for n in todas_notas)
            promedio = round(total / total_peso, 2) if total_peso > 0 else 0
        else:
            promedio = 0
        
        # Actualizar matricula
        matriculas.update_one(
            {'_id': mat['_id']},
            {'$set': {
                'calificaciones': calificaciones,
                'average': promedio
            }}
        )
        
        print(f"  ✅ {mat['estudiante_info']['nombres']} {mat['estudiante_info']['apellidos']}: {len(asignaciones_grupo)} materias, promedio {promedio}")
    
    print(f"\n📊 Total de notas generadas: {total_notas}")


def generar_asistencias(grupos_2026, asignaciones_2026, matriculas_2026):
    """Genera registros de asistencia para completar el periodo"""
    print(f"\n📋 Generando asistencias...")
    
    asistencia_col = db['asistencia']
    dias_laborables = [
        datetime(2026, 2, 5), datetime(2026, 2, 12), datetime(2026, 2, 19), datetime(2026, 2, 26),
        datetime(2026, 3, 5), datetime(2026, 3, 12), datetime(2026, 3, 19), datetime(2026, 3, 26),
    ]
    
    total_registros = 0
    
    for asig in asignaciones_2026:
        for fecha in dias_laborables:
            # Verificar si ya existe
            existing = asistencia_col.find_one({
                'id_curso': asig['id_curso'],
                'fecha': fecha
            })
            if existing:
                continue
            
            # Obtener estudiantes del grupo
            estudiantes_mat = [m for m in matriculas_2026 if m['id_grupo'] == asig['id_grupo']]
            
            registros = []
            for mat in estudiantes_mat:
                # 90% presente, 10% ausente/tarde
                rand = random.random()
                if rand < 0.85:
                    estado = 'presente'
                elif rand < 0.95:
                    estado = 'ausente'
                else:
                    estado = 'tarde'
                
                registros.append({
                    'id_estudiante': mat['id_estudiante'],
                    'estudiante_info': mat['estudiante_info'],
                    'estado': estado,
                    'observaciones': ''
                })
            
            asistencia_doc = {
                'id_curso': asig['id_curso'],
                'id_docente': asig['id_docente'],
                'fecha': fecha,
                'periodo': PERIODO,
                'registros': registros,
                'curso_info': asig['curso_info'],
                'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0),
                'actualizado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
            }
            
            asistencia_col.insert_one(asistencia_doc)
            total_registros += 1
    
    print(f"  ✅ {total_registros} registros de asistencia creados")


def main():
    print("="*60)
    print(" GENERACIÓN DE DATOS 2026 - PERIODO 1")
    print("="*60)
    
    # 1. Crear periodo
    crear_periodo_1_2026()
    
    # 2. Copiar grupos
    grupos_2026 = copiar_grupos_a_2026()
    
    # 3. Copiar asignaciones
    asignaciones_2026 = copiar_asignaciones_a_2026(grupos_2026)
    
    # 4. Copiar matriculas
    matriculas_2026 = copiar_matriculas_a_2026(grupos_2026)
    
    # 5. Generar calificaciones
    generar_calificaciones(matriculas_2026, asignaciones_2026)
    
    # 6. Generar asistencias
    generar_asistencias(grupos_2026, asignaciones_2026, matriculas_2026)
    
    print("\n" + "="*60)
    print(" ✅ GENERACIÓN COMPLETADA")
    print("="*60)
    print(f"📊 Resumen:")
    print(f"   - Grupos creados: {len(grupos_2026)}")
    print(f"   - Asignaciones creadas: {len(asignaciones_2026)}")
    print(f"   - Matriculas creadas: {len(matriculas_2026)}")
    print(f"   - Periodo 1 marcado como cerrado")
    print(f"\n🎓 El sistema está listo para el periodo 2 de 2026")


if __name__ == '__main__':
    main()
