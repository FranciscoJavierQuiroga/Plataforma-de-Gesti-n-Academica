from flask import Flask, request, jsonify, g
from flask_cors import CORS
from datetime import datetime
from bson.timestamp import Timestamp
from keycloak import KeycloakOpenID
from functools import wraps
import jwt as pyjwt
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_usuarios_collection,
    get_cursos_collection,
    get_matriculas_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria,
    get_groups_collection,
    get_horarios_collection
)

app = Flask(__name__)
app.secret_key = "GruposService"

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


def token_required(roles_permitidos=None):
    """Decorador que valida la presencia del token y del rol requerido.
    
    Args:
        roles_permitidos: str, list o None. Rol(es) permitido(s) para acceder al endpoint.
    """
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
            
            # ✅ VALIDAR ROL SI SE ESPECIFICÓ
            if roles_permitidos is not None:
                # Convertir a lista si es string
                if isinstance(roles_permitidos, str):
                    roles_list = [roles_permitidos]
                elif isinstance(roles_permitidos, list):
                    roles_list = roles_permitidos
                else:
                    print(f"⚠️ roles_permitidos tiene tipo inválido: {type(roles_permitidos)}")
                    roles_list = []
                
                print(f"🔍 Verificando roles permitidos: {roles_list}")
                
                # Verificar si el usuario tiene al menos uno de los roles permitidos
                tiene_acceso = False
                for rol in roles_list:
                    if tiene_rol(userinfo, KEYCLOAK_CLIENT_ID, rol):
                        print(f"✅ Usuario tiene el rol '{rol}'")
                        tiene_acceso = True
                        break
                
                if not tiene_acceso:
                    print(f"✗ Acceso denegado: se requiere uno de estos roles: {roles_list}")
                    return jsonify({
                        'error': f"Acceso denegado: se requiere uno de los siguientes roles: {', '.join(roles_list)}"
                    }), 403

            g.userinfo = userinfo
            return f(*args, **kwargs)
        
        return decorated
    return decorator


# ==========================================
#   ENDPOINTS DE GRUPOS
# ==========================================

@app.route('/groups', methods=['GET'])
@token_required(['administrador', 'docente'])
def get_all_groups():
    """Obtener todos los grupos"""
    try:
        grupos = get_groups_collection()
        
        # Filtros opcionales
        grado = request.args.get('grado')
        activo = request.args.get('activo')
        
        query = {}
        if grado:
            query['grado'] = grado
        if activo is not None:
            query['activo'] = activo.lower() == 'true'
        
        lista_grupos = list(grupos.find(query))
        
        # Agregar información de docente director
        usuarios = get_usuarios_collection()
        for grupo in lista_grupos:
            if grupo.get('director_grupo'):
                docente = usuarios.find_one({'_id': grupo['director_grupo']})
                if docente:
                    grupo['director_info'] = {
                        'nombres': docente.get('nombres'),
                        'apellidos': docente.get('apellidos'),
                        'especialidad': docente.get('especialidad')
                    }
        
        return jsonify({
            'success': True,
            'data': serialize_doc(lista_grupos),
            'count': len(lista_grupos)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_all_groups: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/groups', methods=['POST'])
def create_group():
    """Crear un nuevo grupo"""
    try:
        data = request.get_json()
        
        # Validar campos requeridos
        required = ['nombre_grupo', 'grado', 'jornada', 'año_lectivo']
        for field in required:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo requerido: {field}'
                }), 400
        
        grupos = get_groups_collection()
        
        # Verificar que no exista un grupo con el mismo nombre en el mismo año
        if grupos.find_one({
            'nombre_grupo': data['nombre_grupo'],
            'año_lectivo': data['año_lectivo']
        }):
            return jsonify({
                'success': False,
                'error': 'Ya existe un grupo con este nombre en el año lectivo'
            }), 400
        
        # Crear grupo
        nuevo_grupo = {
            'nombre_grupo': data['nombre_grupo'],
            'grado': data['grado'],
            'jornada': data['jornada'],
            'año_lectivo': data['año_lectivo'],
            'capacidad_max': data.get('capacidad_max', 40),
            'activo': data.get('activo', True),
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        if data.get('director_grupo'):
            nuevo_grupo['director_grupo'] = string_to_objectid(data['director_grupo'])
        
        resultado = grupos.insert_one(nuevo_grupo)
        
        registrar_auditoria(
            id_usuario=None,
            accion='crear_grupo',
            entidad_afectada='grupos',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Grupo creado: {data['nombre_grupo']}"
        )
        
        grupo_creado = grupos.find_one({'_id': resultado.inserted_id})
        
        return jsonify({
            'success': True,
            'message': 'Grupo creado exitosamente',
            'data': serialize_doc(grupo_creado)
        }), 201
        
    except Exception as e:
        print(f"❌ Error en create_group: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
@app.route('/groups/<group_id>', methods=['GET', 'OPTIONS'])
@token_required(['administrador', 'docente'])
def get_group_detail(group_id):
    """Obtener detalles de un grupo específico"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        grupos = get_groups_collection()
        
        # Convertir ID a ObjectId
        group_obj_id = string_to_objectid(group_id)
        if not group_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Buscar grupo
        grupo = grupos.find_one({'_id': group_obj_id})
        
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        # Obtener información del docente director si existe
        if grupo.get('director_grupo'):
            usuarios = get_usuarios_collection()
            docente = usuarios.find_one({'_id': grupo['director_grupo']})
            if docente:
                grupo['director_info'] = {
                    'nombres': docente.get('nombres'),
                    'apellidos': docente.get('apellidos'),
                    'especialidad': docente.get('especialidad')
                }
        
        # Contar estudiantes matriculados activos
        from database.db_config import get_matriculas_collection
        matriculas = get_matriculas_collection()
        
        num_estudiantes = matriculas.count_documents({
            'id_grupo': group_obj_id,
            'estado': 'activa'
        })
        
        grupo['estudiantes_actuales'] = num_estudiantes
        
        return jsonify({
            'success': True,
            'group': serialize_doc(grupo)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_group_detail: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
#   ENDPOINT: HORARIOS DE GRUPOS
# ==========================================

@app.route('/groups/<group_id>/schedule', methods=['GET'])
@token_required(['administrador', 'docente'])
def get_group_schedule(group_id):
    """Obtener horario de un grupo específico"""
    try:
        from database.db_config import get_horarios_collection
        
        horarios = get_horarios_collection()
        grupos = get_groups_collection()
        
        # Verificar que el grupo existe
        group_obj_id = string_to_objectid(group_id)
        if not group_obj_id:
            return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400
        
        grupo = grupos.find_one({'_id': group_obj_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        # Buscar horario del grupo
        horario = horarios.find_one({
            'id_grupo': group_obj_id,
            'activo': True
        })
        
        if not horario:
            # Crear horario vacío si no existe
            return jsonify({
                'success': True,
                'bloques': [],
                'message': 'Grupo sin horario asignado'
            }), 200
        
        # Serializar y devolver
        bloques = horario.get('bloques', [])
        
        return jsonify({
            'success': True,
            'bloques': serialize_doc(bloques),
            'grupo_info': {
                'nombre_grupo': grupo['nombre_grupo'],
                'grado': grupo['grado'],
                'jornada': grupo.get('jornada', 'mañana')
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_group_schedule: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/groups/<group_id>/schedule', methods=['POST'])
@token_required('administrador')
def update_group_schedule(group_id):
    """Actualizar horario de un grupo"""
    try:
        from database.db_config import get_horarios_collection, get_asignaciones_collection
        
        data = request.get_json()
        
        if not data or 'bloques' not in data:
            return jsonify({'success': False, 'error': 'Bloques requeridos'}), 400
        
        horarios = get_horarios_collection()
        grupos = get_groups_collection()
        
        group_obj_id = string_to_objectid(group_id)
        if not group_obj_id:
            return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400
        
        grupo = grupos.find_one({'_id': group_obj_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        # Procesar bloques
        bloques = data['bloques']
        bloques_procesados = []
        
        for bloque in bloques:
            bloque_procesado = {
                'dia': bloque['dia'],
                'hora_inicio': bloque['hora_inicio'],
                'hora_fin': bloque['hora_fin'],
                'tipo': bloque.get('tipo', 'libre'),  # clase, descanso, libre
                'orden': bloque.get('orden', 0)
            }
            
            # Si es una clase, agregar info de asignación
            if bloque.get('id_asignacion'):
                assignment_obj_id = string_to_objectid(bloque['id_asignacion'])
                if assignment_obj_id:
                    asignaciones = get_asignaciones_collection()
                    asignacion = asignaciones.find_one({'_id': assignment_obj_id})
                    
                    if asignacion:
                        bloque_procesado['id_asignacion'] = assignment_obj_id
                        bloque_procesado['tipo'] = 'clase'
                        bloque_procesado['curso_info'] = asignacion.get('curso_info', {})
                        bloque_procesado['docente_info'] = asignacion.get('docente_info', {})
                        bloque_procesado['salon'] = asignacion.get('salon_asignado', '')
            
            bloques_procesados.append(bloque_procesado)
        
        # Actualizar o crear horario
        horario_existente = horarios.find_one({'id_grupo': group_obj_id})
        
        if horario_existente:
            # Actualizar
            resultado = horarios.update_one(
                {'_id': horario_existente['_id']},
                {
                    '$set': {
                        'bloques': bloques_procesados,
                        'actualizado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
                    }
                }
            )
            message = 'Horario actualizado exitosamente'
        else:
            # Crear nuevo
            nuevo_horario = {
                'id_grupo': group_obj_id,
                'grupo_info': {
                    'nombre_grupo': grupo['nombre_grupo'],
                    'grado': grupo['grado']
                },
                'año_lectivo': data.get('anio_lectivo', '2025'),
                'bloques': bloques_procesados,
                'activo': True,
                'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0),
                'actualizado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
            }
            resultado = horarios.insert_one(nuevo_horario)
            message = 'Horario creado exitosamente'
        
        # Auditoría
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='actualizar_horario_grupo',
            entidad_afectada='horarios',
            id_entidad=group_id,
            detalles=f"Horario actualizado para grupo {grupo['nombre_grupo']}"
        )
        
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        print(f"❌ Error en update_group_schedule: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/groups/<group_id>/students', methods=['GET', 'OPTIONS'])
@token_required(['administrador', 'docente'])
def get_group_students(group_id):
    """Obtener estudiantes de un grupo"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        from database.db_config import get_usuarios_collection
        
        grupos = get_groups_collection()
        usuarios = get_usuarios_collection()
        
        # Verificar grupo
        group_obj_id = string_to_objectid(group_id)
        if not group_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        grupo = grupos.find_one({'_id': group_obj_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        # ✅ CAMBIO: Buscar por id_grupo (ObjectId) en lugar de grupo (string)
        estudiantes = list(usuarios.find({
            'id_grupo': group_obj_id,  # ✅ Usar ObjectId
            'rol': 'estudiante',
            'activo': True
        }))
        
        print(f"✅ Query ejecutada: id_grupo={group_obj_id}")
        print(f"✅ Encontrados {len(estudiantes)} estudiantes en grupo {grupo['nombre_grupo']}")
        
        # Mostrar ejemplo si hay estudiantes
        if estudiantes:
            ejemplo = estudiantes[0]
            print(f"📋 Ejemplo: {ejemplo.get('nombres')} - id_grupo: {ejemplo.get('id_grupo')}")
        
        return jsonify({
            'success': True,
            'estudiantes': serialize_doc(estudiantes),
            'count': len(estudiantes)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_group_students: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/groups/<group_id>/assign-student', methods=['POST'])
@token_required('administrador')
def assign_student_to_group(group_id):
    """Asignar un estudiante a un grupo y matricularlo automáticamente"""
    try:
        data = request.get_json()
        
        if 'student_id' not in data:
            return jsonify({'success': False, 'error': 'student_id requerido'}), 400
        
        grupos = get_groups_collection()
        usuarios = get_usuarios_collection()
        matriculas = get_matriculas_collection()
        
        # Verificar grupo
        grupo_obj_id = string_to_objectid(group_id)
        if not grupo_obj_id:
            return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400
        
        grupo = grupos.find_one({'_id': grupo_obj_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        # Verificar estudiante
        student_obj_id = string_to_objectid(data['student_id'])
        if not student_obj_id:
            return jsonify({'success': False, 'error': 'ID de estudiante inválido'}), 400
        
        estudiante = usuarios.find_one({
            '_id': student_obj_id,
            'rol': 'estudiante'
        })
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        # Verificar si ya tiene grupo asignado
        if estudiante.get('id_grupo'):
            grupo_actual = grupos.find_one({'_id': estudiante['id_grupo']})
            if grupo_actual:
                return jsonify({
                    'success': False,
                    'error': f"Estudiante ya asignado al grupo {grupo_actual['nombre_grupo']}"
                }), 400
        
        # Verificar capacidad del grupo
        estudiantes_actuales = usuarios.count_documents({
            'id_grupo': grupo_obj_id,  # ✅ Usar ObjectId
            'activo': True
        })
        
        if estudiantes_actuales >= grupo.get('capacidad_max', 40):
            return jsonify({
                'success': False,
                'error': 'El grupo ha alcanzado su capacidad máxima'
            }), 400
        
        # ✅ Asignar grupo al estudiante (usando ObjectId)
        usuarios.update_one(
            {'_id': student_obj_id},
            {'$set': {'id_grupo': grupo_obj_id}}  # ✅ Usar ObjectId
        )
        
        # ✅ Crear matrícula del estudiante en el grupo
        nueva_matricula = {
            'id_estudiante': student_obj_id,
            'id_grupo': grupo_obj_id,
            'anio_lectivo': '2025',
            'fecha_matricula': Timestamp(int(datetime.utcnow().timestamp()), 0),
            'estado': 'activa',
            'estudiante_info': {
                'nombres': estudiante.get('nombres'),
                'apellidos': estudiante.get('apellidos'),
                'codigo_est': estudiante.get('codigo_est'),
                'documento': estudiante.get('documento')
            },
            'grupo_info': {
                'nombre_grupo': grupo['nombre_grupo'],
                'grado': grupo['grado'],
                'jornada': grupo.get('jornada', 'mañana')
            },
            'observaciones': 'Asignación manual desde panel administrativo',
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        matriculas.insert_one(nueva_matricula)
        
        # Actualizar contador de estudiantes en el grupo
        grupos.update_one(
            {'_id': grupo_obj_id},
            {'$inc': {'estudiantes_actuales': 1}}
        )
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='asignar_estudiante_grupo',
            entidad_afectada='usuarios',
            id_entidad=data['student_id'],
            detalles=f"Estudiante asignado al grupo {grupo['nombre_grupo']}"
        )
        
        return jsonify({
            'success': True,
            'message': f'Estudiante asignado al grupo {grupo["nombre_grupo"]} exitosamente',
            'matriculas_creadas': 1
        }), 200
        
    except Exception as e:
        print(f"❌ Error en assign_student_to_group: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
# ==========================================
#   ENDPOINTS DE HORARIOS
# ==========================================





@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'groups'})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5004)
