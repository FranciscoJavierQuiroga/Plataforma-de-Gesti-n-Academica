from flask import Flask, request, jsonify, g, send_file
from flask_cors import CORS
from datetime import datetime
from keycloak import KeycloakOpenID
from functools import wraps
import jwt as pyjwt
import sys
import os
from bson.timestamp import Timestamp
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.utils import simpleSplit

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_usuarios_collection,
    get_cursos_collection,
    get_groups_collection,
    get_matriculas_collection,
    get_asistencia_collection,
    get_observaciones_collection,
    get_asignaciones_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

app = Flask(__name__)
app.secret_key = "PlataformaColegios"

# 🔧 CORS CONFIGURACIÓN COMPLETA
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:4200",
            "http://localhost:4300",
            "https://plataformadegestionacademica.vercel.app"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Keycloak config
KEYCLOAK_SERVER = os.getenv('KEYCLOAK_SERVER_URL', 'http://localhost:8082')
KEYCLOAK_CLIENT_ID = os.getenv('KEYCLOAK_CLIENT_ID', '01')
KEYCLOAK_REALM = os.getenv('KEYCLOAK_REALM', 'plataformainstitucional')
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


def get_teacher_docente():
    """Obtener el documento del docente desde el token actual.
    Retorna None si no se encuentra.
    """
    try:
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        if teacher_email and '@' not in teacher_email:
            teacher_email = f"{teacher_email}@colegio.edu.co"
        teacher_sub = g.userinfo.get('sub')
        usuarios = get_usuarios_collection()
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        if not docente:
            docente = usuarios.find_one({
                'keycloak_id': teacher_sub,
                'rol': 'docente',
                'activo': True
            })
        if not docente:
            teacher_obj_id = string_to_objectid(teacher_sub)
            if teacher_obj_id:
                docente = usuarios.find_one({
                    '_id': teacher_obj_id,
                    'rol': 'docente',
                    'activo': True
                })
        return docente
    except Exception as e:
        print(f"❌ Error en get_teacher_docente: {e}")
        return None


def check_group_access(docente, group_id):
    """Verificar si el docente tiene acceso a un grupo.
    Retorna un dict con:
      - access: bool (True si tiene acceso)
      - is_homeroom_teacher: bool
      - assignments: list (asignaciones del docente en el grupo)
      - error: str (mensaje de error si access=False)
    """
    try:
        grupos = get_groups_collection()
        asignaciones = get_asignaciones_collection()
        grupo_obj_id = string_to_objectid(group_id)
        if not grupo_obj_id:
            return {'access': False, 'error': 'ID de grupo inválido'}
        
        grupo = grupos.find_one({'_id': grupo_obj_id})
        if not grupo:
            return {'access': False, 'error': 'Grupo no encontrado'}
        
        # Verificar si es director de grupo
        is_homeroom = False
        director_id = grupo.get('director_grupo')
        if director_id and docente and director_id == docente['_id']:
            is_homeroom = True
        
        # Obtener asignaciones del docente en este grupo
        docente_assignments = []
        if docente:
            docente_assignments = list(asignaciones.find({
                'id_docente': docente['_id'],
                'id_grupo': grupo_obj_id,
                'activo': True
            }))
        
        # Tiene acceso si es director de grupo o tiene asignaciones
        if is_homeroom or docente_assignments:
            return {
                'access': True,
                'is_homeroom_teacher': is_homeroom,
                'assignments': docente_assignments,
                'grupo': grupo,
                'grupo_obj_id': grupo_obj_id
            }
        else:
            return {
                'access': False,
                'error': 'No tienes asignaturas asignadas en este grupo'
            }
    except Exception as e:
        print(f"❌ Error en check_group_access: {e}")
        import traceback
        traceback.print_exc()
        return {'access': False, 'error': str(e)}


@app.route('/')
def home():
    return jsonify({
        'service': 'Teachers Service',
        'version': '2.0.0',
        'database': 'MongoDB',
        'endpoints': {
            'get_all': 'GET /teachers',
            'get_one': 'GET /teachers/{id}',
            'create': 'POST /teachers',
            'update': 'PUT /teachers/{id}',
            'delete': 'DELETE /teachers/{id}',
            'by_subject': 'GET /teachers?subject={subject}'
        }
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'teachers', 'database': 'MongoDB'})

@app.route('/teachers', methods=['GET'])
def get_teachers():
    """Obtener todos los profesores"""
    try:
        usuarios = get_usuarios_collection()
        
        # Filtros opcionales
        especialidad = request.args.get('especialidad') or request.args.get('subject')
        status = request.args.get('status')
        
        # Construir query
        query = {'rol': 'docente'}
        
        if status:
            query['activo'] = (status.lower() == 'active')
        
        if especialidad:
            query['especialidad'] = {'$regex': especialidad, '$options': 'i'}
        
        # Buscar docentes
        docentes = list(usuarios.find(query))
        
        # Serializar documentos
        docentes_serializados = serialize_doc(docentes)
        
        return jsonify({
            'success': True,
            'data': docentes_serializados,
            'count': len(docentes_serializados)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teachers/<teacher_id>', methods=['GET'])
def get_teacher(teacher_id):
    """Obtener un profesor por ID"""
    try:
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(teacher_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Buscar docente
        docente = usuarios.find_one({'_id': obj_id, 'rol': 'docente'})
        
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        return jsonify({
            'success': True,
            'data': serialize_doc(docente)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teachers', methods=['POST'])
def create_teacher():
    """Crear un nuevo profesor"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['correo', 'nombres', 'apellidos']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'error': f'El campo {field} es requerido'
                }), 400

        usuarios = get_usuarios_collection()
        
        # Verificar si el correo ya existe
        if usuarios.find_one({'correo': data['correo']}):
            return jsonify({
                'success': False,
                'error': 'El correo ya está registrado'
            }), 400
        
        # Crear documento del docente
        nuevo_docente = {
            'correo': data['correo'],
            'rol': 'docente',
            'nombres': data['nombres'],
            'apellidos': data['apellidos'],
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0),
            'activo': data.get('activo', True)
        }
        
        # Campos opcionales específicos de docente
        if 'telefono' in data:
            nuevo_docente['telefono'] = data['telefono']
        if 'codigo_empleado' in data:
            nuevo_docente['codigo_empleado'] = data['codigo_empleado']
        if 'especialidad' in data:
            nuevo_docente['especialidad'] = data['especialidad']
        if 'fecha_ingreso' in data:
            nuevo_docente['fecha_ingreso'] = datetime.fromisoformat(data['fecha_ingreso'].replace('Z', '+00:00'))
        
        # Insertar en la base de datos
        resultado = usuarios.insert_one(nuevo_docente)
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='crear_docente',
            entidad_afectada='usuarios',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Docente creado: {data['nombres']} {data['apellidos']}"
        )
        
        # Obtener el documento insertado
        docente_creado = usuarios.find_one({'_id': resultado.inserted_id})
        
        return jsonify({
            'success': True,
            'message': 'Docente creado exitosamente',
            'data': serialize_doc(docente_creado)
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teachers/<teacher_id>', methods=['PUT'])
def update_teacher(teacher_id):
    """Actualizar un profesor"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(teacher_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el docente existe
        docente_existente = usuarios.find_one({'_id': obj_id, 'rol': 'docente'})
        if not docente_existente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Preparar datos para actualizar (excluir campos que no se deben modificar)
        campos_no_modificables = {'_id', 'rol', 'creado_en', 'correo'}
        datos_actualizacion = {k: v for k, v in data.items() if k not in campos_no_modificables}
        
        # Convertir fecha_ingreso si viene en el request
        if 'fecha_ingreso' in datos_actualizacion:
            datos_actualizacion['fecha_ingreso'] = datetime.fromisoformat(
                datos_actualizacion['fecha_ingreso'].replace('Z', '+00:00')
            )
        
        # Actualizar
        resultado = usuarios.update_one(
            {'_id': obj_id},
            {'$set': datos_actualizacion}
        )
        
        if resultado.modified_count > 0:
            # Registrar en auditoría
            registrar_auditoria(
                id_usuario=None,
                accion='actualizar_docente',
                entidad_afectada='usuarios',
                id_entidad=teacher_id,
                detalles=f"Campos actualizados: {', '.join(datos_actualizacion.keys())}"
            )
            
            # Obtener documento actualizado
            docente_actualizado = usuarios.find_one({'_id': obj_id})
            
            return jsonify({
                'success': True,
                'message': 'Docente actualizado exitosamente',
                'data': serialize_doc(docente_actualizado)
            }), 200
        else:
            return jsonify({
                'success': True,
                'message': 'No se realizaron cambios',
                'data': serialize_doc(docente_existente)
            }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teachers/<teacher_id>', methods=['DELETE'])
def delete_teacher(teacher_id):
    """Eliminar (desactivar) un profesor"""
    try:
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(teacher_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el docente existe
        docente = usuarios.find_one({'_id': obj_id, 'rol': 'docente'})
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Desactivar (no eliminar físicamente)
        resultado = usuarios.update_one(
            {'_id': obj_id},
            {'$set': {'activo': False}}
        )
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='desactivar_docente',
            entidad_afectada='usuarios',
            id_entidad=teacher_id,
            detalles=f"Docente desactivado: {docente['nombres']} {docente['apellidos']}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Docente desactivado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/subjects', methods=['GET'])
def get_subjects():
    """Obtener lista de especialidades disponibles"""
    try:
        usuarios = get_usuarios_collection()
        
        # Obtener especialidades únicas de todos los docentes
        especialidades = usuarios.distinct('especialidad', {'rol': 'docente', 'especialidad': {'$exists': True, '$ne': None}})
        
        return jsonify({
            'success': True,
            'subjects': especialidades
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/groups', methods=['GET', 'OPTIONS'])
@token_required('docente')
def teacher_groups():
    """Obtener grupos asignados al docente autenticado"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        teacher_email = g.userinfo.get('email')
        if not teacher_email:
            teacher_email = g.userinfo.get('preferred_username')
        if teacher_email and '@' not in teacher_email:
            teacher_email = f"{teacher_email}@colegio.edu.co"
        
        teacher_sub = g.userinfo.get('sub')
        
        print(f"🔍 Buscando docente con email: {teacher_email}")
        
        usuarios = get_usuarios_collection()
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        if not docente:
            print(f"❌ Docente no encontrado en MongoDB")
            return jsonify({
                'success': False,
                'error': 'Docente no encontrado en la base de datos'
            }), 404
        
        print(f"✅ Docente encontrado: {docente.get('nombres')} {docente.get('apellidos')}")
        
        # ✅ CAMBIO: Buscar en asignaciones_docentes en lugar de cursos
        from database.db_config import get_asignaciones_collection
        
        asignaciones = get_asignaciones_collection()
        matriculas = get_matriculas_collection()
        
        # Buscar asignaciones del docente
        asignaciones_list = list(asignaciones.find({
            'id_docente': docente['_id'],
            'activo': True,
            'anio_lectivo': '2025'
        }))
        
        print(f"📚 Encontradas {len(asignaciones_list)} asignaciones para el docente")
        
        # Agrupar por grupo (un grupo puede tener múltiples asignaturas)
        grupos_dict = {}
        
        for asig in asignaciones_list:
            grupo_id = str(asig['id_grupo'])
            
            if grupo_id not in grupos_dict:
                # Contar estudiantes matriculados ACTIVOS en el grupo
                num_estudiantes = matriculas.count_documents({
                    'id_grupo': asig['id_grupo'],
                    'estado': 'activa'
                })
                
                grupos_dict[grupo_id] = {
                    '_id': grupo_id,
                    'name': f"{asig['grupo_info'].get('nombre_grupo', 'Grupo')} - Periodo {asig.get('periodo', '1')}",
                    'students': num_estudiantes,
                    'progress_pct': 0,  # TODO: calcular progreso real
                    'codigo': asig['grupo_info'].get('nombre_grupo', ''),
                    'periodo': asig.get('periodo', '1'),
                    'asignaturas': []
                }
            
            # Agregar asignatura al grupo
            grupos_dict[grupo_id]['asignaturas'].append({
                'nombre': asig['curso_info'].get('nombre_curso', ''),
                'codigo': asig['curso_info'].get('codigo_curso', ''),
                'area': asig['curso_info'].get('area', '')
            })
        
        grupos_formateados = list(grupos_dict.values())
        
        print(f"✅ {len(grupos_formateados)} grupos únicos encontrados")
        for grupo in grupos_formateados:
            print(f"   - {grupo['name']}: {len(grupo['asignaturas'])} asignaturas, {grupo['students']} estudiantes")
        
        return jsonify({
            'success': True,
            'groups': grupos_formateados,
            'count': len(grupos_formateados)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en /teacher/groups: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@app.route('/teacher/pending-grades', methods=['GET'])
@token_required('docente')
def teacher_pending_grades():
    """Calificaciones pendientes del docente autenticado"""
    try:
        # 🔧 Obtener email del token (preferiblemente) o sub como fallback
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        teacher_sub = g.userinfo.get('sub')
        
        print(f"🔍 Buscando docente con email: {teacher_email}, sub: {teacher_sub}")
        
        usuarios = get_usuarios_collection()
        
        # Buscar por email primero
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        # Si no se encuentra por email, intentar por sub (si está guardado en la BD)
        if not docente:
            docente = usuarios.find_one({
                'keycloak_id': teacher_sub,  # Asumiendo que guardas el UUID aquí
                'rol': 'docente',
                'activo': True
            })
        
        if not docente:
            print(f"❌ Docente no encontrado. Email buscado: {teacher_email}")
            return jsonify({
                'success': False,
                'error': 'Docente no encontrado en la base de datos'
            }), 404
        
        print(f"✅ Docente encontrado: {docente.get('nombres')} {docente.get('apellidos')}")
     
        matriculas = get_matriculas_collection()
        asignaciones = get_asignaciones_collection()

        # Obtener asignaciones del docente (modelo actual)
        asignaciones_docente = list(asignaciones.find({
            'id_docente': docente['_id'],
            'activo': True,
            'anio_lectivo': '2025'
        }))

        pending_list = []

        for asig in asignaciones_docente:
            # Total de estudiantes activos del grupo asignado
            total_estudiantes = matriculas.count_documents({
                'id_grupo': asig['id_grupo'],
                'estado': 'activa'
            })

            # Estudiantes que ya tienen notas para ESTA asignacion
            estudiantes_con_notas = matriculas.count_documents({
                'id_grupo': asig['id_grupo'],
                'estado': 'activa',
                'calificaciones': {
                    '$elemMatch': {
                        'id_asignacion': asig['_id'],
                        'notas.0': {'$exists': True}
                    }
                }
            })

            pending_count = max(total_estudiantes - estudiantes_con_notas, 0)

            if pending_count > 0:
                curso_info = asig.get('curso_info', {})
                grupo_info = asig.get('grupo_info', {})

                pending_list.append({
                    'course': f"{curso_info.get('nombre_curso', '')} - {grupo_info.get('nombre_grupo', '')}",
                    'pending': pending_count,
                    'total': total_estudiantes,
                    'course_id': str(asig.get('id_curso', '')),
                    'assignment_id': str(asig.get('_id', ''))
                })
        
        return jsonify({
            'success': True,
            'pending': pending_list,
            'total_pending': sum(p['pending'] for p in pending_list)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en /teacher/pending-grades: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/overview', methods=['GET'])
@token_required('docente')
def teacher_overview():
    """Resumen general del docente autenticado"""
    try:
        teacher_email = g.userinfo.get('email')
        if not teacher_email:
            teacher_email = g.userinfo.get('preferred_username')
        if teacher_email and '@' not in teacher_email:
            teacher_email = f"{teacher_email}@colegio.edu.co"
        
        print(f"🔍 Buscando docente: {teacher_email}")
        
        usuarios = get_usuarios_collection()
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        if not docente:
            return jsonify({
                'success': False,
                'error': 'Docente no encontrado'
            }), 404
        
        print(f"✅ Docente encontrado: {docente.get('nombres')} {docente.get('apellidos')}")
        
        # ✅ CAMBIO: Usar asignaciones_docentes
        from database.db_config import get_asignaciones_collection
        
        asignaciones = get_asignaciones_collection()
        matriculas = get_matriculas_collection()
        
        # Contar asignaciones (cursos únicos)
        asignaciones_list = list(asignaciones.find({
            'id_docente': docente['_id'],
            'activo': True,
            'anio_lectivo': '2025'
        }))
        
        # Contar grupos únicos
        grupos_unicos = set(str(asig['id_grupo']) for asig in asignaciones_list)
        groups_count = len(grupos_unicos)
        
        # Contar estudiantes totales en todos los grupos del docente
        total_students = 0
        for grupo_id_str in grupos_unicos:
            from bson import ObjectId
            grupo_id = ObjectId(grupo_id_str)
            num = matriculas.count_documents({
                'id_grupo': grupo_id,
                'estado': 'activa'
            })
            total_students += num
        
        # TODO: Implementar calificaciones pendientes
        pending_grades = 0
        
        print(f"📊 Overview: {groups_count} grupos, {total_students} estudiantes, {len(asignaciones_list)} asignaturas")
        
        return jsonify({
            'success': True,
            'teacher_name': f"{docente.get('nombres', '')} {docente.get('apellidos', '')}".strip(),
            'especialidad': docente.get('especialidad', 'N/A'),
            'groups_count': groups_count,
            'total_students': total_students,
            'pending_grades': pending_grades,
            'next_event': 'No hay eventos programados'
        }), 200
        
    except Exception as e:
        print(f"❌ Error en /teacher/overview: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/teacher/courses/<course_id>/grades', methods=['GET'])
@token_required('docente')
def get_course_grades(course_id):
    """Obtener calificaciones de un curso del docente"""
    try:
        matriculas = get_matriculas_collection()
        cursos = get_cursos_collection()
        
        # Convertir ID a ObjectId
        curso_obj_id = string_to_objectid(course_id)
        if not curso_obj_id:
            return jsonify({'success': False, 'error': 'ID de curso inválido'}), 400
        
        # Verificar que el curso existe
        curso = cursos.find_one({'_id': curso_obj_id})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado'}), 404
        
        # 🔧 ACTUALIZACIÓN: Extraer email del token correctamente
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        teacher_sub = g.userinfo.get('sub')
        
        print(f"🔍 Verificando permisos del docente:")
        print(f"   Email del token: {teacher_email}")
        print(f"   Sub del token: {teacher_sub}")
        print(f"   ID del curso: {course_id}")
        
        usuarios = get_usuarios_collection()
        
        # Buscar por email primero
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        # Si no se encuentra por email, intentar por keycloak_id
        if not docente:
            docente = usuarios.find_one({
                'keycloak_id': teacher_sub,
                'rol': 'docente',
                'activo': True
            })
        
        if not docente:
            print(f"❌ Docente no encontrado en la base de datos")
            print(f"   Email buscado: {teacher_email}")
            print(f"   Sub buscado: {teacher_sub}")
            return jsonify({
                'success': False,
                'error': 'Docente no encontrado en la base de datos'
            }), 404
        
        print(f"✅ Docente encontrado: {docente.get('nombres')} {docente.get('apellidos')}")

        from database.db_config import get_asignaciones_collection
        asignaciones = get_asignaciones_collection()

        # El curso puede estar en varios grupos; tomar todas las asignaciones del docente
        asignaciones_docente = list(asignaciones.find({
            'id_curso': curso_obj_id,
            'id_docente': docente['_id'],
            'activo': True
        }))

        if not asignaciones_docente:
            return jsonify({'success': False, 'error': 'No tienes permiso para ver este curso'}), 403

        asignacion_por_grupo = {a['id_grupo']: a for a in asignaciones_docente}
        enrollments = list(matriculas.find({
            'id_grupo': {'$in': list(asignacion_por_grupo.keys())},
            'estado': 'activa'
        }))

        students_data = []
        for enrollment in enrollments:
            asig = asignacion_por_grupo.get(enrollment.get('id_grupo'))
            if not asig:
                continue

            notas = []
            for cal in enrollment.get('calificaciones', []):
                if cal.get('id_asignacion') == asig['_id']:
                    notas = cal.get('notas', [])
                    break

            promedio = 0
            if notas:
                total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas)
                total_peso = sum(n.get('peso', 0) for n in notas)
                promedio = round(total / total_peso, 2) if total_peso > 0 else 0

            student_info = enrollment.get('estudiante_info', {})
            students_data.append({
                'enrollment_id': str(enrollment['_id']),
                'student_id': str(enrollment['id_estudiante']),
                'student_name': f"{student_info.get('nombres', '')} {student_info.get('apellidos', '')}",
                'student_code': student_info.get('codigo_est', ''),
                'grades': serialize_doc(notas),
                'average': promedio,
                'estado': 'Aprobado' if promedio >= 3.0 else 'Reprobado',
                'group_id': str(enrollment.get('id_grupo')) if enrollment.get('id_grupo') else None,
                'assignment_id': str(asig['_id'])
            })

        return jsonify({
            'success': True,
            'course_id': course_id,
            'course_name': curso.get('nombre_curso', ''),
            'course_code': curso.get('codigo_curso', ''),
            'grado': curso.get('grado', ''),
            'students': students_data,
            'count': len(students_data)
        }), 200
            
    except Exception as e:
        print(f"❌ Error en get_course_grades: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500    

@app.route('/teacher/groups/<group_id>/grades', methods=['GET'])
@token_required('docente')
def get_group_grades(group_id):
    """Obtener calificaciones de un grupo (todas las asignaturas del docente en ese grupo)"""
    try:
        docente = get_teacher_docente()
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        access_info = check_group_access(docente, group_id)
        if not access_info['access']:
            return jsonify({'success': False, 'error': access_info['error']}), 403
        
        grupo_obj_id = access_info['grupo_obj_id']
        asignaciones = get_asignaciones_collection()
        matriculas = get_matriculas_collection()
        grupos = get_groups_collection()
        
        # Obtener parámetro opcional course_id para filtrar por materia
        course_id = request.args.get('course_id')
        course_obj_id = string_to_objectid(course_id) if course_id else None
        
        # Obtener asignaciones a mostrar
        if access_info['is_homeroom_teacher']:
            # Director de grupo: obtener todas las asignaciones del grupo
            query = {'id_grupo': grupo_obj_id, 'activo': True}
            if course_obj_id:
                query['id_curso'] = course_obj_id
            asignaciones_grupo = list(asignaciones.find(query))
        else:
            # Profesor normal: solo sus asignaciones
            asignaciones_grupo = access_info['assignments']
            if course_obj_id:
                asignaciones_grupo = [a for a in asignaciones_grupo if a['id_curso'] == course_obj_id]
        
        if not asignaciones_grupo:
            return jsonify({'success': False, 'error': 'No hay asignaturas disponibles'}), 403
        
        print(f"📚 Encontradas {len(asignaciones_grupo)} asignaturas en el grupo")
        
        # Obtener estudiantes matriculados en el grupo
        estudiantes_matriculados = list(matriculas.find({
            'id_grupo': grupo_obj_id,
            'estado': 'activa'
        }))
        
        print(f"👥 Encontrados {len(estudiantes_matriculados)} estudiantes en el grupo")
        
        # Formatear datos de estudiantes
        students_data = []
        ids_asignaciones = {a['_id'] for a in asignaciones_grupo}
        ids_asignaciones_propias = {a['_id'] for a in access_info['assignments']}
        
        for matricula in estudiantes_matriculados:
            student_info = matricula.get('estudiante_info', {})
            calificaciones = matricula.get('calificaciones', [])
            notas_docente = []

            for item in calificaciones:
                if item.get('id_asignacion') in ids_asignaciones:
                    assignment_id = str(item.get('id_asignacion'))
                    periodo = item.get('periodo', '1')
                    is_own = item.get('id_asignacion') in ids_asignaciones_propias
                    for idx, nota in enumerate(item.get('notas', [])):
                        nota_copy = dict(nota)
                        nota_copy['assignment_id'] = assignment_id
                        nota_copy['periodo'] = periodo
                        nota_copy['index'] = idx
                        nota_copy['is_editable'] = is_own
                        notas_docente.append(nota_copy)

            # Calcular promedio
            promedio = 0
            if notas_docente:
                total = sum(c.get('nota', 0) * c.get('peso', 0) for c in notas_docente)
                total_peso = sum(c.get('peso', 0) for c in notas_docente)
                promedio = round(total / total_peso, 2) if total_peso > 0 else 0

            students_data.append({
                'enrollment_id': str(matricula['_id']),
                'student_id': str(matricula['id_estudiante']),
                'student_name': f"{student_info.get('nombres', '')} {student_info.get('apellidos', '')}",
                'student_code': student_info.get('codigo_est', ''),
                'grades': serialize_doc(notas_docente),
                'average': promedio,
                'estado': 'Aprobado' if promedio >= 3.0 else 'Reprobado'
            })
        
        # Información del grupo
        grupo = grupos.find_one({'_id': grupo_obj_id})
        
        return jsonify({
            'success': True,
            'group_id': group_id,
            'group_name': grupo.get('nombre_grupo', '') if grupo else '',
            'grado': grupo.get('grado', '') if grupo else '',
            'is_homeroom_teacher': access_info['is_homeroom_teacher'],
            'asignaturas': [
                {
                    'id_asignacion': str(asig['_id']),
                    'id_curso': str(asig['id_curso']),
                    'nombre': asig['curso_info'].get('nombre_curso', ''),
                    'codigo': asig['curso_info'].get('codigo_curso', ''),
                    'is_own': asig['_id'] in ids_asignaciones_propias
                }
                for asig in asignaciones_grupo
            ],
            'students': students_data,
            'count': len(students_data)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_group_grades: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/groups/<group_id>/assignments', methods=['GET'])
@token_required('docente')
def get_group_assignments(group_id):
    """Obtener todas las asignaciones del docente en un grupo específico"""
    try:
        docente = get_teacher_docente()
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        access_info = check_group_access(docente, group_id)
        if not access_info['access']:
            return jsonify({'success': False, 'error': access_info['error']}), 403
        
        # Si es director de grupo, obtener TODAS las asignaciones del grupo
        asignaciones = get_asignaciones_collection()
        if access_info['is_homeroom_teacher']:
            assignments = list(asignaciones.find({
                'id_grupo': access_info['grupo_obj_id'],
                'activo': True
            }))
        else:
            assignments = access_info['assignments']
        
        result = []
        for a in assignments:
            result.append({
                'id_asignacion': str(a['_id']),
                'id_curso': str(a['id_curso']),
                'nombre_curso': a.get('curso_info', {}).get('nombre_curso', ''),
                'codigo_curso': a.get('curso_info', {}).get('codigo_curso', ''),
                'periodo': a.get('periodo', '1'),
                'salon_asignado': a.get('salon_asignado', ''),
                'anio_lectivo': a.get('anio_lectivo', ''),
                'is_own': a.get('id_docente') == docente['_id']
            })
        
        return jsonify({
            'success': True,
            'group_id': group_id,
            'is_homeroom_teacher': access_info['is_homeroom_teacher'],
            'assignments': result,
            'count': len(result)
        }), 200
    except Exception as e:
        print(f"❌ Error en get_group_assignments: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/grades', methods=['POST'])
@token_required('docente')
def add_grade():
    """Agregar una calificación a un estudiante EN ESTRUCTURA ANIDADA POR ASIGNACIÓN"""
    try:
        data = request.get_json()
        
        # Validar campos requeridos (ahora incluye assignment_id y periodo)
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
            id_usuario=g.userinfo.get('sub'),
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
    
@app.route('/teacher/grades/<enrollment_id>', methods=['PUT'])
@token_required('docente')
def update_grade(enrollment_id):
    """Actualizar una calificación específica"""
    try:
        data = request.get_json()
        
        if not data or 'grade_index' not in data:
            return jsonify({'success': False, 'error': 'Se requiere grade_index'}), 400
        
        grade_index = int(data['grade_index'])
        matriculas = get_matriculas_collection()
        
        enrollment_obj_id = string_to_objectid(enrollment_id)
        if not enrollment_obj_id:
            return jsonify({'success': False, 'error': 'ID de matrícula inválido'}), 400
        
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        calificaciones = matricula.get('calificaciones', [])
        if grade_index < 0 or grade_index >= len(calificaciones):
            return jsonify({'success': False, 'error': 'Índice de calificación inválido'}), 400
        
        # Construir actualización
        update_fields = {}
        
        if 'nota' in data:
            nota = float(data['nota'])
            nota_maxima = calificaciones[grade_index].get('nota_maxima', 5.0)
            if nota < 0 or nota > nota_maxima:
                return jsonify({
                    'success': False,
                    'error': f'La nota debe estar entre 0 y {nota_maxima}'
                }), 400
            update_fields[f'calificaciones.{grade_index}.nota'] = nota
        
        if 'peso' in data:
            peso = float(data['peso'])
            if peso < 0 or peso > 1:
                return jsonify({'success': False, 'error': 'El peso debe estar entre 0 y 1'}), 400
            update_fields[f'calificaciones.{grade_index}.peso'] = peso
        
        if 'comentarios' in data:
            update_fields[f'calificaciones.{grade_index}.comentarios'] = data['comentarios']
        
        if 'tipo' in data:
            update_fields[f'calificaciones.{grade_index}.tipo'] = data['tipo']
        
        if update_fields:
            matriculas.update_one(
                {'_id': enrollment_obj_id},
                {'$set': update_fields}
            )
            
            registrar_auditoria(
                id_usuario=g.userinfo.get('sub'),
                accion='actualizar_calificacion',
                entidad_afectada='matriculas',
                id_entidad=enrollment_id,
                detalles=f"Calificación actualizada en índice {grade_index}"
            )
        
        matricula_actualizada = matriculas.find_one({'_id': enrollment_obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Calificación actualizada exitosamente',
            'enrollment': serialize_doc(matricula_actualizada)
        }), 200
        
    except ValueError:
        return jsonify({'success': False, 'error': 'Valores numéricos inválidos'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/grades/<enrollment_id>/<int:grade_index>', methods=['DELETE'])
@token_required('docente')
def delete_grade(enrollment_id, grade_index):
    """Eliminar una calificación específica"""
    try:
        matriculas = get_matriculas_collection()
        
        enrollment_obj_id = string_to_objectid(enrollment_id)
        if not enrollment_obj_id:
            return jsonify({'success': False, 'error': 'ID de matrícula inválido'}), 400
        
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        calificaciones = matricula.get('calificaciones', [])
        if grade_index < 0 or grade_index >= len(calificaciones):
            return jsonify({'success': False, 'error': 'Índice de calificación inválido'}), 400
        
        calificaciones.pop(grade_index)
        
        matriculas.update_one(
            {'_id': enrollment_obj_id},
            {'$set': {'calificaciones': calificaciones}}
        )
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
            accion='eliminar_calificacion',
            entidad_afectada='matriculas',
            id_entidad=enrollment_id,
            detalles=f"Calificación eliminada en índice {grade_index}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Calificación eliminada exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/grades/bulk', methods=['POST'])
@token_required('docente')
def bulk_upload_grades():
    """Carga masiva de calificaciones para un curso"""
    try:
        data = request.get_json()
        
        if not data or 'grades' not in data:
            return jsonify({'success': False, 'error': 'No se proporcionaron calificaciones'}), 400
        
        course_id = data.get('course_id')
        periodo = data.get('periodo', '1')
        tipo_evaluacion = data.get('tipo', 'Parcial')
        peso = float(data.get('peso', 0.33))
        
        if not course_id:
            return jsonify({'success': False, 'error': 'Se requiere course_id'}), 400
        
        # Get teacher info
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        if teacher_email and '@' not in teacher_email:
            teacher_email = f"{teacher_email}@colegio.edu.co"
        
        usuarios = get_usuarios_collection()
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Validar periodo activo
        from database.db_config import get_periodos_collection
        periodos = get_periodos_collection()
        periodo_activo = periodos.find_one({'activo': True})
        
        if not periodo_activo:
            return jsonify({
                'success': False,
                'error': 'No hay periodo activo configurado. Contacte al administrador.'
            }), 403
        
        # Validar que el periodo seleccionado sea el activo
        if str(periodo) != str(periodo_activo['periodo']):
            return jsonify({
                'success': False,
                'error': f"Solo puedes registrar calificaciones del periodo activo ({periodo_activo['periodo']}). Periodo seleccionado: {periodo}"
            }), 403
        
        # Validar fecha limite
        fecha_limite = periodo_activo.get('fecha_limite_calificaciones')
        if fecha_limite:
            if isinstance(fecha_limite, str):
                fecha_limite = datetime.fromisoformat(fecha_limite.replace('Z', '+00:00'))
            if datetime.utcnow() > fecha_limite:
                return jsonify({
                    'success': False,
                    'error': f"La fecha limite para registrar calificaciones del periodo {periodo_activo['periodo']} ha pasado ({fecha_limite.strftime('%d/%m/%Y')})"
                }), 403
        
        # Validar que el periodo no esté cerrado para el grupo
        grupos = get_groups_collection()
        grupo_obj_id = string_to_objectid(course_id)
        if grupo_obj_id:
            grupo = grupos.find_one({'_id': grupo_obj_id})
            if grupo and periodo in grupo.get('periodos_cerrados', []):
                return jsonify({
                    'success': False,
                    'error': f"El periodo {periodo} está cerrado para este grupo. No se pueden modificar calificaciones."
                }), 403
        
        from database.db_config import get_asignaciones_collection
        asignaciones_col = get_asignaciones_collection()
        matriculas = get_matriculas_collection()
        
        successful = 0
        failed = 0
        errors = []
        
        for grade_entry in data['grades']:
            try:
                enrollment_id = grade_entry.get('enrollment_id')
                nota = float(grade_entry.get('nota', 0))
                comentarios = grade_entry.get('comentarios', '')
                assignment_id = grade_entry.get('assignment_id')
                grade_index = grade_entry.get('grade_index')
                
                if not enrollment_id:
                    failed += 1
                    errors.append({'error': 'enrollment_id requerido', 'entry': grade_entry})
                    continue
                
                # If no assignment_id provided, look up teacher's assignment for this group
                if not assignment_id:
                    asignacion = asignaciones_col.find_one({
                        'id_docente': docente['_id'],
                        'id_grupo': string_to_objectid(course_id),
                        'activo': True
                    })
                    if not asignacion:
                        failed += 1
                        errors.append({'error': 'No tienes asignación para este grupo', 'entry': grade_entry})
                        continue
                    assignment_id = str(asignacion['_id'])
                
                asignacion_obj_id = string_to_objectid(assignment_id)
                enrollment_obj_id = string_to_objectid(enrollment_id)
                matricula = matriculas.find_one({'_id': enrollment_obj_id})
                
                if not matricula:
                    failed += 1
                    errors.append({'error': 'Matrícula no encontrada', 'enrollment_id': enrollment_id})
                    continue
                
                nueva_nota = {
                    'tipo': tipo_evaluacion,
                    'nota': nota,
                    'nota_maxima': 5.0,
                    'peso': peso,
                    'fecha_eval': datetime.utcnow(),
                    'comentarios': comentarios
                }
                
                # Check if calificaciones wrapper exists for this assignment + periodo
                calificaciones = matricula.get('calificaciones', [])
                wrapper_exists = False
                for c in calificaciones:
                    if c.get('id_asignacion') == asignacion_obj_id and c.get('periodo') == periodo:
                        wrapper_exists = True
                        break
                
                if not wrapper_exists:
                    # Create wrapper first
                    matriculas.update_one(
                        {'_id': enrollment_obj_id},
                        {'$push': {
                            'calificaciones': {
                                'id_asignacion': asignacion_obj_id,
                                'periodo': periodo,
                                'notas': []
                            }
                        }}
                    )
                
                if grade_index is not None and grade_index >= 0:
                    # UPDATE existing grade at index
                    matriculas.update_one(
                        {
                            '_id': enrollment_obj_id,
                            'calificaciones.id_asignacion': asignacion_obj_id,
                            'calificaciones.periodo': periodo
                        },
                        {
                            '$set': {
                                'calificaciones.$.notas.' + str(grade_index): nueva_nota
                            }
                        }
                    )
                else:
                    # CREATE new grade
                    matriculas.update_one(
                        {
                            '_id': enrollment_obj_id,
                            'calificaciones.id_asignacion': asignacion_obj_id,
                            'calificaciones.periodo': periodo
                        },
                        {
                            '$push': {
                                'calificaciones.$.notas': nueva_nota
                            }
                        }
                    )
                
                # Recalculate and update average
                matricula_actualizada = matriculas.find_one({'_id': enrollment_obj_id})
                notas_docente = []
                for c in matricula_actualizada.get('calificaciones', []):
                    if c.get('id_asignacion') == asignacion_obj_id:
                        notas_docente.extend(c.get('notas', []))
                
                promedio = 0
                if notas_docente:
                    total = sum(c.get('nota', 0) * c.get('peso', 0) for c in notas_docente)
                    total_peso = sum(c.get('peso', 0) for c in notas_docente)
                    promedio = round(total / total_peso, 2) if total_peso > 0 else 0
                
                matriculas.update_one(
                    {'_id': enrollment_obj_id},
                    {'$set': {'average': promedio}}
                )
                
                successful += 1
                
            except Exception as e:
                failed += 1
                errors.append({'error': str(e), 'entry': grade_entry})
        
        registrar_auditoria(
            id_usuario=g.userinfo.get('sub'),
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
        }), 200 if failed == 0 else 207
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/groups/<group_id>/close-period', methods=['POST'])
@token_required('docente')
def close_period(group_id):
    """Cerrar un periodo para un grupo (solo director de grupo)"""
    try:
        data = request.get_json()
        periodo = data.get('periodo')
        
        if not periodo:
            return jsonify({'success': False, 'error': 'Se requiere periodo'}), 400
        
        docente = get_teacher_docente()
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Verificar acceso al grupo
        access_info = check_group_access(docente, group_id)
        if not access_info['access']:
            return jsonify({'success': False, 'error': access_info['error']}), 403
        
        # Verificar que es director de grupo
        if not access_info['is_homeroom_teacher']:
            return jsonify({'success': False, 'error': 'Solo el director de grupo puede cerrar periodos'}), 403
        
        grupos = get_groups_collection()
        grupo_obj_id = access_info['grupo_obj_id']
        
        # Verificar que todas las materias tienen calificaciones
        asignaciones = get_asignaciones_collection()
        asignaciones_grupo = list(asignaciones.find({
            'id_grupo': grupo_obj_id,
            'activo': True
        }))
        
        matriculas = get_matriculas_collection()
        estudiantes_matriculados = list(matriculas.find({
            'id_grupo': grupo_obj_id,
            'estado': 'activa'
        }))
        
        # Verificar que cada estudiante tiene calificaciones para cada materia en el periodo
        materias_sin_calificaciones = []
        for asignacion in asignaciones_grupo:
            assignment_id = asignacion['_id']
            curso_nombre = asignacion.get('curso_info', {}).get('nombre_curso', 'Sin nombre')
            
            for matricula in estudiantes_matriculados:
                calificaciones = matricula.get('calificaciones', [])
                tiene_calificacion = False
                for c in calificaciones:
                    if c.get('id_asignacion') == assignment_id and c.get('periodo') == periodo:
                        if c.get('notas', []):
                            tiene_calificacion = True
                            break
                
                if not tiene_calificacion:
                    estudiante_info = matricula.get('estudiante_info', {})
                    estudiante_nombre = f"{estudiante_info.get('nombres', '')} {estudiante_info.get('apellidos', '')}"
                    materias_sin_calificaciones.append({
                        'estudiante': estudiante_nombre,
                        'materia': curso_nombre
                    })
        
        if materias_sin_calificaciones:
            return jsonify({
                'success': False,
                'error': 'No se pueden cerrar periodos con calificaciones pendientes',
                'pending': materias_sin_calificaciones
            }), 400
        
        # Cerrar el periodo
        grupos.update_one(
            {'_id': grupo_obj_id},
            {'$addToSet': {'periodos_cerrados': periodo}}
        )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=docente['_id'],
            accion='cerrar_periodo',
            entidad_afectada='grupos',
            id_entidad=group_id,
            detalles=f"Periodo {periodo} cerrado para el grupo"
        )
        
        return jsonify({
            'success': True,
            'message': f'Periodo {periodo} cerrado exitosamente',
            'group_id': group_id,
            'periodo': periodo
        }), 200
        
    except Exception as e:
        print(f"❌ Error en close_period: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/groups/<group_id>/reopen-period', methods=['POST'])
@token_required('docente')
def reopen_period(group_id):
    """Reabrir un periodo para un grupo (solo director de grupo)"""
    try:
        data = request.get_json()
        periodo = data.get('periodo')
        
        if not periodo:
            return jsonify({'success': False, 'error': 'Se requiere periodo'}), 400
        
        docente = get_teacher_docente()
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Verificar acceso al grupo
        access_info = check_group_access(docente, group_id)
        if not access_info['access']:
            return jsonify({'success': False, 'error': access_info['error']}), 403
        
        # Verificar que es director de grupo
        if not access_info['is_homeroom_teacher']:
            return jsonify({'success': False, 'error': 'Solo el director de grupo puede reabrir periodos'}), 403
        
        grupos = get_groups_collection()
        grupo_obj_id = access_info['grupo_obj_id']
        
        # Reabrir el periodo
        grupos.update_one(
            {'_id': grupo_obj_id},
            {'$pull': {'periodos_cerrados': periodo}}
        )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=docente['_id'],
            accion='reabrir_periodo',
            entidad_afectada='grupos',
            id_entidad=group_id,
            detalles=f"Periodo {periodo} reabierto para el grupo"
        )
        
        return jsonify({
            'success': True,
            'message': f'Periodo {periodo} reabierto exitosamente',
            'group_id': group_id,
            'periodo': periodo
        }), 200
        
    except Exception as e:
        print(f"❌ Error en reopen_period: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/groups/<group_id>/pdf-report', methods=['GET'])
@token_required('docente')
def download_group_report_pdf(group_id):
    """Generar reporte general del grupo en PDF (tabla con todos los estudiantes)"""
    try:
        periodo = request.args.get('periodo', '1')
        grupo_obj_id = string_to_objectid(group_id)
        if not grupo_obj_id:
            return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400
        
        # Get teacher info
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        if teacher_email and '@' not in teacher_email:
            teacher_email = f"{teacher_email}@colegio.edu.co"
        
        usuarios = get_usuarios_collection()
        docente = usuarios.find_one({'correo': teacher_email, 'rol': 'docente', 'activo': True})
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        asignaciones = get_asignaciones_collection()
        matriculas = get_matriculas_collection()
        grupos = get_groups_collection()
        
        asignaciones_grupo = list(asignaciones.find({
            'id_docente': docente['_id'],
            'id_grupo': grupo_obj_id,
            'activo': True
        }))
        if not asignaciones_grupo:
            return jsonify({'success': False, 'error': 'No tienes asignaturas en este grupo'}), 403
        
        ids_asignaciones = {a['_id'] for a in asignaciones_grupo}
        grupo_doc = grupos.find_one({'_id': grupo_obj_id})
        grupo_nombre = grupo_doc.get('nombre_grupo', 'N/A') if grupo_doc else 'N/A'
        grado = grupo_doc.get('grado', 'N/A') if grupo_doc else 'N/A'
        
        estudiantes_matriculados = list(matriculas.find({
            'id_grupo': grupo_obj_id,
            'estado': 'activa'
        }).sort('estudiante_info.codigo_est', 1))
        
        # Build data
        rows = []
        total_promedio = 0
        aprobados = 0
        reprobados = 0
        for matricula in estudiantes_matriculados:
            student_info = matricula.get('estudiante_info', {})
            calificaciones = matricula.get('calificaciones', [])
            notas_docente = []
            for c in calificaciones:
                if c.get('id_asignacion') in ids_asignaciones and c.get('periodo') == periodo:
                    notas_docente.extend(c.get('notas', []))
            promedio = 0
            if notas_docente:
                total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas_docente)
                total_peso = sum(n.get('peso', 0) for n in notas_docente)
                promedio = round(total / total_peso, 2) if total_peso > 0 else 0
            if promedio >= 3.0:
                aprobados += 1
            else:
                reprobados += 1
            total_promedio += promedio
            estado = 'Aprobado' if promedio >= 3.0 else 'Reprobado'
            rows.append({
                'code': student_info.get('codigo_est', ''),
                'name': f"{student_info.get('nombres', '')} {student_info.get('apellidos', '')}",
                'notas': [n.get('nota', 0) for n in notas_docente[:3]],
                'average': promedio,
                'estado': estado
            })
        
        promedio_grupo = round(total_promedio / len(rows), 2) if rows else 0
        
        # PDF generation
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Header
        p.setFont("Helvetica-Bold", 20)
        p.drawCentredString(width / 2, height - inch, "REPORTE DE CALIFICACIONES")
        p.setFont("Helvetica", 12)
        p.drawCentredString(width / 2, height - 1.4 * inch, f"Grupo: {grupo_nombre} - Grado {grado}")
        p.drawCentredString(width / 2, height - 1.8 * inch, f"Periodo: {periodo} | Docente: {docente.get('nombres', '')} {docente.get('apellidos', '')}")
        
        # Table headers
        y = height - 2.5 * inch
        p.setFont("Helvetica-Bold", 10)
        p.drawString(inch, y, "Código")
        p.drawString(2 * inch, y, "Nombre")
        p.drawString(4.8 * inch, y, "N1")
        p.drawString(5.3 * inch, y, "N2")
        p.drawString(5.8 * inch, y, "N3")
        p.drawString(6.3 * inch, y, "Prom")
        p.drawString(6.9 * inch, y, "Estado")
        y -= 0.1 * inch
        p.line(inch, y, 7.5 * inch, y)
        y -= 0.25 * inch
        
        # Table rows
        p.setFont("Helvetica", 9)
        for row in rows:
            if y < 1.5 * inch:
                p.showPage()
                y = height - inch
                p.setFont("Helvetica", 9)
            p.drawString(inch, y, row['code'])
            p.drawString(2 * inch, y, row['name'][:30])
            notas = row['notas']
            for i, n in enumerate(notas):
                p.drawString((4.8 + i * 0.5) * inch, y, f"{n:.1f}")
            for i in range(len(notas), 3):
                p.drawString((4.8 + i * 0.5) * inch, y, "-")
            p.drawString(6.3 * inch, y, f"{row['average']:.2f}")
            if row['average'] >= 3.0:
                p.setFillColorRGB(0, 0.5, 0)
            else:
                p.setFillColorRGB(0.8, 0, 0)
            p.drawString(6.9 * inch, y, row['estado'])
            p.setFillColorRGB(0, 0, 0)
            y -= 0.22 * inch
        
        # Footer stats
        y -= 0.3 * inch
        p.line(inch, y, 7.5 * inch, y)
        y -= 0.3 * inch
        p.setFont("Helvetica-Bold", 11)
        p.drawString(inch, y, f"Promedio del Grupo: {promedio_grupo:.2f}")
        p.drawString(4 * inch, y, f"Aprobados: {aprobados} | Reprobados: {reprobados}")
        p.drawString(6.5 * inch, y, f"Total: {len(rows)}")
        y -= 0.3 * inch
        p.setFont("Helvetica", 10)
        p.drawString(inch, y, f"Fecha: {datetime.now().strftime('%d/%m/%Y')}")
        
        p.showPage()
        p.save()
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'reporte_{grupo_nombre}_periodo_{periodo}.pdf'
        )
        
    except Exception as e:
        print(f"Error en download_group_report_pdf: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/groups/<group_id>/pdf-cards', methods=['GET'])
@token_required('docente')
def download_group_cards_pdf(group_id):
    """Generar boletines individuales de todos los estudiantes en un solo PDF multipágina"""
    try:
        periodo = request.args.get('periodo', '1')
        grupo_obj_id = string_to_objectid(group_id)
        if not grupo_obj_id:
            return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400
        
        # Get teacher info
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        if teacher_email and '@' not in teacher_email:
            teacher_email = f"{teacher_email}@colegio.edu.co"
        
        usuarios = get_usuarios_collection()
        docente = usuarios.find_one({'correo': teacher_email, 'rol': 'docente', 'activo': True})
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        asignaciones = get_asignaciones_collection()
        matriculas = get_matriculas_collection()
        grupos = get_groups_collection()
        
        asignaciones_grupo = list(asignaciones.find({
            'id_docente': docente['_id'],
            'id_grupo': grupo_obj_id,
            'activo': True
        }))
        if not asignaciones_grupo:
            return jsonify({'success': False, 'error': 'No tienes asignaturas en este grupo'}), 403
        
        ids_asignaciones = {a['_id'] for a in asignaciones_grupo}
        grupo_doc = grupos.find_one({'_id': grupo_obj_id})
        grupo_nombre = grupo_doc.get('nombre_grupo', 'N/A') if grupo_doc else 'N/A'
        grado = grupo_doc.get('grado', 'N/A') if grupo_doc else 'N/A'
        
        estudiantes_matriculados = list(matriculas.find({
            'id_grupo': grupo_obj_id,
            'estado': 'activa'
        }).sort('estudiante_info.codigo_est', 1))
        
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        for matricula in estudiantes_matriculados:
            student_info = matricula.get('estudiante_info', {})
            calificaciones = matricula.get('calificaciones', [])
            notas_docente = []
            for c in calificaciones:
                if c.get('id_asignacion') in ids_asignaciones and c.get('periodo') == periodo:
                    notas_docente.extend(c.get('notas', []))
            
            promedio = 0
            if notas_docente:
                total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas_docente)
                total_peso = sum(n.get('peso', 0) for n in notas_docente)
                promedio = round(total / total_peso, 2) if total_peso > 0 else 0
            
            estado = 'APROBADO' if promedio >= 3.0 else 'REPROBADO'
            
            # Header
            p.setFont("Helvetica-Bold", 18)
            p.drawCentredString(width / 2, height - inch, "BOLETÍN DE CALIFICACIONES")
            p.setFont("Helvetica", 11)
            p.drawCentredString(width / 2, height - 1.4 * inch, f"{grupo_nombre} - Grado {grado} - Periodo {periodo}")
            
            # Student info
            y = height - 2 * inch
            p.setFont("Helvetica-Bold", 11)
            p.drawString(inch, y, "Estudiante:")
            p.setFont("Helvetica", 11)
            p.drawString(2.2 * inch, y, f"{student_info.get('nombres', '')} {student_info.get('apellidos', '')}")
            y -= 0.35 * inch
            p.setFont("Helvetica-Bold", 11)
            p.drawString(inch, y, "Código:")
            p.setFont("Helvetica", 11)
            p.drawString(2.2 * inch, y, student_info.get('codigo_est', 'N/A'))
            y -= 0.5 * inch
            
            # Table headers
            p.setFont("Helvetica-Bold", 10)
            p.drawString(inch, y, "Tipo")
            p.drawString(3 * inch, y, "Nota")
            p.drawString(4 * inch, y, "Peso")
            p.drawString(5 * inch, y, "Fecha")
            p.drawString(6.2 * inch, y, "Observaciones")
            y -= 0.1 * inch
            p.line(inch, y, 7.5 * inch, y)
            y -= 0.25 * inch
            
            # Table rows
            p.setFont("Helvetica", 10)
            for nota in notas_docente:
                if y < 1.5 * inch:
                    p.showPage()
                    y = height - inch
                    p.setFont("Helvetica", 10)
                p.drawString(inch, y, nota.get('tipo', ''))
                p.drawString(3 * inch, y, f"{nota.get('nota', 0):.1f}")
                p.drawString(4 * inch, y, f"{nota.get('peso', 0):.2f}")
                fecha = nota.get('fecha_eval', '')
                if isinstance(fecha, datetime):
                    fecha = fecha.strftime('%d/%m/%Y')
                p.drawString(5 * inch, y, str(fecha)[:10])
                p.drawString(6.2 * inch, y, nota.get('comentarios', '')[:20])
                y -= 0.22 * inch
            
            if notas_docente:
                y -= 0.2 * inch
                p.line(inch, y, 7.5 * inch, y)
                y -= 0.3 * inch
                p.setFont("Helvetica-Bold", 12)
                p.drawString(inch, y, "Promedio:")
                p.drawString(2.2 * inch, y, f"{promedio:.2f}")
                y -= 0.3 * inch
                p.drawString(inch, y, "Estado:")
                if promedio >= 3.0:
                    p.setFillColorRGB(0, 0.5, 0)
                else:
                    p.setFillColorRGB(0.8, 0, 0)
                p.drawString(2.2 * inch, y, estado)
                p.setFillColorRGB(0, 0, 0)
            
            p.showPage()
        
        p.save()
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'boletines_{grupo_nombre}_periodo_{periodo}.pdf'
        )
        
    except Exception as e:
        print(f"Error en download_group_cards_pdf: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/attendance', methods=['GET'])
@token_required('docente')
def get_attendance_by_course():
    """Obtener asistencia de un curso en una fecha específica.
    
    Parámetros:
      - group_id (requerido): ID del grupo
      - fecha (requerido): Fecha en formato YYYY-MM-DD
      - course_id (opcional): ID del curso/materia específica
    """
    try:
        group_id = request.args.get('group_id')
        fecha = request.args.get('fecha')  # Formato: YYYY-MM-DD
        course_id = request.args.get('course_id')  # ID del curso/materia
        
        # Validar parámetros
        if not group_id or not fecha:
            return jsonify({
                'success': False,
                'error': 'Se requieren group_id y fecha'
            }), 400
        
        grupo_obj_id = string_to_objectid(group_id)
        if not grupo_obj_id:
            return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400

        # Convertir fecha string a datetime
        try:
            fecha_obj = datetime.strptime(fecha, '%Y-%m-%d')
        except ValueError:
            return jsonify({'success': False, 'error': 'Formato de fecha inválido'}), 400

        # Obtener docente y verificar acceso
        docente = get_teacher_docente()
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404

        # Verificar acceso al grupo
        grupos = get_groups_collection()
        grupo = grupos.find_one({'_id': grupo_obj_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404

        # Verificar si es director de grupo
        is_homeroom = False
        director_id = grupo.get('director_grupo')
        if director_id and director_id == docente['_id']:
            is_homeroom = True

        asignaciones = get_asignaciones_collection()
        asistencia = get_asistencia_collection()
        
        # Si se especifica course_id, buscar esa materia específica
        if course_id:
            curso_obj_id = string_to_objectid(course_id)
            if not curso_obj_id:
                return jsonify({'success': False, 'error': 'ID de curso inválido'}), 400
            
            # Verificar que el curso existe en este grupo
            asignacion = asignaciones.find_one({
                'id_grupo': grupo_obj_id,
                'id_curso': curso_obj_id,
                'activo': True
            })
            
            if not asignacion:
                return jsonify({'success': False, 'error': 'Curso no encontrado en este grupo'}), 404
            
            # Verificar que el docente tiene permiso (es director o imparte esta materia)
            if not is_homeroom:
                asignacion_docente = asignaciones.find_one({
                    'id_grupo': grupo_obj_id,
                    'id_curso': curso_obj_id,
                    'id_docente': docente['_id'],
                    'activo': True
                })
                if not asignacion_docente:
                    return jsonify({'success': False, 'error': 'No tienes permiso para ver este curso'}), 403
            
            # Buscar asistencia de esa materia
            registro = asistencia.find_one({
                'id_curso': curso_obj_id,
                'fecha': fecha_obj
            })
            
            if registro:
                return jsonify({
                    'success': True,
                    'is_homeroom_teacher': is_homeroom,
                    'attendance': serialize_doc(registro)
                }), 200
            else:
                return jsonify({
                    'success': True,
                    'is_homeroom_teacher': is_homeroom,
                    'attendance': None,
                    'message': 'No hay registro de asistencia para esta fecha'
                }), 200
        
        # Si NO se especifica course_id, buscar todas las asistencias del grupo
        if is_homeroom:
            # Director de grupo: obtener todas las asistencias del grupo
            asignaciones_grupo = list(asignaciones.find({
                'id_grupo': grupo_obj_id,
                'activo': True
            }))
            
            ids_cursos = [a['id_curso'] for a in asignaciones_grupo]
            registros = list(asistencia.find({
                'id_curso': {'$in': ids_cursos},
                'fecha': fecha_obj
            }))
            
            return jsonify({
                'success': True,
                'is_homeroom_teacher': True,
                'attendance_list': [serialize_doc(r) for r in registros],
                'count': len(registros)
            }), 200
        else:
            # Profesor normal: buscar su asignación (solo una)
            asignacion = asignaciones.find_one({
                'id_grupo': grupo_obj_id,
                'id_docente': docente['_id'],
                'activo': True
            })
            
            if not asignacion:
                return jsonify({'success': False, 'error': 'No tienes asignación para este grupo'}), 403
            
            curso_obj_id = asignacion['id_curso']
            registro = asistencia.find_one({
                'id_curso': curso_obj_id,
                'fecha': fecha_obj
            })
            
            if registro:
                return jsonify({
                    'success': True,
                    'is_homeroom_teacher': False,
                    'attendance': serialize_doc(registro)
                }), 200
            else:
                return jsonify({
                    'success': True,
                    'is_homeroom_teacher': False,
                    'attendance': None,
                    'message': 'No hay registro de asistencia para esta fecha'
                }), 200
        
    except Exception as e:
        print(f"❌ Error en get_attendance_by_course: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/attendance', methods=['POST'])
@token_required('docente')
def save_attendance():
    """Guardar o actualizar registro de asistencia"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['group_id', 'course_id', 'fecha', 'registros']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'El campo {field} es requerido'
                }), 400
        
        # Obtener docente
        docente = get_teacher_docente()
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Convertir IDs
        grupo_obj_id = string_to_objectid(data['group_id'])
        curso_obj_id = string_to_objectid(data['course_id'])
        
        if not grupo_obj_id or not curso_obj_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400

        # Verificar acceso al grupo
        grupos = get_groups_collection()
        grupo = grupos.find_one({'_id': grupo_obj_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404

        # Verificar si es director de grupo
        is_homeroom = False
        director_id = grupo.get('director_grupo')
        if director_id and director_id == docente['_id']:
            is_homeroom = True

        # Verificar que el curso existe en este grupo
        asignaciones = get_asignaciones_collection()
        asignacion = asignaciones.find_one({
            'id_grupo': grupo_obj_id,
            'id_curso': curso_obj_id,
            'activo': True
        })
        
        if not asignacion:
            return jsonify({'success': False, 'error': 'Curso no encontrado en este grupo'}), 404

        # Verificar permisos: director de grupo puede editar, o debe ser su asignación
        if not is_homeroom:
            asignacion_docente = asignaciones.find_one({
                'id_grupo': grupo_obj_id,
                'id_curso': curso_obj_id,
                'id_docente': docente['_id'],
                'activo': True
            })
            if not asignacion_docente:
                return jsonify({'success': False, 'error': 'Solo puede editar asistencia de las materias que imparte'}), 403

        cursos = get_cursos_collection()
        curso = cursos.find_one({'_id': curso_obj_id})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado'}), 404
        
        # Convertir fecha
        try:
            fecha_obj = datetime.strptime(data['fecha'], '%Y-%m-%d')
        except ValueError:
            return jsonify({'success': False, 'error': 'Formato de fecha inválido'}), 400
        
        # Preparar registros de asistencia con información de estudiantes
        registros_procesados = []
        matriculas = get_matriculas_collection()
        
        for registro in data['registros']:
            estudiante_id = string_to_objectid(registro['id_estudiante'])
            if not estudiante_id:
                continue
            
            # Buscar información del estudiante desde la matrícula
            matricula = matriculas.find_one({
                'id_estudiante': estudiante_id,
                'id_grupo': grupo_obj_id,
                'estado': 'activa'
            })
            
            if matricula:
                registros_procesados.append({
                    'id_estudiante': estudiante_id,
                    'estudiante_info': matricula.get('estudiante_info', {}),
                    'estado': registro.get('estado', 'presente'),
                    'observaciones': registro.get('observaciones', '')
                })
        
        # Crear documento de asistencia
        asistencia = get_asistencia_collection()
        
        documento_asistencia = {
            'id_curso': curso_obj_id,
            'id_docente': docente['_id'],
            'fecha': fecha_obj,
            'periodo': data.get('periodo', curso.get('periodo', '1')),
            'registros': registros_procesados,
            'curso_info': {
                'nombre_curso': curso.get('nombre_curso', ''),
                'codigo_curso': curso.get('codigo_curso', ''),
                'grado': curso.get('grado', '')
            },
            'actualizado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        # Verificar si ya existe registro para esa fecha
        registro_existente = asistencia.find_one({
            'id_curso': curso_obj_id,
            'fecha': fecha_obj
        })
        
        if registro_existente:
            # Actualizar registro existente
            resultado = asistencia.update_one(
                {'_id': registro_existente['_id']},
                {'$set': documento_asistencia}
            )
            
            mensaje = 'Asistencia actualizada exitosamente'
            registro_id = str(registro_existente['_id'])
        else:
            # Crear nuevo registro
            documento_asistencia['creado_en'] = Timestamp(int(datetime.utcnow().timestamp()), 0)
            resultado = asistencia.insert_one(documento_asistencia)
            mensaje = 'Asistencia registrada exitosamente'
            registro_id = str(resultado.inserted_id)
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=docente['_id'],
            accion='registrar_asistencia',
            entidad_afectada='asistencia',
            id_entidad=registro_id,
            detalles=f"Asistencia registrada para {curso.get('nombre_curso')} - {data['fecha']}"
        )
        
        return jsonify({
            'success': True,
            'message': mensaje,
            'attendance_id': registro_id
        }), 201
        
    except Exception as e:
        print(f"❌ Error en save_attendance: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/attendance/statistics', methods=['GET'])
@token_required('docente')
def get_attendance_statistics():
    """Obtener estadísticas de asistencia de un curso"""
    try:
        course_id = request.args.get('course_id')
        periodo = request.args.get('periodo')
        
        if not course_id:
            return jsonify({'success': False, 'error': 'Se requiere course_id'}), 400
        
        curso_obj_id = string_to_objectid(course_id)
        if not curso_obj_id:
            return jsonify({'success': False, 'error': 'ID de curso inválido'}), 400
        
        asistencia = get_asistencia_collection()
        
        # Construir query
        query = {'id_curso': curso_obj_id}
        if periodo:
            query['periodo'] = periodo
        
        # Obtener todos los registros de asistencia del curso
        registros = list(asistencia.find(query).sort('fecha', -1))
        
        # Calcular estadísticas
        total_registros = len(registros)
        total_estudiantes = 0
        total_presentes = 0
        total_ausentes = 0
        total_tardes = 0
        
        # Estadísticas por estudiante
        estadisticas_estudiantes = {}
        
        for registro in registros:
            for item in registro.get('registros', []):
                estudiante_id = str(item['id_estudiante'])
                estado = item.get('estado', 'presente')
                
                if estudiante_id not in estadisticas_estudiantes:
                    estadisticas_estudiantes[estudiante_id] = {
                        'estudiante_info': item.get('estudiante_info', {}),
                        'total_clases': 0,
                        'presentes': 0,
                        'ausentes': 0,
                        'tardes': 0,
                        'excusas': 0
                    }
                
                estadisticas_estudiantes[estudiante_id]['total_clases'] += 1
                
                if estado == 'presente':
                    estadisticas_estudiantes[estudiante_id]['presentes'] += 1
                    total_presentes += 1
                elif estado == 'ausente':
                    estadisticas_estudiantes[estudiante_id]['ausentes'] += 1
                    total_ausentes += 1
                elif estado == 'tarde':
                    estadisticas_estudiantes[estudiante_id]['tardes'] += 1
                    total_tardes += 1
                elif estado == 'excusa':
                    estadisticas_estudiantes[estudiante_id]['excusas'] += 1
        
        # Calcular porcentajes por estudiante
        estudiantes_stats = []
        for est_id, stats in estadisticas_estudiantes.items():
            total_clases = stats['total_clases']
            porcentaje_asistencia = round((stats['presentes'] / total_clases * 100), 2) if total_clases > 0 else 0
            
            estudiantes_stats.append({
                'estudiante_id': est_id,
                'estudiante_info': stats['estudiante_info'],
                'total_clases': total_clases,
                'presentes': stats['presentes'],
                'ausentes': stats['ausentes'],
                'tardes': stats['tardes'],
                'excusas': stats['excusas'],
                'porcentaje_asistencia': porcentaje_asistencia
            })
        
        # Ordenar por porcentaje de asistencia descendente
        estudiantes_stats.sort(key=lambda x: x['porcentaje_asistencia'], reverse=True)
        
        return jsonify({
            'success': True,
            'statistics': {
                'total_registros': total_registros,
                'total_presentes': total_presentes,
                'total_ausentes': total_ausentes,
                'total_tardes': total_tardes,
                'estudiantes': estudiantes_stats
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_attendance_statistics: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teacher/observations', methods=['GET'])
@token_required('docente')
def get_teacher_observations():
    """Obtener observaciones registradas por el docente"""
    try:
        # Obtener filtros opcionales
        curso_id = request.args.get('course_id')
        tipo = request.args.get('tipo')  # positiva, negativa, neutral
        categoria = request.args.get('categoria')
        estudiante_id = request.args.get('student_id')
        
        # Obtener ID del docente desde el token
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        teacher_sub = g.userinfo.get('sub')
        
        usuarios = get_usuarios_collection()
        
        # Buscar docente
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        if not docente:
            teacher_obj_id = string_to_objectid(teacher_sub)
            if teacher_obj_id:
                docente = usuarios.find_one({
                    '_id': teacher_obj_id,
                    'rol': 'docente',
                    'activo': True
                })
        
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Construir query
        observaciones = get_observaciones_collection()
        asignaciones = get_asignaciones_collection()
        
        # Verificar si se filtra por grupo
        group_id = request.args.get('group_id')
        
        if group_id:
            grupo_obj_id = string_to_objectid(group_id)
            if not grupo_obj_id:
                return jsonify({'success': False, 'error': 'ID de grupo inválido'}), 400
            
            # Verificar acceso al grupo
            grupos = get_groups_collection()
            grupo = grupos.find_one({'_id': grupo_obj_id})
            if not grupo:
                return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
            
            is_homeroom = False
            director_id = grupo.get('director_grupo')
            if director_id and director_id == docente['_id']:
                is_homeroom = True
            
            # Obtener IDs de cursos del grupo
            if is_homeroom:
                asignaciones_grupo = list(asignaciones.find({
                    'id_grupo': grupo_obj_id,
                    'activo': True
                }))
            else:
                asignaciones_grupo = list(asignaciones.find({
                    'id_grupo': grupo_obj_id,
                    'id_docente': docente['_id'],
                    'activo': True
                }))
            
            if not asignaciones_grupo:
                return jsonify({'success': False, 'error': 'No tienes asignaturas en este grupo'}), 403
            
            ids_cursos = [a['id_curso'] for a in asignaciones_grupo]
            
            # Construir query combinada
            query = {'id_curso': {'$in': ids_cursos}}
            
            if curso_id:
                curso_obj_id = string_to_objectid(curso_id)
                if curso_obj_id:
                    query['id_curso'] = curso_obj_id
            
            if tipo and tipo != 'todas':
                query['tipo'] = tipo.lower()
            
            if categoria:
                query['categoria'] = categoria
            
            if estudiante_id:
                estudiante_obj_id = string_to_objectid(estudiante_id)
                if estudiante_obj_id:
                    query['id_estudiante'] = estudiante_obj_id
            
            resultado = list(observaciones.find(query).sort('fecha', -1))
            
            # Calcular estadísticas
            total = len(resultado)
            positivas = len([o for o in resultado if o.get('tipo') == 'positiva'])
            negativas = len([o for o in resultado if o.get('tipo') == 'negativa'])
            neutrales = len([o for o in resultado if o.get('tipo') == 'neutral'])
            
            return jsonify({
                'success': True,
                'is_homeroom_teacher': is_homeroom,
                'observations': [serialize_doc(o) for o in resultado],
                'statistics': {
                    'total': total,
                    'positivas': positivas,
                    'negativas': negativas,
                    'neutrales': neutrales
                }
            }), 200
        else:
            # Comportamiento original: solo observaciones del docente
            query = {'id_docente': docente['_id']}
            
            if curso_id:
                curso_obj_id = string_to_objectid(curso_id)
                if curso_obj_id:
                    query['id_curso'] = curso_obj_id
            
            if tipo and tipo != 'todas':
                query['tipo'] = tipo.lower()
            
            if categoria:
                query['categoria'] = categoria
            
            if estudiante_id:
                estudiante_obj_id = string_to_objectid(estudiante_id)
                if estudiante_obj_id:
                    query['id_estudiante'] = estudiante_obj_id
            
            resultado = list(observaciones.find(query).sort('fecha', -1))
            
            # Calcular estadísticas
            total = len(resultado)
            positivas = len([o for o in resultado if o.get('tipo') == 'positiva'])
            negativas = len([o for o in resultado if o.get('tipo') == 'negativa'])
            neutrales = len([o for o in resultado if o.get('tipo') == 'neutral'])
            
            return jsonify({
                'success': True,
                'is_homeroom_teacher': False,
                'observations': [serialize_doc(o) for o in resultado],
                'statistics': {
                    'total': total,
                    'positivas': positivas,
                    'negativas': negativas,
                    'neutrales': neutrales
                }
            }), 200
        
    except Exception as e:
        print(f"❌ Error en get_teacher_observations: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/teacher/observations', methods=['POST'])
@token_required('docente')
def create_observation():
    """Crear una nueva observación"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['student_id', 'course_id', 'tipo', 'descripcion']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'El campo {field} es requerido'
                }), 400
        
        # Obtener ID del docente desde el token
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        teacher_sub = g.userinfo.get('sub')
        
        usuarios = get_usuarios_collection()
        
        # Buscar docente
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        if not docente:
            teacher_obj_id = string_to_objectid(teacher_sub)
            if teacher_obj_id:
                docente = usuarios.find_one({
                    '_id': teacher_obj_id,
                    'rol': 'docente',
                    'activo': True
                })
        
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        # Validar campos requeridos
        required_fields = ['student_id', 'group_id', 'course_id', 'tipo', 'descripcion']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'El campo {field} es requerido'
                }), 400
        
        # Convertir IDs
        estudiante_id = string_to_objectid(data['student_id'])
        grupo_id = string_to_objectid(data['group_id'])
        curso_id = string_to_objectid(data['course_id'])

        if not estudiante_id or not grupo_id or not curso_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400

        # Verificar que el estudiante existe
        estudiante = usuarios.find_one({'_id': estudiante_id, 'rol': 'estudiante'})
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404

        # Verificar acceso al grupo
        grupos = get_groups_collection()
        grupo = grupos.find_one({'_id': grupo_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404

        # Verificar si es director de grupo
        is_homeroom = False
        director_id = grupo.get('director_grupo')
        if director_id and director_id == docente['_id']:
            is_homeroom = True

        # Verificar que el curso existe en este grupo
        asignaciones = get_asignaciones_collection()
        asignacion = asignaciones.find_one({
            'id_grupo': grupo_id,
            'id_curso': curso_id,
            'activo': True
        })
        if not asignacion:
            return jsonify({'success': False, 'error': 'Curso no encontrado en este grupo'}), 404

        cursos = get_cursos_collection()
        curso = cursos.find_one({'_id': curso_id})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado'}), 404

        # Verificar permisos: director de grupo puede crear, o debe ser su asignación
        if not is_homeroom:
            asignacion_docente = asignaciones.find_one({
                'id_grupo': grupo_id,
                'id_curso': curso_id,
                'id_docente': docente['_id'],
                'activo': True
            })
            if not asignacion_docente:
                return jsonify({
                    'success': False,
                    'error': 'Solo puede crear observaciones en las materias que imparte'
                }), 403
        
        # Validar tipo
        tipo = data['tipo'].lower()
        if tipo not in ['positiva', 'negativa', 'neutral']:
            return jsonify({'success': False, 'error': 'Tipo de observación inválido'}), 400
        
        # Crear documento de observación
        observaciones = get_observaciones_collection()
        
        nueva_observacion = {
            'id_estudiante': estudiante_id,
            'id_docente': docente['_id'],
            'id_curso': curso_id,
            'tipo': tipo,
            'descripcion': data['descripcion'],
            'fecha': datetime.utcnow(),
            'seguimiento': data.get('seguimiento', ''),
            'categoria': data.get('categoria', 'otra'),
            'gravedad': data.get('gravedad', 'leve') if tipo == 'negativa' else 'leve',
            'notificado_acudiente': data.get('notificado_acudiente', False),
            'fecha_notificacion': datetime.utcnow() if data.get('notificado_acudiente') else datetime.utcnow(),
            'estudiante_info': {
                'nombres': estudiante.get('nombres', ''),
                'apellidos': estudiante.get('apellidos', ''),
                'codigo_est': estudiante.get('codigo_est', '')
            },
            'docente_info': {
                'nombres': docente.get('nombres', ''),
                'apellidos': docente.get('apellidos', ''),
                'especialidad': docente.get('especialidad', '')
            },
            'curso_info': {
                'nombre_curso': curso.get('nombre_curso', ''),
                'codigo_curso': curso.get('codigo_curso', ''),
                'grado': curso.get('grado', '')
            },
            'archivos_adjuntos': data.get('archivos_adjuntos', []),
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0),
            'actualizado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        # Insertar observación
        resultado = observaciones.insert_one(nueva_observacion)
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=docente['_id'],
            accion='crear_observacion',
            entidad_afectada='observaciones',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Observación {tipo} creada para {estudiante.get('nombres')} {estudiante.get('apellidos')}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Observación creada exitosamente',
            'observation_id': str(resultado.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"❌ Error en create_observation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/teacher/observations/<observation_id>', methods=['PUT'])
@token_required('docente')
def update_observation(observation_id):
    """Actualizar una observación existente"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Convertir observation_id
        obs_obj_id = string_to_objectid(observation_id)
        if not obs_obj_id:
            return jsonify({'success': False, 'error': 'ID de observación inválido'}), 400
        
        # Obtener ID del docente desde el token
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        teacher_sub = g.userinfo.get('sub')
        
        usuarios = get_usuarios_collection()
        
        # Buscar docente
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        if not docente:
            teacher_obj_id = string_to_objectid(teacher_sub)
            if teacher_obj_id:
                docente = usuarios.find_one({
                    '_id': teacher_obj_id,
                    'rol': 'docente',
                    'activo': True
                })
        
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        observaciones = get_observaciones_collection()
        
        # Verificar que la observación existe y pertenece al docente
        observacion = observaciones.find_one({'_id': obs_obj_id})
        
        if not observacion:
            return jsonify({'success': False, 'error': 'Observación no encontrada'}), 404
        
        if observacion.get('id_docente') != docente['_id']:
            return jsonify({
                'success': False,
                'error': 'No tienes permiso para editar esta observación'
            }), 403
        
        # Preparar actualización
        actualizacion = {
            'actualizado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
        }
        
        # Campos actualizables
        campos_permitidos = ['descripcion', 'seguimiento', 'tipo', 'categoria', 'gravedad', 
                            'notificado_acudiente']
        
        for campo in campos_permitidos:
            if campo in data:
                actualizacion[campo] = data[campo]
        
        # Si se marca como notificado, agregar fecha
        if data.get('notificado_acudiente') and not observacion.get('fecha_notificacion'):
            actualizacion['fecha_notificacion'] = datetime.utcnow()
        
        # Actualizar observación
        observaciones.update_one(
            {'_id': obs_obj_id},
            {'$set': actualizacion}
        )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=docente['_id'],
            accion='actualizar_observacion',
            entidad_afectada='observaciones',
            id_entidad=observation_id,
            detalles=f"Observación actualizada"
        )
        
        # Obtener observación actualizada
        obs_actualizada = observaciones.find_one({'_id': obs_obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Observación actualizada exitosamente',
            'observation': serialize_doc(obs_actualizada)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en update_observation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/teacher/observations/<observation_id>', methods=['DELETE'])
@token_required('docente')
def delete_observation(observation_id):
    """Eliminar una observación"""
    try:
        # Convertir observation_id
        obs_obj_id = string_to_objectid(observation_id)
        if not obs_obj_id:
            return jsonify({'success': False, 'error': 'ID de observación inválido'}), 400
        
        # Obtener ID del docente desde el token
        teacher_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        teacher_sub = g.userinfo.get('sub')
        
        usuarios = get_usuarios_collection()
        
        # Buscar docente
        docente = usuarios.find_one({
            'correo': teacher_email,
            'rol': 'docente',
            'activo': True
        })
        
        if not docente:
            teacher_obj_id = string_to_objectid(teacher_sub)
            if teacher_obj_id:
                docente = usuarios.find_one({
                    '_id': teacher_obj_id,
                    'rol': 'docente',
                    'activo': True
                })
        
        if not docente:
            return jsonify({'success': False, 'error': 'Docente no encontrado'}), 404
        
        observaciones = get_observaciones_collection()
        
        # Verificar que la observación existe y pertenece al docente
        observacion = observaciones.find_one({'_id': obs_obj_id})
        
        if not observacion:
            return jsonify({'success': False, 'error': 'Observación no encontrada'}), 404
        
        if observacion.get('id_docente') != docente['_id']:
            return jsonify({
                'success': False,
                'error': 'No tienes permiso para eliminar esta observación'
            }), 403
        
        # Eliminar observación
        observaciones.delete_one({'_id': obs_obj_id})
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=docente['_id'],
            accion='eliminar_observacion',
            entidad_afectada='observaciones',
            id_entidad=observation_id,
            detalles=f"Observación eliminada"
        )
        
        return jsonify({
            'success': True,
            'message': 'Observación eliminada exitosamente'
        }), 200
        
    except Exception as e:
        print(f"❌ Error en delete_observation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/teacher/observations/student/<student_id>', methods=['GET'])
@token_required('docente')
def get_student_observations(student_id):
    """Obtener historial de observaciones de un estudiante específico"""
    try:
        # Convertir student_id
        estudiante_obj_id = string_to_objectid(student_id)
        if not estudiante_obj_id:
            return jsonify({'success': False, 'error': 'ID de estudiante inválido'}), 400
        
        observaciones = get_observaciones_collection()
        
        # Obtener observaciones del estudiante ordenadas por fecha
        resultado = list(observaciones.find(
            {'id_estudiante': estudiante_obj_id}
        ).sort('fecha', -1))
        
        # Calcular estadísticas del estudiante
        total = len(resultado)
        positivas = len([o for o in resultado if o.get('tipo') == 'positiva'])
        negativas = len([o for o in resultado if o.get('tipo') == 'negativa'])
        neutrales = len([o for o in resultado if o.get('tipo') == 'neutral'])
        
        return jsonify({
            'success': True,
            'observations': [serialize_doc(o) for o in resultado],
            'statistics': {
                'total': total,
                'positivas': positivas,
                'negativas': negativas,
                'neutrales': neutrales
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_student_observations: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
# Manejo de errores
@app.route('/teacher/periodo-activo', methods=['GET'])
@token_required('docente')
def get_periodo_activo_teacher():
    """Obtener el periodo activo actual para el docente"""
    try:
        from database.db_config import get_periodos_collection
        periodos = get_periodos_collection()
        
        periodo_activo = periodos.find_one({'activo': True})
        
        if not periodo_activo:
            return jsonify({
                'success': False,
                'error': 'No hay periodo activo configurado'
            }), 404
        
        # Verificar si la fecha actual esta dentro del periodo de calificaciones
        ahora = datetime.utcnow()
        fecha_limite = periodo_activo.get('fecha_limite_calificaciones')
        
        puede_calificar = True
        if fecha_limite:
            if isinstance(fecha_limite, str):
                fecha_limite = datetime.fromisoformat(fecha_limite.replace('Z', '+00:00'))
            if ahora > fecha_limite:
                puede_calificar = False
        
        return jsonify({
            'success': True,
            'periodo': serialize_doc(periodo_activo),
            'puede_calificar': puede_calificar,
            'fecha_actual': ahora.isoformat()
        }), 200
        
    except Exception as e:
        print(f"Error en get_periodo_activo_teacher: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)