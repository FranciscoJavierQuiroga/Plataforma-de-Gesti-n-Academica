from flask import Flask, request, jsonify, g
from flask_cors import CORS
from datetime import datetime
from keycloak import KeycloakOpenID
from functools import wraps
import sys
import os
from bson.timestamp import Timestamp

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_cursos_collection,
    get_usuarios_collection,
    get_matriculas_collection,
    get_asignaciones_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

app = Flask(__name__)
app.secret_key = "PlataformaColegios"

# 🔧 CORS CONFIGURACIÓN
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:4200"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        headers = {
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        response.headers.update(headers)
        return response

# Replace the hardcoded block in grades_service/app.py with:
KEYCLOAK_SERVER = os.getenv('KEYCLOAK_SERVER_URL', 'http://localhost:8082')
KEYCLOAK_CLIENT_ID = os.getenv('KEYCLOAK_CLIENT_ID', '01')
KEYCLOAK_REALM = os.getenv('KEYCLOAK_REALM', 'plataformaInstitucional')
KEYCLOAK_CLIENT_SECRET = os.getenv('KEYCLOAK_CLIENT_SECRET', 'wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz')

keycloak_openid = None
try:
    keycloak_openid = KeycloakOpenID(
        server_url=KEYCLOAK_SERVER,
        client_id=KEYCLOAK_CLIENT_ID,
        realm_name=KEYCLOAK_REALM,
        client_secret_key=KEYCLOAK_CLIENT_SECRET
    )
except Exception:
    keycloak_openid = None

def tiene_rol(token_info, cliente_id, rol_requerido):
    try:
        realm_roles = token_info.get("realm_access", {}).get("roles", [])
        if rol_requerido in realm_roles:
            return True
        resource_roles = token_info.get("resource_access", {}).get(cliente_id, {}).get("roles", [])
        if rol_requerido in resource_roles:
            return True
        return False
    except Exception:
        return False

def token_required(rol_requerido):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            auth_header = request.headers.get('Authorization', None)
            if not auth_header:
                print("❌ No se encontró header Authorization")
                return jsonify({"error": "Token Requerido"}), 401
            
            try:
                token = auth_header.split(" ")[1]
                print(f"🔑 Token recibido: {token[:50]}...")
                
                # Intentar decodificar con Keycloak
                try:
                    public_key_pem = f"-----BEGIN PUBLIC KEY-----\n{keycloak_openid.public_key()}\n-----END PUBLIC KEY-----"
                    
                    userinfo = keycloak_openid.decode_token(
                        token,
                        key=public_key_pem,
                        options={
                            "verify_signature": True,
                            "verify_aud": False,
                            "verify_exp": True
                        }
                    )
                    print(f"✅ Token decodificado con Keycloak")
                    
                except Exception as decode_error:
                    print(f"⚠️ Error con Keycloak: {decode_error}")
                    import jwt as pyjwt
                    userinfo = pyjwt.decode(token, options={"verify_signature": False})
                    print("⚠️ Fallback a decodificación sin firma")
                    
            except Exception as e:
                print(f"❌ Error procesando token: {e}")
                return jsonify({"error": "Token inválido o expirado"}), 401
            
            if not tiene_rol(userinfo, keycloak_openid.client_id, rol_requerido):
                print(f"❌ Acceso denegado: se requiere rol '{rol_requerido}'")
                return jsonify({"error": f"Acceso denegado: se requiere el rol '{rol_requerido}'"}), 403
            
            print(f"✅ Acceso permitido para rol '{rol_requerido}'")
            g.userinfo = userinfo
            return f(*args, **kwargs)
        
        return decorated
    return decorator

# ==================== ENDPOINTS ====================

@app.route('/')
def home():
    return jsonify({
        'service': 'Grades Service',
        'version': '1.0.0',
        'database': 'MongoDB',
        'endpoints': {
            'get_course_grades': 'GET /grades/course/<course_id>',
            'get_student_grades': 'GET /grades/student/<student_id>',
            'add_grade': 'POST /grades',
            'update_grade': 'PUT /grades/<enrollment_id>',
            'delete_grade': 'DELETE /grades/<enrollment_id>/<grade_index>',
            'calculate_average': 'GET /grades/average/<enrollment_id>',
            'bulk_upload': 'POST /grades/bulk'
        }
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'grades', 'database': 'MongoDB'})

@app.route('/grades/course/<course_id>', methods=['GET'])
def get_course_grades(course_id):
    """Obtener todas las calificaciones de un curso"""
    try:
        matriculas = get_matriculas_collection()
        asignaciones = get_asignaciones_collection()
        
        # Convertir ID a ObjectId
        curso_obj_id = string_to_objectid(course_id)
        if not curso_obj_id:
            return jsonify({'success': False, 'error': 'ID de curso inválido'}), 400
        
        # Buscar asignaciones activas del curso (modelo actual)
        asignaciones_curso = list(asignaciones.find({
            'id_curso': curso_obj_id,
            'activo': True
        }))

        if not asignaciones_curso:
            return jsonify({
                'success': True,
                'course_id': course_id,
                'students': [],
                'count': 0
            }), 200

        # Indexar asignaciones por grupo para localizar las notas correctas
        asignacion_por_grupo = {}
        for asig in asignaciones_curso:
            asignacion_por_grupo[asig['id_grupo']] = asig

        enrollments = list(matriculas.find({
            'id_grupo': {'$in': list(asignacion_por_grupo.keys())},
            'estado': 'activa'
        }))
        
        # Formatear datos
        grades_data = []
        for enrollment in enrollments:
            student_info = enrollment.get('estudiante_info', {})
            asig = asignacion_por_grupo.get(enrollment.get('id_grupo'))
            notas = []

            if asig:
                for item in enrollment.get('calificaciones', []):
                    if item.get('id_asignacion') == asig['_id']:
                        notas = item.get('notas', [])
                        break
            
            # Calcular promedio
            promedio = 0
            if notas:
                total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas)
                total_peso = sum(n.get('peso', 0) for n in notas)
                promedio = round(total / total_peso, 2) if total_peso > 0 else 0
            
            grades_data.append({
                'enrollment_id': str(enrollment['_id']),
                'student_id': str(enrollment['id_estudiante']),
                'student_name': f"{student_info.get('nombres', '')} {student_info.get('apellidos', '')}",
                'student_code': student_info.get('codigo_est', ''),
                'grades': serialize_doc(notas),
                'average': promedio,
                'assignment_id': str(asig['_id']) if asig else None,
                'group_id': str(enrollment.get('id_grupo')) if enrollment.get('id_grupo') else None
            })
        
        return jsonify({
            'success': True,
            'course_id': course_id,
            'students': grades_data,
            'count': len(grades_data)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/grades/student/<student_id>', methods=['GET'])
def get_student_grades(student_id):
    """Obtener todas las calificaciones de un estudiante"""
    try:
        matriculas = get_matriculas_collection()
        asignaciones = get_asignaciones_collection()
        
        # Convertir ID a ObjectId
        estudiante_obj_id = string_to_objectid(student_id)
        if not estudiante_obj_id:
            return jsonify({'success': False, 'error': 'ID de estudiante inválido'}), 400
        
        # Filtros opcionales
        periodo = request.args.get('periodo')
        curso_id = request.args.get('course_id')
        
        # Construir query base
        query = {
            'id_estudiante': estudiante_obj_id,
            'estado': 'activa'
        }

        curso_obj_id = None
        if curso_id:
            curso_obj_id = string_to_objectid(curso_id)
            if curso_obj_id:
                pass
        
        # Buscar matrículas
        enrollments = list(matriculas.find(query))
        
        # Formatear datos
        courses_grades = []
        total_average = 0
        count_courses = 0
        
        # Cache simple para evitar varias lecturas de la misma asignacion
        asignacion_cache = {}

        for enrollment in enrollments:
            for cal_asignacion in enrollment.get('calificaciones', []):
                id_asignacion = cal_asignacion.get('id_asignacion')
                if not id_asignacion:
                    continue

                asig_key = str(id_asignacion)
                if asig_key not in asignacion_cache:
                    asignacion_cache[asig_key] = asignaciones.find_one({'_id': id_asignacion})

                asig = asignacion_cache.get(asig_key)
                if not asig:
                    continue

                if curso_obj_id and asig.get('id_curso') != curso_obj_id:
                    continue

                if periodo and cal_asignacion.get('periodo') != periodo:
                    continue

                notas = cal_asignacion.get('notas', [])
                promedio_curso = 0
                if notas:
                    total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas)
                    total_peso = sum(n.get('peso', 0) for n in notas)
                    promedio_curso = round(total / total_peso, 2) if total_peso > 0 else 0
                    total_average += promedio_curso
                    count_courses += 1

                curso_info = asig.get('curso_info', {})
                courses_grades.append({
                    'enrollment_id': str(enrollment['_id']),
                    'course_id': str(asig.get('id_curso')),
                    'course_name': curso_info.get('nombre_curso', ''),
                    'course_code': curso_info.get('codigo_curso', ''),
                    'period': cal_asignacion.get('periodo', ''),
                    'grades': serialize_doc(notas),
                    'average': promedio_curso,
                    'status': enrollment.get('estado', 'activa'),
                    'assignment_id': asig_key
                })
        
        # Calcular promedio general
        promedio_general = round(total_average / count_courses, 2) if count_courses > 0 else 0
        
        return jsonify({
            'success': True,
            'student_id': student_id,
            'courses': courses_grades,
            'general_average': promedio_general,
            'count': len(courses_grades)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/grades', methods=['POST'])
def add_grade():
    """Agregar una calificación a una matrícula (estructura anidada por asignación)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['enrollment_id', 'assignment_id', 'periodo', 'tipo', 'nota', 'peso']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'El campo {field} es requerido'
                }), 400
        
        # Validar nota
        nota = float(data['nota'])
        nota_maxima = float(data.get('nota_maxima', 5.0))
        peso = float(data['peso'])
        
        if nota < 0 or nota > nota_maxima:
            return jsonify({
                'success': False,
                'error': f'La nota debe estar entre 0 y {nota_maxima}'
            }), 400
        
        if peso < 0 or peso > 1:
            return jsonify({
                'success': False,
                'error': 'El peso debe estar entre 0 y 1'
            }), 400
        
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        enrollment_obj_id = string_to_objectid(data['enrollment_id'])
        assignment_obj_id = string_to_objectid(data['assignment_id'])
        
        if not enrollment_obj_id or not assignment_obj_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Verificar que la matrícula existe
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Crear objeto de calificación (para insertar en notas[])
        nueva_calificacion = {
            'tipo': data['tipo'],
            'nota': nota,
            'nota_maxima': nota_maxima,
            'peso': peso,
            'fecha_eval': datetime.utcnow(),
            'comentarios': data.get('comentarios', '')
        }
        
        periodo_eval = data.get('periodo', '1')
        
        # Intentar actualizar calificación existente para esta asignación/periodo
        resultado = matriculas.update_one(
            {
                '_id': enrollment_obj_id,
                'calificaciones.id_asignacion': assignment_obj_id,
                'calificaciones.periodo': periodo_eval
            },
            {'$push': {'calificaciones.$.notas': nueva_calificacion}}
        )
        
        # Si no modificó nada, crear nueva entrada de calificación
        if resultado.modified_count == 0:
            matriculas.update_one(
                {'_id': enrollment_obj_id},
                {
                    '$push': {
                        'calificaciones': {
                            'id_asignacion': assignment_obj_id,
                            'periodo': periodo_eval,
                            'notas': [nueva_calificacion]
                        }
                    }
                }
            )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='agregar_calificacion',
            entidad_afectada='matriculas',
            id_entidad=data['enrollment_id'],
            detalles=f"Calificación agregada: {data['tipo']} - Nota: {nota} - Asignación: {data['assignment_id']}"
        )
        
        # Obtener matrícula actualizada
        matricula_actualizada = matriculas.find_one({'_id': enrollment_obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Calificación agregada exitosamente',
            'enrollment': serialize_doc(matricula_actualizada)
        }), 201
        
    except ValueError as ve:
        return jsonify({'success': False, 'error': 'Valores numéricos inválidos'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/grades/<enrollment_id>/<assignment_id>/<int:note_index>', methods=['PUT'])
def update_grade(enrollment_id, assignment_id, note_index):
    """Actualizar una nota específica dentro de una asignación"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        enrollment_obj_id = string_to_objectid(enrollment_id)
        assignment_obj_id = string_to_objectid(assignment_id)
        
        if not enrollment_obj_id or not assignment_obj_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Verificar que la matrícula existe
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Buscar la calificación (con asignación y periodo)
        cal_asignacion = None
        for cal in matricula.get('calificaciones', []):
            if cal.get('id_asignacion') == assignment_obj_id:
                cal_asignacion = cal
                break
        
        if not cal_asignacion:
            return jsonify({'success': False, 'error': 'Calificación para esta asignación no encontrada'}), 404
        
        notas = cal_asignacion.get('notas', [])
        if note_index < 0 or note_index >= len(notas):
            return jsonify({'success': False, 'error': 'Índice de nota inválido'}), 400
        
        # Construir actualización
        update_fields = {}
        
        if 'nota' in data:
            nota = float(data['nota'])
            nota_maxima = notas[note_index].get('nota_maxima', 5.0)
            if nota < 0 or nota > nota_maxima:
                return jsonify({
                    'success': False,
                    'error': f'La nota debe estar entre 0 y {nota_maxima}'
                }), 400
            update_fields[f'calificaciones.$.notas.{note_index}.nota'] = nota
        
        if 'peso' in data:
            peso = float(data['peso'])
            if peso < 0 or peso > 1:
                return jsonify({'success': False, 'error': 'El peso debe estar entre 0 y 1'}), 400
            update_fields[f'calificaciones.$.notas.{note_index}.peso'] = peso
        
        if 'comentarios' in data:
            update_fields[f'calificaciones.$.notas.{note_index}.comentarios'] = data['comentarios']
        
        if 'tipo' in data:
            update_fields[f'calificaciones.$.notas.{note_index}.tipo'] = data['tipo']
        
        # Actualizar con filtro de asignación
        if update_fields:
            resultado = matriculas.update_one(
                {
                    '_id': enrollment_obj_id,
                    'calificaciones.id_asignacion': assignment_obj_id
                },
                {'$set': update_fields}
            )
            
            registrar_auditoria(
                id_usuario=None,
                accion='actualizar_calificacion',
                entidad_afectada='matriculas',
                id_entidad=enrollment_id,
                detalles=f"Nota actualizada en índice {note_index} de asignación {assignment_id}"
            )
        
        matricula_actualizada = matriculas.find_one({'_id': enrollment_obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Nota actualizada exitosamente',
            'enrollment': serialize_doc(matricula_actualizada)
        }), 200
        
    except ValueError:
        return jsonify({'success': False, 'error': 'Valores numéricos inválidos'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/grades/<enrollment_id>/<assignment_id>/<int:note_index>', methods=['DELETE'])
def delete_grade(enrollment_id, assignment_id, note_index):
    """Eliminar una nota específica de una asignación"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        enrollment_obj_id = string_to_objectid(enrollment_id)
        assignment_obj_id = string_to_objectid(assignment_id)
        
        if not enrollment_obj_id or not assignment_obj_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Verificar que la matrícula existe
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Buscar la calificación (con asignación)
        cal_asignacion = None
        cal_index = None
        for idx, cal in enumerate(matricula.get('calificaciones', [])):
            if cal.get('id_asignacion') == assignment_obj_id:
                cal_asignacion = cal
                cal_index = idx
                break
        
        if not cal_asignacion:
            return jsonify({'success': False, 'error': 'Calificación para esta asignación no encontrada'}), 404
        
        notas = cal_asignacion.get('notas', [])
        if note_index < 0 or note_index >= len(notas):
            return jsonify({'success': False, 'error': 'Índice de nota inválido'}), 400
        
        # Eliminar nota del array anidado
        notas.pop(note_index)
        
        # Si no hay más notas, eliminar la calificación completa
        if len(notas) == 0:
            calificaciones = matricula.get('calificaciones', [])
            calificaciones.pop(cal_index)
            matriculas.update_one(
                {'_id': enrollment_obj_id},
                {'$set': {'calificaciones': calificaciones}}
            )
        else:
            # Actualizar solo el array de notas
            matriculas.update_one(
                {
                    '_id': enrollment_obj_id,
                    'calificaciones.id_asignacion': assignment_obj_id
                },
                {'$set': {'calificaciones.$.notas': notas}}
            )
        
        registrar_auditoria(
            id_usuario=None,
            accion='eliminar_calificacion',
            entidad_afectada='matriculas',
            id_entidad=enrollment_id,
            detalles=f"Nota eliminada en índice {note_index} de asignación {assignment_id}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Nota eliminada exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/grades/average/<enrollment_id>/<assignment_id>', methods=['GET'])
def calculate_average(enrollment_id, assignment_id):
    """Calcular el promedio de notas para una asignación específica"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        enrollment_obj_id = string_to_objectid(enrollment_id)
        assignment_obj_id = string_to_objectid(assignment_id)
        
        if not enrollment_obj_id or not assignment_obj_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Buscar matrícula
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Buscar calificación de la asignación
        cal_asignacion = None
        for cal in matricula.get('calificaciones', []):
            if cal.get('id_asignacion') == assignment_obj_id:
                cal_asignacion = cal
                break
        
        if not cal_asignacion:
            return jsonify({
                'success': True,
                'enrollment_id': enrollment_id,
                'assignment_id': assignment_id,
                'average': 0,
                'total_grades': 0,
                'period': None
            }), 200
        
        notas = cal_asignacion.get('notas', [])
        
        if not notas:
            return jsonify({
                'success': True,
                'enrollment_id': enrollment_id,
                'assignment_id': assignment_id,
                'average': 0,
                'total_grades': 0,
                'period': cal_asignacion.get('periodo', '1')
            }), 200
        
        # Calcular promedio ponderado de las notas anidadas
        total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas)
        total_peso = sum(n.get('peso', 0) for n in notas)
        
        promedio = round(total / total_peso, 2) if total_peso > 0 else 0
        estado = 'aprobado' if promedio >= 3.0 else 'reprobado'
        
        return jsonify({
            'success': True,
            'enrollment_id': enrollment_id,
            'assignment_id': assignment_id,
            'average': promedio,
            'total_grades': len(notas),
            'status': estado,
            'period': cal_asignacion.get('periodo', '1'),
            'grades': serialize_doc(notas)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/grades/bulk', methods=['POST'])
def bulk_upload_grades():
    """Carga masiva de calificaciones para un curso"""
    try:
        data = request.get_json()
        
        if not data or 'grades' not in data:
            return jsonify({'success': False, 'error': 'No se proporcionaron calificaciones'}), 400
        
        course_id = data.get('course_id')
        periodo = data.get('periodo')
        tipo_evaluacion = data.get('tipo', 'Evaluación')
        peso = float(data.get('peso', 0.33))
        
        if not course_id:
            return jsonify({'success': False, 'error': 'Se requiere course_id'}), 400
        
        matriculas = get_matriculas_collection()
        asignaciones = get_asignaciones_collection()
        curso_obj_id = string_to_objectid(course_id)
        if not curso_obj_id:
            return jsonify({'success': False, 'error': 'ID de curso inválido'}), 400

        asignaciones_curso = list(asignaciones.find({
            'id_curso': curso_obj_id,
            'activo': True
        }))

        if not asignaciones_curso:
            return jsonify({'success': False, 'error': 'No hay asignaciones activas para este curso'}), 404

        asignacion_por_grupo = {asig['id_grupo']: asig for asig in asignaciones_curso}
        grupos_asignados = list(asignacion_por_grupo.keys())
        
        successful = 0
        failed = 0
        errors = []
        
        # Procesar cada calificación
        for grade_entry in data['grades']:
            try:
                student_id = grade_entry.get('student_id')
                nota = float(grade_entry.get('nota', 0))
                comentarios = grade_entry.get('comentarios', '')
                
                if not student_id:
                    failed += 1
                    errors.append({'error': 'student_id requerido', 'entry': grade_entry})
                    continue
                
                student_obj_id = string_to_objectid(student_id)
                
                # Buscar matrícula activa del estudiante en uno de los grupos del curso
                matricula = matriculas.find_one({
                    'id_estudiante': student_obj_id,
                    'id_grupo': {'$in': grupos_asignados},
                    'estado': 'activa'
                })
                
                if not matricula:
                    failed += 1
                    errors.append({'error': 'Matrícula no encontrada', 'student_id': student_id})
                    continue

                asignacion = asignacion_por_grupo.get(matricula.get('id_grupo'))
                if not asignacion:
                    failed += 1
                    errors.append({'error': 'Asignación no encontrada para el grupo del estudiante', 'student_id': student_id})
                    continue

                periodo_eval = periodo or asignacion.get('periodo', '1')
                
                # Agregar calificación
                nueva_calificacion = {
                    'tipo': tipo_evaluacion,
                    'nota': nota,
                    'nota_maxima': 5.0,
                    'peso': peso,
                    'fecha_eval': datetime.utcnow(),
                    'comentarios': comentarios
                }
                
                # Guardar en la estructura anidada por asignación/periodo
                resultado = matriculas.update_one(
                    {
                        '_id': matricula['_id'],
                        'calificaciones.id_asignacion': asignacion['_id'],
                        'calificaciones.periodo': periodo_eval
                    },
                    {'$push': {'calificaciones.$.notas': nueva_calificacion}}
                )

                if resultado.modified_count == 0:
                    matriculas.update_one(
                        {'_id': matricula['_id']},
                        {
                            '$push': {
                                'calificaciones': {
                                    'id_asignacion': asignacion['_id'],
                                    'periodo': periodo_eval,
                                    'notas': [nueva_calificacion]
                                }
                            }
                        }
                    )
                
                successful += 1
                
            except Exception as e:
                failed += 1
                errors.append({'error': str(e), 'entry': grade_entry})
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='carga_masiva_calificaciones',
            entidad_afectada='matriculas',
            id_entidad=course_id,
            detalles=f"Carga masiva: {successful} exitosas, {failed} fallidas"
        )
        
        return jsonify({
            'success': True,
            'message': 'Carga masiva completada',
            'successful': successful,
            'failed': failed,
            'errors': errors if errors else None
        }), 200 if failed == 0 else 207  # 207 = Multi-Status
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Manejo de errores
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5005)