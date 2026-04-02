from flask import Flask, request, jsonify, g
from flask_cors import CORS
from datetime import datetime
from bson.timestamp import Timestamp
from keycloak import KeycloakOpenID
from functools import wraps
import sys
import os

# Agregar path del backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_cursos_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

app = Flask(__name__)
app.secret_key = "CoursesService"
CORS(app)

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

# ==========================================
#   ENDPOINTS: CURSOS BASE (ASIGNATURAS)
# ==========================================

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'healthy', 'service': 'courses'}), 200


@app.route('/courses', methods=['GET'])
@token_required(['administrador', 'docente'])
def get_courses():
    """Obtener todas las asignaturas base"""
    try:
        cursos = get_cursos_collection()
        
        # Filtros opcionales
        grado = request.args.get('grado')
        area = request.args.get('area')
        activo = request.args.get('activo', 'true').lower() == 'true'
        
        query = {'activo': activo}
        
        if grado:
            query['grado'] = grado
        
        if area:
            query['area'] = area
        
        cursos_list = list(cursos.find(query))
        
        return jsonify({
            'success': True,
            'data': serialize_doc(cursos_list),
            'count': len(cursos_list)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_courses: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/courses/<course_id>', methods=['GET'])
@token_required(['administrador', 'docente'])
def get_course_detail(course_id):
    """Obtener detalle de una asignatura"""
    try:
        cursos = get_cursos_collection()
        
        course_obj_id = string_to_objectid(course_id)
        if not course_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        curso = cursos.find_one({'_id': course_obj_id})
        
        if not curso:
            return jsonify({'success': False, 'error': 'Asignatura no encontrada'}), 404
        
        return jsonify({
            'success': True,
            'data': serialize_doc(curso)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_course_detail: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/courses', methods=['POST'])
@token_required('administrador')
def create_course():
    """Crear nueva asignatura base"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['nombre_curso', 'codigo_curso', 'area']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Campo {field} requerido'}), 400
        
        cursos = get_cursos_collection()
        
        # Verificar código único
        if cursos.find_one({'codigo_curso': data['codigo_curso']}):
            return jsonify({'success': False, 'error': 'Ya existe una asignatura con ese código'}), 400
        
        # Crear asignatura
        nueva_asignatura = {
            'nombre_curso': data['nombre_curso'],
            'codigo_curso': data['codigo_curso'],
            'area': data['area'],  # Matemáticas, Ciencias, Humanidades, etc.
            'descripcion': data.get('descripcion', ''),
            'intensidad_horaria_semanal': data.get('intensidad_horaria_semanal', 2),
            'creditos': data.get('creditos', 1),
            'grado': data.get('grado', ''),  # Opcional, si es específico de un grado
            'es_obligatoria': data.get('es_obligatoria', True),
            'activo': True,
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        resultado = cursos.insert_one(nueva_asignatura)
        
        # Auditoría
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='crear_asignatura',
            entidad_afectada='cursos',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Asignatura creada: {data['codigo_curso']} - {data['nombre_curso']}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Asignatura creada exitosamente',
            'course_id': str(resultado.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"❌ Error en create_course: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/courses/<course_id>', methods=['PUT'])
@token_required('administrador')
def update_course(course_id):
    """Actualizar asignatura base"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        cursos = get_cursos_collection()
        
        course_obj_id = string_to_objectid(course_id)
        if not course_obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Campos actualizables
        update_data = {}
        allowed_fields = [
            'nombre_curso', 'descripcion', 'area',
            'intensidad_horaria_semanal', 'creditos',
            'es_obligatoria', 'activo'
        ]
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        if not update_data:
            return jsonify({'success': False, 'error': 'No hay campos para actualizar'}), 400
        
        update_data['actualizado_en'] = Timestamp(int(datetime.utcnow().timestamp()), 0)
        
        resultado = cursos.update_one(
            {'_id': course_obj_id},
            {'$set': update_data}
        )
        
        if resultado.modified_count > 0:
            registrar_auditoria(
                id_usuario=g.userinfo.get('sub'),
                accion='actualizar_asignatura',
                entidad_afectada='cursos',
                id_entidad=course_id,
                detalles=f"Asignatura actualizada"
            )
            
            return jsonify({
                'success': True,
                'message': 'Asignatura actualizada exitosamente'
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Asignatura no encontrada'}), 404
        
    except Exception as e:
        print(f"❌ Error en update_course: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print("🚀 Courses Service iniciado en puerto 5006")
    app.run(host='0.0.0.0', port=5006, debug=True)