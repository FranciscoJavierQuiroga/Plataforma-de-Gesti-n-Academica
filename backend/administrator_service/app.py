from flask import Flask, request, jsonify, g
from flask_cors import CORS
from keycloak import KeycloakOpenID
from functools import wraps
import sys
import os
import jwt as pyjwt
from datetime import datetime
from bson.timestamp import Timestamp

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_usuarios_collection,
    get_cursos_collection,
    get_matriculas_collection,
    get_auditoria_collection,
    get_reportes_collection,
    get_asignaciones_collection,
    get_groups_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

app = Flask(__name__)
app.secret_key = "admin_secret_key"

# 🔧 CORS CONFIGURACIÓN COMPLETA
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

# Keycloak config
KEYCLOAK_SERVER = os.getenv('KEYCLOAK_SERVER_URL', 'http://localhost:8082')
KEYCLOAK_CLIENT_ID = os.getenv('KEYCLOAK_CLIENT_ID', '01')
KEYCLOAK_REALM = os.getenv('KEYCLOAK_REALM', 'plataformaInstitucional')
KEYCLOAK_CLIENT_SECRET = os.getenv('KEYCLOAK_CLIENT_SECRET', 'wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz')

keycloak_openid = None
if KeycloakOpenID is not None:
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
    """Comprueba si los claims del token contienen el rol requerido.

    Busca tanto en realm_access como en resource_access[cliente_id].
    """
    try:
        # 1. Buscar en realm_access (roles globales del realm)
        realm_roles = token_info.get('realm_access', {}).get('roles', [])
        if rol_requerido in realm_roles:
            print(f"✓ Rol '{rol_requerido}' encontrado en realm_access")
            return True
        
        # 2. Buscar en resource_access para el cliente específico
        if cliente_id and cliente_id in token_info.get('resource_access', {}):
            client_roles = token_info.get('resource_access', {}).get(cliente_id, {}).get('roles', [])
            if rol_requerido in client_roles:
                print(f"✓ Rol '{rol_requerido}' encontrado en resource_access[{cliente_id}]")
                return True
        
        # 3. Buscar en TODOS los clientes (fallback)
        resource_access = token_info.get('resource_access', {})
        for client_id, client_data in resource_access.items():
            client_roles = client_data.get('roles', [])
            if rol_requerido in client_roles:
                print(f"✓ Rol '{rol_requerido}' encontrado en resource_access[{client_id}]")
                return True
        
        print(f"✗ Rol '{rol_requerido}' NO encontrado. Realm roles: {realm_roles}, Resource access: {list(resource_access.keys())}")
        return False
        
    except Exception as e:
        print(f"Error al verificar rol: {e}")
        import traceback
        traceback.print_exc()
        return False


def token_required(rol_requerido):
    """Decorador que valida la presencia del token y del rol requerido."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Modo desarrollo: permitir token mock
            if keycloak_openid is None:
                auth = request.headers.get('Authorization', '')
                if auth.startswith('Bearer mock-access-token') or auth.startswith('Bearer mock-token-for-admin'):
                    g.userinfo = {'sub': 'admin', 'roles': ['administrador']}
                    return f(*args, **kwargs)
                return jsonify({'error': 'Keycloak no configurado'}), 500

            auth_header = request.headers.get('Authorization', None)
            if not auth_header:
                print("✗ No se encontró header Authorization")
                return jsonify({'error': 'Token Requerido'}), 401
                
            try:
                token = auth_header.split(' ')[1]
                print(f"🔑 Token recibido: {token[:50]}...")
                
                # Intentar decodificar con Keycloak (modo producción)
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
                    print(f"   Usuario: {userinfo.get('preferred_username', 'N/A')}")
                    print(f"   Email: {userinfo.get('email', 'N/A')}")
                    
                except Exception as decode_error:
                    print(f"⚠️ Error decodificando con Keycloak: {decode_error}")
                    # Fallback: decodificar sin verificar firma
                    userinfo = pyjwt.decode(token, options={"verify_signature": False})
                    print("⚠️ Token decodificado SIN verificar firma (modo desarrollo)")
                
            except pyjwt.ExpiredSignatureError:
                print("✗ Token expirado")
                return jsonify({'error': 'Token expirado'}), 401
            except pyjwt.InvalidTokenError as e:
                print(f"✗ Token inválido: {e}")
                return jsonify({'error': 'Token inválido'}), 401
            except Exception as e:
                print(f"✗ Error al decodificar token: {e}")
                import traceback
                traceback.print_exc()
                return jsonify({'error': 'Token inválido o expirado'}), 401
                
            if not tiene_rol(userinfo, KEYCLOAK_CLIENT_ID, rol_requerido):
                print(f"✗ Acceso denegado: se requiere rol '{rol_requerido}'")
                return jsonify({'error': f"Acceso denegado: se requiere el rol '{rol_requerido}'"}), 403

            g.userinfo = userinfo
            return f(*args, **kwargs)
        
        return decorated
    return decorator

@app.route('/')
def home():
    return jsonify({
        'service': 'Administrator Service',
        'version': '2.0.0',
        'database': 'MongoDB'
    })


@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'administrator', 'database': 'MongoDB'})


@app.route('/dashboard')
@token_required('administrador')
def dashboard():
    # ejemplo original para administradores (mantener compatibilidad)
    return jsonify({'message': 'Administrator dashboard', 'time': datetime.utcnow().isoformat() + 'Z'})


@app.route('/admin/pending-tasks')
@token_required('administrador')
def admin_pending_tasks():
    """Tareas pendientes del administrador"""
    try:
        matriculas = get_matriculas_collection()
        usuarios = get_usuarios_collection()
        
        # Contar matrículas pendientes (ejemplo: estado = 'pendiente')
        pending_enrollments = matriculas.count_documents({'estado': 'pendiente'})
        
        # Contar usuarios inactivos que necesitan revisión
        inactive_users = usuarios.count_documents({'activo': False})
        
        tasks = [
            {
                'id': 't1',
                'title': 'Revisión de matrículas pendientes',
                'count': pending_enrollments,
                'severity': 'urgent' if pending_enrollments > 10 else 'normal'
            },
            {
                'id': 't2',
                'title': 'Aprobación de certificados',
                'count': 8,  # Mock por ahora
                'severity': 'normal'
            },
            {
                'id': 't3',
                'title': 'Validación de documentos',
                'count': inactive_users,
                'severity': 'normal'
            },
            {
                'id': 't4',
                'title': 'Asignación de docentes',
                'count': 5,  # Mock por ahora
                'severity': 'urgent'
            }
        ]
        
        return jsonify({'tasks': tasks}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/campuses')
@token_required('administrador')
def admin_campuses():
    """Información de sedes (mock mejorado con datos reales en futuro)"""
    try:
        usuarios = get_usuarios_collection()
        
        # Por ahora mock, pero podrías agregar un campo 'sede' en usuarios
        total_students = usuarios.count_documents({'rol': 'estudiante', 'activo': True})
        
        campuses = [
            {
                'name': 'Sede Principal',
                'students': int(total_students * 0.45),
                'occupancy_pct': 89,
                'status': 'Activa'
            },
            {
                'name': 'Sede Norte',
                'students': int(total_students * 0.35),
                'occupancy_pct': 76,
                'status': 'Activa'
            },
            {
                'name': 'Sede Sur',
                'students': int(total_students * 0.20),
                'occupancy_pct': 45,
                'status': 'Activa'
            }
        ]
        
        return jsonify({'campuses': campuses}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/recent-stats')
@token_required('administrador')
def admin_recent_stats():
    """Estadísticas recientes de matrículas"""
    try:
        matriculas = get_matriculas_collection()
        
        # Agregación por mes (últimos 3 meses)
        pipeline = [
            {
                '$match': {
                    'fecha_matricula': {'$exists': True}
                }
            },
            {
                '$project': {
                    'year': {'$year': '$fecha_matricula'},
                    'month': {'$month': '$fecha_matricula'},
                    'estado': 1
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': '$year',
                        'month': '$month'
                    },
                    'total': {'$sum': 1},
                    'activas': {
                        '$sum': {'$cond': [{'$eq': ['$estado', 'activo']}, 1, 0]}
                    },
                    'retiradas': {
                        '$sum': {'$cond': [{'$eq': ['$estado', 'retirado']}, 1, 0]}
                    }
                }
            },
            {
                '$sort': {'_id.year': -1, '_id.month': -1}
            },
            {
                '$limit': 3
            }
        ]
        
        results = list(matriculas.aggregate(pipeline))
        
        # Formatear resultados
        month_names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        recent = []
        
        for r in results:
            month_num = r['_id']['month']
            year = r['_id']['year']
            recent.append({
                'month': f"{month_names[month_num-1]} {year}",
                'enrollments': r.get('activas', 0),
                'dropouts': r.get('retiradas', 0),
                'avg': 4.1  # Mock, calcular promedio real si tienes calificaciones
            })
        
        # Si no hay datos, devolver mock
        if not recent:
            recent = [
                {'month': 'Nov 2024', 'enrollments': 45, 'dropouts': 3, 'avg': 4.1},
                {'month': 'Oct 2024', 'enrollments': 32, 'dropouts': 7, 'avg': 4.0},
                {'month': 'Sep 2024', 'enrollments': 52, 'dropouts': 5, 'avg': 4.2}
            ]
        
        return jsonify({'recent': recent}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/statistics', methods=['GET'])
@token_required('administrador')
def get_statistics():
    """Obtener estadísticas completas del sistema"""
    try:
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        matriculas = get_matriculas_collection()
        
        # Contar usuarios por rol
        total_estudiantes = usuarios.count_documents({'rol': 'estudiante', 'activo': True})
        total_docentes = usuarios.count_documents({'rol': 'docente', 'activo': True})
        total_administradores = usuarios.count_documents({'rol': 'administrador', 'activo': True})
        
        # Contar cursos activos
        total_cursos = cursos.count_documents({'activo': True})
        
        # Contar matrículas activas
        total_matriculas = matriculas.count_documents({'estado': 'activa'})
        
        # Estadísticas por periodo
        periodos_stats = []
        for periodo in ['1', '2', '3', '4']:
            asignaciones= get_asignaciones_collection()
            cursos_periodo = asignaciones.count_documents({'periodo': periodo, 'activo': True})
            periodos_stats.append({
                'periodo': periodo,
                'cursos': cursos_periodo
            })
        
        return jsonify({
            'success': True,
            'statistics': {
                'usuarios': {
                    'estudiantes': total_estudiantes,
                    'docentes': total_docentes,
                    'administradores': total_administradores,
                    'total': total_estudiantes + total_docentes + total_administradores
                },
                'cursos': {
                    'total': total_cursos,
                    'por_periodo': periodos_stats
                },
                'matriculas': {
                    'activas': total_matriculas
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/users', methods=['GET'])
@token_required('administrador')
def get_all_users():
    """Obtener todos los usuarios del sistema"""
    try:
        usuarios = get_usuarios_collection()
        
        # Filtros opcionales
        rol = request.args.get('rol')
        status = request.args.get('status')
        
        # Construir query
        query = {}
        
        if rol:
            query['rol'] = rol
        if status:
            query['activo'] = (status.lower() == 'active')
        
        # Buscar usuarios
        users = list(usuarios.find(query))
        
        return jsonify({
            'success': True,
            'users': serialize_doc(users),
            'count': len(users)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/audit', methods=['GET'])
@token_required('administrador')
def get_audit_logs():
    """Obtener logs de auditoría"""
    try:
        auditoria = get_auditoria_collection()
        
        # Filtros opcionales
        accion = request.args.get('accion')
        entidad = request.args.get('entidad')
        limit = int(request.args.get('limit', 100))
        
        # Construir query
        query = {}
        
        if accion:
            query['accion'] = accion
        if entidad:
            query['entidad_afectada'] = entidad
        
        # Buscar logs ordenados por fecha descendente
        logs = list(auditoria.find(query).sort('fecha', -1).limit(limit))
        
        return jsonify({
            'success': True,
            'logs': serialize_doc(logs),
            'count': len(logs)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/reports', methods=['GET'])
@token_required('administrador')
def get_reports():
    """Obtener reportes generados"""
    try:
        reportes = get_reportes_collection()
        
        # Filtros opcionales
        tipo = request.args.get('tipo')
        limit = int(request.args.get('limit', 50))
        
        # Construir query
        query = {}
        
        if tipo:
            query['tipo_reporte'] = tipo
        
        # Buscar reportes ordenados por fecha descendente
        reports = list(reportes.find(query).sort('fecha_generado', -1).limit(limit))
        
        return jsonify({
            'success': True,
            'reports': serialize_doc(reports),
            'count': len(reports)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/users/<user_id>/status', methods=['PUT'])
@token_required('administrador')
def update_user_status(user_id):
    """Activar/Desactivar un usuario"""
    try:
        data = request.get_json()
        
        if not data or 'activo' not in data:
            return jsonify({'success': False, 'error': 'Se requiere el campo activo'}), 400
        
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(user_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el usuario existe
        usuario = usuarios.find_one({'_id': obj_id})
        if not usuario:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
        
        # Actualizar estado
        resultado = usuarios.update_one(
            {'_id': obj_id},
            {'$set': {'activo': data['activo']}}
        )
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=g.get('userinfo', {}).get('sub'),
            accion='cambiar_estado_usuario',
            entidad_afectada='usuarios',
            id_entidad=user_id,
            detalles=f"Estado cambiado a: {'activo' if data['activo'] else 'inactivo'}"
        )
        
        return jsonify({
            'success': True,
            'message': f"Usuario {'activado' if data['activo'] else 'desactivado'} exitosamente"
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/dashboard', methods=['GET'])
@token_required('administrador')
def get_dashboard():
    """Obtener datos para el dashboard administrativo"""
    try:
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        matriculas = get_matriculas_collection()
        
        # Estadísticas rápidas
        stats = {
            'usuarios_activos': usuarios.count_documents({'activo': True}),
            'cursos_activos': cursos.count_documents({'activo': True}),
            'matriculas_activas': matriculas.count_documents({'estado': 'activa'}),
            'estudiantes_totales': usuarios.count_documents({'rol': 'estudiante', 'activo': True}),
            'docentes_totales': usuarios.count_documents({'rol': 'docente', 'activo': True})
        }
        
        # Cursos más populares (con más estudiantes)
        pipeline = [
            {'$match': {'estado': 'activa'}},
            {'$group': {
                '_id': '$id_grupo',
                'total_estudiantes': {'$sum': 1},
                'curso_info': {'$first': '$curso_info'}
            }},
            {'$sort': {'total_estudiantes': -1}},
            {'$limit': 5}
        ]
        
        cursos_populares = list(matriculas.aggregate(pipeline))
        
        return jsonify({
            'success': True,
            'dashboard': {
                'statistics': stats,
                'popular_courses': serialize_doc(cursos_populares)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _extract_roles_from_userinfo(userinfo):
    roles = set()
    # caso mock (g.userinfo puede contener 'roles')
    if isinstance(userinfo, dict):
        if 'roles' in userinfo and isinstance(userinfo.get('roles'), (list, tuple)):
            for r in userinfo.get('roles', []):
                roles.add(str(r))

        # realm access
        realm_roles = userinfo.get('realm_access', {}).get('roles', []) if userinfo.get('realm_access') else []
        for r in realm_roles:
            roles.add(str(r))

        # resource access: iterar recursos
        resource_access = userinfo.get('resource_access', {}) or {}
        for client, info in resource_access.items():
            for r in info.get('roles', []):
                roles.add(str(r))

    return roles


def _get_primary_role(userinfo):
    # prioridad: administrador > docente > estudiante
    roles = _extract_roles_from_userinfo(userinfo)
    if 'administrador' in roles or 'admin' in roles:
        return 'administrador'
    if 'docente' in roles or 'teacher' in roles:
        return 'docente'
    if 'estudiante' in roles or 'student' in roles:
        return 'estudiante'
    return None


def _extract_username(userinfo):
    if not isinstance(userinfo, dict):
        return None
    # common claim names
    return userinfo.get('preferred_username') or userinfo.get('username') or userinfo.get('sub')


def auth_required_any(f):
    """Decorador que exige autenticación (cualquier rol), útil para dashboards generales."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # development mock if keycloak not configured
        allowed_roles = {'administrador', 'docente', 'estudiante'}
        if keycloak_openid is None:
            auth = request.headers.get('Authorization', '')
            if auth.startswith('Bearer mock-access-token'):
                g.userinfo = {'sub': 'dev-user', 'roles': ['estudiante']}
            elif auth.startswith('Bearer mock-token-for-admin'):
                g.userinfo = {'sub': 'admin', 'roles': ['administrador']}
            elif auth.startswith('Bearer mock-token-for-docente'):
                g.userinfo = {'sub': 'doc1', 'roles': ['docente']}
            else:
                return jsonify({'error': 'Keycloak no configurado o token mock faltante'}), 500

            # validar rol permitido
            primary = _get_primary_role(g.userinfo)
            if not primary or primary not in allowed_roles:
                return jsonify({'error': 'Acceso denegado: rol no autorizado', 'role': primary}), 403
            return f(*args, **kwargs)

        auth_header = request.headers.get('Authorization', None)
        if not auth_header:
            return jsonify({'error': 'Token Requerido'}), 401
        try:
            token = auth_header.split(' ')[1]
            userinfo = keycloak_openid.decode_token(token)
        except Exception:
            return jsonify({'error': 'Token inválido o expirado'}), 401

        # validar que el usuario tenga un rol reconocido y permitido
        primary = _get_primary_role(userinfo)
        if not primary or primary not in allowed_roles:
            return jsonify({'error': 'Acceso denegado: rol no autorizado', 'role': primary}), 403

        g.userinfo = userinfo
        return f(*args, **kwargs)

    return decorated


@app.route('/dashboard-general')
@auth_required_any
def dashboard_general():
    """Endpoint general que saluda según el rol del usuario autenticado.

    Responde con JSON: { message, role, user, time }
    """
    userinfo = getattr(g, 'userinfo', {}) or {}
    role = _get_primary_role(userinfo) or 'usuario'
    user = _extract_username(userinfo) or 'desconocido'
    mensaje = f"Bienvenido {role}" if role != 'usuario' else 'Bienvenido usuario'
    return jsonify({'message': mensaje, 'role': role, 'user': user, 'time': datetime.utcnow().isoformat() + 'Z'})


# Manejo de errores
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint no encontrado'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

# ==========================================
#   GESTIÓN DE ESTUDIANTES (ADMIN)
# ==========================================

@app.route('/admin/students', methods=['GET'])
@token_required('administrador')
def get_all_students_admin():
    """Obtener todos los estudiantes con filtros"""
    try:
        usuarios = get_usuarios_collection()
        
        # Filtros opcionales
        grado = request.args.get('grado')
        estado = request.args.get('estado')
        search = request.args.get('search')
        
        # Construir query
        query = {'rol': 'estudiante'}
        
        if estado:
            query['activo'] = (estado == 'activo')
        
        if grado:
            grupos = get_groups_collection()
            grupos_grado = [g['_id'] for g in grupos.find({'grado': grado, 'activo': True}, {'_id': 1})]
            query['id_grupo'] = {'$in': grupos_grado}
        
        if search:
            query['$or'] = [
                {'nombres': {'$regex': search, '$options': 'i'}},
                {'apellidos': {'$regex': search, '$options': 'i'}},
                {'codigo_est': {'$regex': search, '$options': 'i'}},
                {'correo': {'$regex': search, '$options': 'i'}}
            ]
        
        # Obtener estudiantes
        students = list(usuarios.find(query))
        
        # ✅ DEVOLVER EN EL CAMPO 'students'
        return jsonify({
            'success': True,
            'students': serialize_doc(students),  # ✅ Cambiar 'data' por 'students'
            'count': len(students)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_all_students_admin: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/admin/students/<student_id>', methods=['GET'])
@token_required('administrador')
def get_student_detail_admin(student_id):
    """Obtener detalle completo de un estudiante"""
    try:
        usuarios = get_usuarios_collection()
        matriculas = get_matriculas_collection()
        
        # Convertir ID
        student_obj_id = string_to_objectid(student_id)
        if not student_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Obtener estudiante
        estudiante = usuarios.find_one({'_id': student_obj_id, 'rol': 'estudiante'})
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        # Obtener matrículas
        student_matriculas = list(matriculas.find({'id_estudiante': student_obj_id}))
        
        return jsonify({
            'success': True,
            'student': serialize_doc(estudiante),
            'enrollments': serialize_doc(student_matriculas),
            'total_enrollments': len(student_matriculas)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/students', methods=['POST'])
@token_required('administrador')
def create_student_admin():
    """Crear nuevo estudiante"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['correo', 'nombres', 'apellidos', 'documento', 'codigo_est']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Campo {field} requerido'}), 400
        
        usuarios = get_usuarios_collection()
        
        # Verificar si ya existe
        if usuarios.find_one({'$or': [
            {'correo': data['correo']},
            {'documento': data['documento']},
            {'codigo_est': data['codigo_est']}
        ]}):
            return jsonify({'success': False, 'error': 'Ya existe un usuario con ese correo, documento o código'}), 400
        
        # Crear estudiante
        nuevo_estudiante = {
            'correo': data['correo'],
            'rol': 'estudiante',
            'nombres': data['nombres'],
            'apellidos': data['apellidos'],
            'documento': data['documento'],
            'tipo_doc': data.get('tipo_doc', 'TI'),
            'codigo_est': data['codigo_est'],
            'fecha_nacimiento': datetime.fromisoformat(data['fecha_nacimiento']) if 'fecha_nacimiento' in data else None,
            'direccion': data.get('direccion', ''),
            'telefono': data.get('telefono', ''),
            'nombre_acudiente': data.get('nombre_acudiente', ''),
            'telefono_acudiente': data.get('telefono_acudiente', ''),
            'correo_acudiente': data.get('correo_acudiente', ''),
            'activo': data.get('activo', True),
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        resultado = usuarios.insert_one(nuevo_estudiante)
        
        # Auditoría
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='crear_estudiante_admin',
            entidad_afectada='usuarios',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Estudiante creado: {data['nombres']} {data['apellidos']}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Estudiante creado exitosamente',
            'student_id': str(resultado.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"❌ Error en create_student_admin: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/students/<student_id>', methods=['PUT'])
@token_required('administrador')
def update_student_admin(student_id):
    """Actualizar estudiante"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        usuarios = get_usuarios_collection()
        
        student_obj_id = string_to_objectid(student_id)
        if not student_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        estudiante = usuarios.find_one({'_id': student_obj_id, 'rol': 'estudiante'})
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        # Campos no modificables
        campos_no_modificables = {'_id', 'rol', 'creado_en'}
        actualizacion = {k: v for k, v in data.items() if k not in campos_no_modificables}
        
        # Convertir fecha si viene
        if 'fecha_nacimiento' in actualizacion:
            actualizacion['fecha_nacimiento'] = datetime.fromisoformat(actualizacion['fecha_nacimiento'])
        
        usuarios.update_one({'_id': student_obj_id}, {'$set': actualizacion})
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='actualizar_estudiante_admin',
            entidad_afectada='usuarios',
            id_entidad=student_id,
            detalles=f"Campos actualizados: {', '.join(actualizacion.keys())}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Estudiante actualizado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/students/<student_id>', methods=['DELETE'])
@token_required('administrador')
def delete_student_admin(student_id):
    """Desactivar estudiante"""
    try:
        usuarios = get_usuarios_collection()
        
        student_obj_id = string_to_objectid(student_id)
        if not student_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        estudiante = usuarios.find_one({'_id': student_obj_id, 'rol': 'estudiante'})
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        usuarios.update_one({'_id': student_obj_id}, {'$set': {'activo': False}})
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='desactivar_estudiante_admin',
            entidad_afectada='usuarios',
            id_entidad=student_id,
            detalles=f"Estudiante desactivado: {estudiante.get('nombres')} {estudiante.get('apellidos')}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Estudiante desactivado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==========================================
#   GESTIÓN DE MATRÍCULAS (ADMIN)
# ==========================================

@app.route('/admin/enrollments', methods=['GET'])
@token_required('administrador')
def get_all_enrollments_admin():
    """Obtener todas las matrículas"""
    try:
        matriculas = get_matriculas_collection()
        
        # Filtros opcionales
        estado = request.args.get('estado')
        grado = request.args.get('grado')
        periodo = request.args.get('periodo')
        
        query = {}
        
        if estado:
            query['estado'] = estado
        
        if grado:
            query['grupo_info.grado'] = grado
        
        if periodo:
            query['periodo'] = periodo
        
        # ✅ Buscar matrículas (estudiante → grupo)
        matriculas_list = list(matriculas.find(query))
        
        print(f"✅ Query: {query}")
        print(f"✅ Encontradas {len(matriculas_list)} matrículas")
        
        # Mostrar ejemplo si hay datos
        if matriculas_list:
            ejemplo = matriculas_list[0]
            print(f"📋 Ejemplo: {ejemplo.get('estudiante_info', {}).get('nombres')} → {ejemplo.get('grupo_info', {}).get('nombre_grupo')}")
        
        return jsonify({
            'success': True,
            'enrollments': serialize_doc(matriculas_list),
            'count': len(matriculas_list)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_all_enrollments_admin: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/admin/enrollments', methods=['POST'])
@token_required('administrador')
def create_enrollment_admin():
    """Crear nueva matrícula"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400

        if 'student_id' not in data:
            return jsonify({'success': False, 'error': 'Campo student_id requerido'}), 400

        # Modelo nuevo: matrícula es por grupo, no por curso.
        if 'group_id' not in data and 'course_id' not in data:
            return jsonify({'success': False, 'error': 'Debe enviar group_id o course_id'}), 400
        
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        grupos = get_groups_collection()
        asignaciones = get_asignaciones_collection()
        matriculas = get_matriculas_collection()
        
        # Convertir IDs
        student_obj_id = string_to_objectid(data['student_id'])
        if not student_obj_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Verificar estudiante
        estudiante = usuarios.find_one({'_id': student_obj_id, 'rol': 'estudiante'})
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        group_obj_id = string_to_objectid(data.get('group_id')) if data.get('group_id') else None
        course_obj_id = string_to_objectid(data.get('course_id')) if data.get('course_id') else None

        # Resolver grupo destino
        if not group_obj_id and course_obj_id:
            # Intentar deducir grupo desde id_grupo actual del estudiante
            if estudiante.get('id_grupo'):
                existe_asignacion = asignaciones.find_one({
                    'id_curso': course_obj_id,
                    'id_grupo': estudiante['id_grupo'],
                    'activo': True
                })
                if existe_asignacion:
                    group_obj_id = estudiante['id_grupo']

            # Fallback: tomar primera asignacion activa del curso
            if not group_obj_id:
                primera = asignaciones.find_one({'id_curso': course_obj_id, 'activo': True})
                if primera:
                    group_obj_id = primera['id_grupo']

        if not group_obj_id:
            return jsonify({'success': False, 'error': 'No se pudo resolver el grupo para la matrícula'}), 400

        grupo = grupos.find_one({'_id': group_obj_id, 'activo': True})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404

        # Verificar si ya existe matrícula activa del estudiante para este año/grupo
        anio_lectivo = data.get('anio_lectivo', '2025')
        if matriculas.find_one({
            'id_estudiante': student_obj_id,
            'anio_lectivo': anio_lectivo,
            'id_grupo': group_obj_id
        }):
            return jsonify({'success': False, 'error': 'El estudiante ya está matriculado en este grupo'}), 400
        
        # Crear matrícula
        nueva_matricula = {
            'id_estudiante': student_obj_id,
            'id_grupo': group_obj_id,
            'anio_lectivo': anio_lectivo,
            'fecha_matricula': Timestamp(int(datetime.utcnow().timestamp()), 0),
            'estado': data.get('estado', 'activa'),
            'calificaciones': [],
            'estudiante_info': {
                'nombres': estudiante.get('nombres'),
                'apellidos': estudiante.get('apellidos'),
                'codigo_est': estudiante.get('codigo_est')
            },
            'grupo_info': {
                'nombre_grupo': grupo.get('nombre_grupo'),
                'grado': grupo.get('grado'),
                'jornada': grupo.get('jornada')
            },
            'observaciones_admin': data.get('observaciones', '')
        }
        
        resultado = matriculas.insert_one(nueva_matricula)
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='crear_matricula_admin',
            entidad_afectada='matriculas',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Matrícula creada: {estudiante.get('codigo_est')} en grupo {grupo.get('nombre_grupo')}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Matrícula creada exitosamente',
            'enrollment_id': str(resultado.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"❌ Error en create_enrollment_admin: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/enrollments/<enrollment_id>/status', methods=['PUT'])
@token_required('administrador')
def update_enrollment_status(enrollment_id):
    """Cambiar estado de matrícula (aprobar, rechazar, cancelar)"""
    try:
        data = request.get_json()
        
        if 'estado' not in data:
            return jsonify({'success': False, 'error': 'Campo estado requerido'}), 400
        
        # Estados válidos según schema actual
        normalizacion_estados = {
            'activo': 'activa',
            'activa': 'activa',
            'inactivo': 'inactiva',
            'inactiva': 'inactiva',
            'retirado': 'retirada',
            'retirada': 'retirada'
        }
        estado_nuevo = normalizacion_estados.get(data['estado'])
        if not estado_nuevo:
            return jsonify({'success': False, 'error': 'Estado inválido'}), 400
        
        matriculas = get_matriculas_collection()
        
        enrollment_obj_id = string_to_objectid(enrollment_id)
        if not enrollment_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Actualizar estado
        actualizacion = {
            'estado': estado_nuevo,
            'fecha_actualizacion_estado': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        if 'observaciones_admin' in data:
            actualizacion['observaciones_admin'] = data['observaciones_admin']
        
        matriculas.update_one({'_id': enrollment_obj_id}, {'$set': actualizacion})
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='cambiar_estado_matricula',
            entidad_afectada='matriculas',
            id_entidad=enrollment_id,
            detalles=f"Estado cambiado a: {estado_nuevo}"
        )
        
        return jsonify({
            'success': True,
            'message': f"Estado de matrícula actualizado a: {estado_nuevo}"
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
#   GESTIÓN DE CURSOS/GRUPOS (ADMIN)
# ==========================================

@app.route('/admin/courses', methods=['GET'])
@token_required('administrador')
def get_all_courses_admin():
    """Obtener todas las asignaciones docentes (cursos asignados a grupos)"""
    try:
        from database.db_config import get_asignaciones_collection
        
        asignaciones = get_asignaciones_collection()
        
        # Filtros opcionales
        grado = request.args.get('grado')
        periodo = request.args.get('periodo')
        activo = request.args.get('activo', 'true').lower() == 'true'
        
        query = {'activo': activo}
        
        if grado:
            query['grupo_info.grado'] = grado
        
        if periodo:
            query['periodo'] = periodo
        
        # Buscar asignaciones
        asignaciones_list = list(asignaciones.find(query))
        
        print(f"✅ Encontradas {len(asignaciones_list)} asignaciones")
        
        # Formatear para el frontend (mantener compatibilidad)
        courses = []
        for asig in asignaciones_list:
            course = {
                '_id': str(asig['_id']),
                'codigo_curso': asig['curso_info'].get('codigo_curso', 'N/A'),
                'nombre_curso': asig['curso_info'].get('nombre_curso', 'Sin nombre'),
                'grado': asig['grupo_info'].get('grado', 'N/A'),
                'periodo': asig.get('periodo', '1'),
                'grupo': asig['grupo_info'].get('nombre_grupo', 'Sin grupo'),
                'activo': asig.get('activo', True),
                'docente_info': asig.get('docente_info', {})
            }
            courses.append(course)
        
        return jsonify({
            'success': True,
            'courses': courses,
            'count': len(courses)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_all_courses_admin: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/admin/courses/<course_id>', methods=['GET'])
@token_required('administrador')
def get_course_detail_admin(course_id):
    """Obtener detalle completo de un curso"""
    try:
        cursos = get_cursos_collection()
        matriculas = get_matriculas_collection()
        
        # Convertir ID
        course_obj_id = string_to_objectid(course_id)
        if not course_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Obtener curso
        curso = cursos.find_one({'_id': course_obj_id})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado'}), 404
        
        # Obtener estudiantes matriculados en grupos donde se dicta este curso
        asignaciones = get_asignaciones_collection()
        grupos_ids = asignaciones.distinct('id_grupo', {
            'id_curso': course_obj_id,
            'activo': True
        })

        students_enrolled = list(matriculas.find({
            'id_grupo': {'$in': grupos_ids},
            'estado': {'$in': ['activa', 'activo']}
        }))
        
        return jsonify({
            'success': True,
            'course': serialize_doc(curso),
            'students_enrolled': serialize_doc(students_enrolled),
            'total_students': len(students_enrolled)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/courses', methods=['POST'])
@token_required('administrador')
def create_course_admin():
    """Crear nueva asignación docente (grupo + curso + docente + período)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # ✅ Validar campos requeridos
        required_fields = ['group_id', 'course_id', 'teacher_id', 'periodo']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Campo {field} requerido'}), 400
        
        from database.db_config import get_groups_collection
        
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        grupos = get_groups_collection()
        
        # Convertir IDs
        group_obj_id = string_to_objectid(data['group_id'])
        course_obj_id = string_to_objectid(data['course_id'])
        teacher_obj_id = string_to_objectid(data['teacher_id'])
        
        if not all([group_obj_id, course_obj_id, teacher_obj_id]):
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Verificar que existan
        grupo = grupos.find_one({'_id': group_obj_id})
        curso = cursos.find_one({'_id': course_obj_id})
        docente = usuarios.find_one({'_id': teacher_obj_id, 'rol': 'docente'})
        
        if not grupo or not curso or not docente:
            return jsonify({'success': False, 'error': 'Grupo, curso o docente no encontrado'}), 404
        
        # ✅ Verificar que no exista ya esta asignación
        from database.db_config import get_asignaciones_collection
        asignaciones = get_asignaciones_collection()
        
        if asignaciones.find_one({
            'id_grupo': group_obj_id,
            'id_curso': course_obj_id,
            'periodo': data['periodo']
        }):
            return jsonify({'success': False, 'error': 'Ya existe esta asignación para este grupo y período'}), 400
        
        # ✅ Crear asignación docente
        nueva_asignacion = {
            'id_grupo': group_obj_id,
            'id_curso': course_obj_id,
            'id_docente': teacher_obj_id,
            'periodo': data['periodo'],
            'anio_lectivo': data.get('anio_lectivo', '2025'),
            'grupo_info': {
                'nombre_grupo': grupo['nombre_grupo'],
                'grado': grupo['grado'],
                'jornada': grupo['jornada']
            },
            'curso_info': {
                'nombre_curso': curso['nombre_curso'],
                'codigo_curso': curso['codigo_curso'],
                'area': curso.get('area', '')
            },
            'docente_info': {
                'nombres': docente['nombres'],
                'apellidos': docente['apellidos'],
                'codigo_docente': docente.get('codigo_docente', ''),
                'especialidad': docente.get('especialidad', '')
            },
            'salon_asignado': data.get('salon', grupo.get('salon_principal', '')),
            'activo': True,
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        resultado = asignaciones.insert_one(nueva_asignacion)
        
        # Auditoría
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='crear_asignacion_docente',
            entidad_afectada='asignaciones_docentes',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Asignación creada: {curso['nombre_curso']} para {grupo['nombre_grupo']} - Período {data['periodo']}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Asignación docente creada exitosamente',
            'assignment_id': str(resultado.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"❌ Error en create_course_admin: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
# ==========================================
#   ENDPOINTS: ASIGNACIONES DOCENTES
# ==========================================

@app.route('/admin/assignments', methods=['GET'])
@token_required('administrador')
def get_assignments():
    """Obtener todas las asignaciones docentes"""
    try:
        from database.db_config import get_asignaciones_collection
        asignaciones = get_asignaciones_collection()
        
        # Filtros opcionales
        group_id = request.args.get('group_id')
        teacher_id = request.args.get('teacher_id')
        periodo = request.args.get('periodo')
        
        query = {'activo': True}
        
        if group_id:
            group_obj_id = string_to_objectid(group_id)
            if group_obj_id:
                query['id_grupo'] = group_obj_id
        
        if teacher_id:
            teacher_obj_id = string_to_objectid(teacher_id)
            if teacher_obj_id:
                query['id_docente'] = teacher_obj_id
        
        if periodo:
            query['periodo'] = periodo
        
        asignaciones_list = list(asignaciones.find(query))
        
        return jsonify({
            'success': True,
            'data': serialize_doc(asignaciones_list),
            'count': len(asignaciones_list)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_assignments: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/groups/<group_id>/assignments', methods=['GET'])
@token_required('administrador')
def get_group_assignments(group_id):
    """Obtener asignaciones de un grupo específico"""
    try:
        from database.db_config import get_asignaciones_collection
        asignaciones = get_asignaciones_collection()
        
        group_obj_id = string_to_objectid(group_id)
        if not group_obj_id:
            return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400
        
        periodo = request.args.get('periodo', '1')
        
        asignaciones_list = list(asignaciones.find({
            'id_grupo': group_obj_id,
            'periodo': periodo,
            'activo': True
        }))
        
        return jsonify({
            'success': True,
            'data': serialize_doc(asignaciones_list),
            'count': len(asignaciones_list)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_group_assignments: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/assignments/<assignment_id>', methods=['DELETE'])
@token_required('administrador')
def delete_assignment(assignment_id):
    """Eliminar (desactivar) una asignación docente"""
    try:
        from database.db_config import get_asignaciones_collection
        asignaciones = get_asignaciones_collection()
        
        assignment_obj_id = string_to_objectid(assignment_id)
        if not assignment_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        resultado = asignaciones.update_one(
            {'_id': assignment_obj_id},
            {'$set': {'activo': False}}
        )
        
        if resultado.modified_count > 0:
            registrar_auditoria(
                id_usuario=g.userinfo.get('sub'),
                accion='eliminar_asignacion',
                entidad_afectada='asignaciones_docentes',
                id_entidad=assignment_id,
                detalles='Asignación desactivada'
            )
            
            return jsonify({
                'success': True,
                'message': 'Asignación eliminada exitosamente'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Asignación no encontrada'}), 404
        
    except Exception as e:
        print(f"❌ Error en delete_assignment: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/admin/courses/<course_id>', methods=['PUT'])
@token_required('administrador')
def update_course_admin(course_id):
    """Actualizar curso/grupo"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        cursos = get_cursos_collection()
        usuarios = get_usuarios_collection()
        
        course_obj_id = string_to_objectid(course_id)
        if not course_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        curso = cursos.find_one({'_id': course_obj_id})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado'}), 404
        
        # Campos no modificables
        campos_no_modificables = {'_id', 'creado_en'}
        actualizacion = {k: v for k, v in data.items() if k not in campos_no_modificables}
        
        # Si se actualiza el docente
        if 'teacher_id' in data:
            if data['teacher_id']:
                teacher_obj_id = string_to_objectid(data['teacher_id'])
                if teacher_obj_id:
                    docente = usuarios.find_one({'_id': teacher_obj_id, 'rol': 'docente'})
                    if docente:
                        actualizacion['id_docente'] = teacher_obj_id
                        actualizacion['docente_info'] = {
                            'nombres': docente.get('nombres'),
                            'apellidos': docente.get('apellidos'),
                            'codigo_docente': docente.get('codigo_docente', '')
                        }
            else:
                # Remover docente
                actualizacion['id_docente'] = None
                actualizacion['docente_info'] = {}
            
            del actualizacion['teacher_id']
        
        cursos.update_one({'_id': course_obj_id}, {'$set': actualizacion})
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='actualizar_curso_admin',
            entidad_afectada='cursos',
            id_entidad=course_id,
            detalles=f"Campos actualizados: {', '.join(actualizacion.keys())}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Curso actualizado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/courses/<course_id>', methods=['DELETE'])
@token_required('administrador')
def delete_course_admin(course_id):
    """Desactivar curso"""
    try:
        cursos = get_cursos_collection()
        
        course_obj_id = string_to_objectid(course_id)
        if not course_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        curso = cursos.find_one({'_id': course_obj_id})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado'}), 404
        
        cursos.update_one({'_id': course_obj_id}, {'$set': {'activo': False}})
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='desactivar_curso_admin',
            entidad_afectada='cursos',
            id_entidad=course_id,
            detalles=f"Curso desactivado: {curso.get('codigo_curso')}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Curso desactivado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/courses/<course_id>/assign-teacher', methods=['PUT'])
@token_required('administrador')
def assign_teacher_to_course(course_id):
    """Asignar docente a un curso"""
    try:
        data = request.get_json()
        
        if 'teacher_id' not in data:
            return jsonify({'success': False, 'error': 'teacher_id requerido'}), 400
        
        cursos = get_cursos_collection()
        usuarios = get_usuarios_collection()
        
        # Convertir IDs
        course_obj_id = string_to_objectid(course_id)
        teacher_obj_id = string_to_objectid(data['teacher_id'])
        
        if not course_obj_id or not teacher_obj_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Verificar curso
        curso = cursos.find_one({'_id': course_obj_id})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado'}), 404
        
        # Verificar docente
        docente = usuarios.find_one({'_id': teacher_obj_id, 'rol': 'docente'})
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Actualizar curso
        actualizacion = {
            'id_docente': teacher_obj_id,
            'docente_info': {
                'nombres': docente.get('nombres'),
                'apellidos': docente.get('apellidos'),
                'codigo_docente': docente.get('codigo_docente', '')
            }
        }
        
        cursos.update_one({'_id': course_obj_id}, {'$set': actualizacion})
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='asignar_docente_curso',
            entidad_afectada='cursos',
            id_entidad=course_id,
            detalles=f"Docente {docente.get('nombres')} {docente.get('apellidos')} asignado a {curso.get('codigo_curso')}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Docente asignado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==========================================
#   REPORTES ADMINISTRATIVOS
# ==========================================

@app.route('/admin/reports/students-by-grade', methods=['GET'])
@token_required('administrador')
def report_students_by_grade():
    """Reporte: Cantidad de estudiantes por grado"""
    try:
        matriculas = get_matriculas_collection()
        
        # ✅ Agrupar por grado desde grupo_info
        pipeline = [
            {'$match': {'estado': 'activa'}},  # ✅ CAMBIO: 'activo' → 'activa'
            {'$group': {
                '_id': '$grupo_info.grado',  # ✅ Usar grupo_info.grado
                'total_estudiantes': {'$sum': 1}
            }},
            {'$sort': {'_id': 1}}
        ]
        
        results = list(matriculas.aggregate(pipeline))
        
        print(f"✅ Reporte estudiantes por grado: {len(results)} grados")
        if results:
            print(f"📋 Ejemplo: Grado {results[0]['_id']} → {results[0]['total_estudiantes']} estudiantes")
        
        return jsonify({
            'success': True,
            'report': serialize_doc(results),
            'total_grades': len(results)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en report_students_by_grade: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/admin/reports/performance-by-course', methods=['GET'])
@token_required('administrador')
def report_performance_by_course():
    """Reporte: Desempeño promedio por curso"""
    try:
        matriculas = get_matriculas_collection()
        
        # Estructura actual: calificaciones[].notas[] por id_asignacion
        pipeline = [
            {'$match': {'estado': {'$in': ['activa', 'activo']}, 'calificaciones': {'$exists': True, '$ne': []}}},
            {'$unwind': '$calificaciones'},
            {'$unwind': '$calificaciones.notas'},
            {'$lookup': {
                'from': 'asignaciones_docentes',
                'localField': 'calificaciones.id_asignacion',
                'foreignField': '_id',
                'as': 'asig'
            }},
            {'$unwind': '$asig'},
            {'$group': {
                '_id': {
                    'curso_id': '$asig.id_curso',
                    'nombre_curso': '$asig.curso_info.nombre_curso',
                    'codigo_curso': '$asig.curso_info.codigo_curso'
                },
                'promedio': {'$avg': '$calificaciones.notas.nota'},
                'total_calificaciones': {'$sum': 1},
                'total_estudiantes': {'$addToSet': '$id_estudiante'}
            }},
            {'$project': {
                '_id': 0,
                'curso_id': '$_id.curso_id',
                'nombre_curso': '$_id.nombre_curso',
                'codigo_curso': '$_id.codigo_curso',
                'promedio': {'$round': ['$promedio', 2]},
                'total_calificaciones': 1,
                'total_estudiantes': {'$size': '$total_estudiantes'}
            }},
            {'$sort': {'promedio': -1}}
        ]
        
        results = list(matriculas.aggregate(pipeline))
        
        return jsonify({
            'success': True,
            'report': serialize_doc(results),
            'total_courses': len(results)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/reports/teacher-workload', methods=['GET'])
@token_required('administrador')
def report_teacher_workload():
    """Reporte: Carga académica por docente"""
    try:
        cursos = get_cursos_collection()
        asignaciones = get_asignaciones_collection()
        matriculas = get_matriculas_collection()

        pipeline_cursos = [
            {'$match': {'activo': True}},
            {'$group': {
                '_id': '$id_docente',
                'docente_info': {'$first': '$docente_info'},
                'total_cursos': {'$sum': 1},
                'grupos': {'$addToSet': '$id_grupo'},
                'cursos': {'$push': {
                    'nombre': '$curso_info.nombre_curso',
                    'codigo': '$curso_info.codigo_curso',
                    'grado': '$grupo_info.grado'
                }}
            }}
        ]

        results = list(asignaciones.aggregate(pipeline_cursos))

        for docente_data in results:
            total_estudiantes = matriculas.count_documents({
                'id_grupo': {'$in': docente_data.get('grupos', [])},
                'estado': {'$in': ['activa', 'activo']}
            })
            docente_data['total_estudiantes'] = total_estudiantes
            docente_data.pop('grupos', None)
        
        return jsonify({
            'success': True,
            'report': serialize_doc(results),
            'total_teachers': len(results)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/reports/enrollment-history', methods=['GET'])
@token_required('administrador')
def report_enrollment_history():
    """Reporte: Historial de matrículas por mes/año"""
    try:
        matriculas = get_matriculas_collection()
        
        # ✅ AGRUPAR POR MES/AÑO DE fecha_matricula
        pipeline = [
            {
                '$addFields': {
                    'fecha_date': {
                        '$cond': {
                            'if': {'$eq': [{'$type': '$fecha_matricula'}, 'timestamp']},
                            'then': {'$toDate': '$fecha_matricula'},
                            'else': {'$toDate': {'$multiply': ['$fecha_matricula.t', 1000]}}
                        }
                    }
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': {'$year': '$fecha_date'},
                        'month': {'$month': '$fecha_date'}
                    },
                    'total_matriculas': {'$sum': 1}
                }
            },
            {
                '$sort': {'_id.year': 1, '_id.month': 1}
            },
            {
                '$project': {
                    '_id': 0,
                    'periodo': {
                        '$concat': [
                            {'$toString': '$_id.month'},
                            '/',
                            {'$toString': '$_id.year'}
                        ]
                    },
                    'year': '$_id.year',
                    'month': '$_id.month',
                    'total_matriculas': 1
                }
            }
        ]
        
        results = list(matriculas.aggregate(pipeline))
        
        print(f"✅ Reporte historial matrículas: {len(results)} periodos")
        
        # Si no hay datos, generar datos de ejemplo
        if not results:
            from datetime import datetime, timedelta
            now = datetime.now()
            results = []
            
            for i in range(5, -1, -1):
                fecha = now - timedelta(days=i*30)
                results.append({
                    'periodo': f"{fecha.month}/{fecha.year}",
                    'year': fecha.year,
                    'month': fecha.month,
                    'total_matriculas': 0
                })
        
        return jsonify({
            'success': True,
            'report': results
        }), 200
        
    except Exception as e:
        print(f"❌ Error en report_enrollment_history: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/admin/reports/academic-statistics', methods=['GET'])
@token_required('administrador')
def report_academic_statistics():
    """Reporte completo de estadísticas académicas"""
    try:
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        matriculas = get_matriculas_collection()
        
        # Estadísticas generales
        stats = {
            'estudiantes': {
                'activos': usuarios.count_documents({'rol': 'estudiante', 'activo': True}),
                'inactivos': usuarios.count_documents({'rol': 'estudiante', 'activo': False})
            },
            'docentes': {
                'activos': usuarios.count_documents({'rol': 'docente', 'activo': True}),
                'inactivos': usuarios.count_documents({'rol': 'docente', 'activo': False})
            },
            'cursos': {
                'activos': cursos.count_documents({'activo': True}),
                'inactivos': cursos.count_documents({'activo': False})
            },
            'matriculas': {
                'activas': matriculas.count_documents({'estado': {'$in': ['activa', 'activo']}}),
                'inactivas': matriculas.count_documents({'estado': {'$in': ['inactiva', 'inactivo']}}),
                'retiradas': matriculas.count_documents({'estado': {'$in': ['retirada', 'retirado']}})
            }
        }
        
        # Distribución por grado
        pipeline_grados = [
            {'$match': {'estado': {'$in': ['activa', 'activo']}}},
            {'$group': {
                '_id': '$grupo_info.grado',
                'total': {'$sum': 1}
            }},
            {'$sort': {'_id': 1}}
        ]
        
        distribucion_grados = list(matriculas.aggregate(pipeline_grados))
        
        # Cursos más demandados
        pipeline_cursos = [
            {'$match': {'estado': {'$in': ['activa', 'activo']}}},
            {'$group': {
                '_id': '$id_grupo',
                'nombre_grupo': {'$first': '$grupo_info.nombre_grupo'},
                'grado': {'$first': '$grupo_info.grado'},
                'total_estudiantes': {'$sum': 1}
            }},
            {'$sort': {'total_estudiantes': -1}},
            {'$limit': 10}
        ]
        
        cursos_populares = list(matriculas.aggregate(pipeline_cursos))
        
        return jsonify({
            'success': True,
            'statistics': stats,
            'distribucion_por_grado': serialize_doc(distribucion_grados),
            'cursos_mas_demandados': serialize_doc(cursos_populares),
            'fecha_generacion': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==========================================
#   GESTIÓN DE DOCENTES (ADMIN)
# ==========================================

@app.route('/admin/teachers', methods=['GET'])
@token_required('administrador')
def get_all_teachers_admin():
    """Obtener todos los docentes"""
    try:
        usuarios = get_usuarios_collection()
        asignaciones = get_asignaciones_collection()
        
        # Filtros
        estado = request.args.get('estado')
        
        query = {'rol': 'docente'}
        
        if estado:
            query['activo'] = (estado == 'activo')
        
        # Obtener docentes
        teachers = list(usuarios.find(query).sort('apellidos', 1))
        
        # Para cada docente, contar cursos asignados
        for teacher in teachers:
            teacher_id = teacher['_id']
            total_cursos = asignaciones.count_documents({'id_docente': teacher_id, 'activo': True})
            teacher['total_cursos_asignados'] = total_cursos
        
        return jsonify({
            'success': True,
            'teachers': serialize_doc(teachers),
            'count': len(teachers)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/admin/stats', methods=['GET'])
@token_required('administrador')
def get_admin_stats():
    """Obtener estadísticas para el dashboard"""
    try:
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        matriculas = get_matriculas_collection()
        
        # Contar estudiantes activos
        total_estudiantes = usuarios.count_documents({'rol': 'estudiante', 'activo': True})
        
        # Contar docentes activos
        total_docentes = usuarios.count_documents({'rol': 'docente', 'activo': True})
        
        # Contar cursos activos
        total_cursos = cursos.count_documents({'activo': True})
        
        # Contar matrículas activas
        total_matriculas = matriculas.count_documents({'estado': {'$in': ['activa', 'activo']}})
        
        # En el modelo actual no hay estado pendiente como flujo principal
        matriculas_pendientes = 0
        
        # ✅ Devolver en el formato que espera el frontend
        return jsonify({
            'success': True,
            'total_estudiantes': total_estudiantes,
            'total_docentes': total_docentes,
            'total_cursos': total_cursos,
            'total_matriculas': total_matriculas,
            'matriculas_pendientes': matriculas_pendientes
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_admin_stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003, debug=True)
