from flask import Flask, request, jsonify, g
from flask_cors import CORS
from datetime import datetime
from functools import wraps
import sys
import os

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_usuarios_collection,
    get_cursos_collection,
    get_matriculas_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

try:
    from keycloak import KeycloakOpenID
except Exception:
    KeycloakOpenID = None

app = Flask(__name__)
app.secret_key = os.getenv('APP_SECRET', 'PlataformaColegios')
CORS(app)

# Keycloak configuration
KEYCLOAK_SERVER = os.getenv('KEYCLOAK_SERVER_URL', 'http://localhost:8082')
KEYCLOAK_CLIENT_ID = os.getenv('KEYCLOAK_CLIENT_ID', '01')
KEYCLOAK_REALM = os.getenv('KEYCLOAK_REALM', 'plataformaInstitucional')
KEYCLOAK_CLIENT_SECRET = os.getenv('KEYCLOAK_CLIENT_SECRET', '2m2KWH4lyYgh9CwoM1y2QI6bFrDjR3OV')

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
            if keycloak_openid is None:
                # Modo desarrollo
                g.userinfo = {'sub': 'dev-user', 'roles': [rol_requerido]}
                return f(*args, **kwargs)
                
            auth_header = request.headers.get('Authorization', None)
            if not auth_header:
                return jsonify({"error": "Token Requerido"}), 401
            
            try:
                token = auth_header.split(" ")[1]
                userinfo = keycloak_openid.decode_token(token)
            except Exception:
                return jsonify({"error": "Token inválido o expirado"}), 401
                
            if not tiene_rol(userinfo, KEYCLOAK_CLIENT_ID, rol_requerido):
                return jsonify({"error": f"Acceso denegado: se requiere el rol '{rol_requerido}'"}), 403
            
            g.userinfo = userinfo
            return f(*args, **kwargs)
        return decorated
    return decorator


@app.route('/')
def home():
    return jsonify({
        'service': 'Groups Service (Cursos)',
        'version': '2.0.0',
        'database': 'MongoDB',
        'endpoints': {
            'get_all': 'GET /groups',
            'get_one': 'GET /groups/{id}',
            'create': 'POST /groups',
            'update': 'PUT /groups/{id}',
            'delete': 'DELETE /groups/{id}',
            'add_student': 'POST /groups/{id}/students/{student_id}',
            'remove_student': 'DELETE /groups/{id}/students/{student_id}',
            'get_students': 'GET /groups/{id}/students'
        }
    })


@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'groups', 'database': 'MongoDB'})


@app.route('/groups', methods=['GET'])
def get_groups():
    """Obtener todos los cursos/grupos"""
    try:
        cursos = get_cursos_collection()
        
        # Filtros opcionales
        grado = request.args.get('grade_level') or request.args.get('grado')
        periodo = request.args.get('periodo')
        teacher_id = request.args.get('teacher_id')
        
        # Construir query
        query = {}
        
        if grado:
            query['grado'] = grado
        
        if periodo:
            query['periodo'] = periodo
        
        if teacher_id:
            obj_id = string_to_objectid(teacher_id)
            if obj_id:
                query['id_docente'] = obj_id
        
        # Buscar cursos
        cursos_list = list(cursos.find(query))
        
        # Serializar documentos
        cursos_serializados = serialize_doc(cursos_list)
        
        return jsonify({
            'groups': cursos_serializados,
            'count': len(cursos_serializados)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/groups/<group_id>', methods=['GET'])
def get_group(group_id):
    """Obtener un curso/grupo por ID"""
    try:
        cursos = get_cursos_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(group_id)
        if not obj_id:
            return jsonify({'error': 'Invalid group ID'}), 400
        
        # Buscar curso
        curso = cursos.find_one({'_id': obj_id})
        
        if not curso:
            return jsonify({'error': 'Group not found'}), 404
        
        return jsonify({'group': serialize_doc(curso)}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/groups', methods=['POST'])
def create_group():
    """Crear un nuevo curso/grupo"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validar campos requeridos
        required_fields = ['nombre_curso', 'codigo_curso', 'periodo']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        cursos = get_cursos_collection()
        
        # Verificar si el código ya existe
        if cursos.find_one({'codigo_curso': data['codigo_curso']}):
            return jsonify({'error': 'Course code already exists'}), 400
        
        # Obtener información del docente si se proporciona
        docente_info = None
        id_docente = None
        if data.get('id_docente') or data.get('teacher_id'):
            docente_id = data.get('id_docente') or data.get('teacher_id')
            id_docente = string_to_objectid(docente_id)
            
            if id_docente:
                usuarios = get_usuarios_collection()
                docente = usuarios.find_one({'_id': id_docente, 'rol': 'docente'})
                if docente:
                    docente_info = {
                        'nombres': docente.get('nombres', ''),
                        'apellidos': docente.get('apellidos', ''),
                        'especialidad': docente.get('especialidad', '')
                    }
        
        # Crear documento de curso
        curso = {
            'nombre_curso': data['nombre_curso'],
            'codigo_curso': data['codigo_curso'],
            'id_docente': id_docente,
            'grado': data.get('grado', ''),
            'periodo': data['periodo'],
            'capacidad_max': int(data.get('capacidad_max', 30)),
            'activo': data.get('activo', True)
        }
        
        if docente_info:
            curso['docente_info'] = docente_info
        
        # Insertar en MongoDB
        result = cursos.insert_one(curso)
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='crear_curso',
            entidad_afectada='cursos',
            id_entidad=str(result.inserted_id),
            detalles=f"Curso creado: {data['nombre_curso']}"
        )
        
        curso['_id'] = result.inserted_id
        
        return jsonify({
            'message': 'Group created successfully',
            'group': serialize_doc(curso)
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/groups/<group_id>', methods=['PUT'])
def update_group(group_id):
    """Actualizar un curso/grupo"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        cursos = get_cursos_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(group_id)
        if not obj_id:
            return jsonify({'error': 'Invalid group ID'}), 400
        
        # Verificar que el curso existe
        curso = cursos.find_one({'_id': obj_id})
        if not curso:
            return jsonify({'error': 'Group not found'}), 404
        
        # Preparar actualización
        update_data = {}
        updatable_fields = ['nombre_curso', 'codigo_curso', 'grado', 'periodo', 'capacidad_max', 'activo']
        
        for field in updatable_fields:
            if field in data:
                if field == 'capacidad_max':
                    update_data[field] = int(data[field])
                else:
                    update_data[field] = data[field]
        
        # Actualizar docente si se proporciona
        if 'id_docente' in data or 'teacher_id' in data:
            docente_id = data.get('id_docente') or data.get('teacher_id')
            id_docente = string_to_objectid(docente_id)
            
            if id_docente:
                update_data['id_docente'] = id_docente
                
                # Actualizar info denormalizada del docente
                usuarios = get_usuarios_collection()
                docente = usuarios.find_one({'_id': id_docente, 'rol': 'docente'})
                if docente:
                    update_data['docente_info'] = {
                        'nombres': docente.get('nombres', ''),
                        'apellidos': docente.get('apellidos', ''),
                        'especialidad': docente.get('especialidad', '')
                    }
        
        # Actualizar en MongoDB
        result = cursos.update_one(
            {'_id': obj_id},
            {'$set': update_data}
        )
        
        if result.modified_count > 0:
            # Registrar auditoría
            registrar_auditoria(
                id_usuario=None,
                accion='actualizar_curso',
                entidad_afectada='cursos',
                id_entidad=group_id,
                detalles=f"Curso actualizado: {update_data.get('nombre_curso', '')}"
            )
        
        # Obtener curso actualizado
        curso_actualizado = cursos.find_one({'_id': obj_id})
        
        return jsonify({
            'message': 'Group updated successfully',
            'group': serialize_doc(curso_actualizado)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Eliminar (desactivar) un curso/grupo"""
    try:
        cursos = get_cursos_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(group_id)
        if not obj_id:
            return jsonify({'error': 'Invalid group ID'}), 400
        
        # Buscar curso
        curso = cursos.find_one({'_id': obj_id})
        if not curso:
            return jsonify({'error': 'Group not found'}), 404
        
        # Desactivar en lugar de eliminar
        result = cursos.update_one(
            {'_id': obj_id},
            {'$set': {'activo': False}}
        )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='desactivar_curso',
            entidad_afectada='cursos',
            id_entidad=group_id,
            detalles=f"Curso desactivado: {curso.get('nombre_curso')}"
        )
        
        return jsonify({
            'message': 'Group deactivated successfully',
            'deleted_group': serialize_doc(curso)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/groups/<group_id>/students/<student_id>', methods=['POST'])
def add_student_to_group(group_id, student_id):
    """Agregar un estudiante a un curso (crear matrícula)"""
    try:
        cursos = get_cursos_collection()
        usuarios = get_usuarios_collection()
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        curso_obj_id = string_to_objectid(group_id)
        estudiante_obj_id = string_to_objectid(student_id)
        
        if not curso_obj_id or not estudiante_obj_id:
            return jsonify({'error': 'Invalid IDs'}), 400
        
        # Verificar que el curso existe
        curso = cursos.find_one({'_id': curso_obj_id})
        if not curso:
            return jsonify({'error': 'Group not found'}), 404
        
        # Verificar que el estudiante existe
        estudiante = usuarios.find_one({'_id': estudiante_obj_id, 'rol': 'estudiante'})
        if not estudiante:
            return jsonify({'error': 'Student not found'}), 404
        
        # Verificar si ya está matriculado
        matricula_existente = matriculas.find_one({
            'id_estudiante': estudiante_obj_id,
            'id_curso': curso_obj_id
        })
        
        if matricula_existente:
            return jsonify({'error': 'Student already enrolled in this course'}), 400
        
        # Crear matrícula
        matricula = {
            'id_estudiante': estudiante_obj_id,
            'id_curso': curso_obj_id,
            'fecha_matricula': datetime.utcnow(),
            'estado': 'activo',
            'calificaciones': [],
            'estudiante_info': {
                'nombres': estudiante.get('nombres', ''),
                'apellidos': estudiante.get('apellidos', ''),
                'codigo_est': estudiante.get('codigo_est', '')
            },
            'curso_info': {
                'nombre_curso': curso.get('nombre_curso', ''),
                'codigo_curso': curso.get('codigo_curso', ''),
                'grado': curso.get('grado', ''),
                'periodo': curso.get('periodo', '')
            }
        }
        
        # Insertar matrícula
        result = matriculas.insert_one(matricula)
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='matricular_estudiante',
            entidad_afectada='matriculas',
            id_entidad=str(result.inserted_id),
            detalles=f"Estudiante {estudiante.get('nombres')} matriculado en {curso.get('nombre_curso')}"
        )
        
        return jsonify({
            'message': 'Student added to group successfully',
            'enrollment': serialize_doc(matricula)
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/groups/<group_id>/students/<student_id>', methods=['DELETE'])
def remove_student_from_group(group_id, student_id):
    """Remover un estudiante de un curso (cambiar estado de matrícula)"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        curso_obj_id = string_to_objectid(group_id)
        estudiante_obj_id = string_to_objectid(student_id)
        
        if not curso_obj_id or not estudiante_obj_id:
            return jsonify({'error': 'Invalid IDs'}), 400
        
        # Buscar matrícula
        matricula = matriculas.find_one({
            'id_estudiante': estudiante_obj_id,
            'id_curso': curso_obj_id
        })
        
        if not matricula:
            return jsonify({'error': 'Enrollment not found'}), 404
        
        # Cambiar estado a retirado
        matriculas.update_one(
            {'_id': matricula['_id']},
            {'$set': {'estado': 'retirado'}}
        )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='retirar_estudiante',
            entidad_afectada='matriculas',
            id_entidad=str(matricula['_id']),
            detalles=f"Estudiante retirado del curso"
        )
        
        return jsonify({
            'message': 'Student removed from group successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/groups/<group_id>/students', methods=['GET'])
def get_group_students(group_id):
    """Obtener estudiantes de un curso"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        curso_obj_id = string_to_objectid(group_id)
        if not curso_obj_id:
            return jsonify({'error': 'Invalid group ID'}), 400
        
        # Buscar matrículas activas del curso
        matriculas_curso = list(matriculas.find({
            'id_curso': curso_obj_id,
            'estado': 'activo'
        }))
        
        # Extraer información de estudiantes
        estudiantes = []
        for matricula in matriculas_curso:
            estudiante_info = matricula.get('estudiante_info', {})
            estudiantes.append({
                'id': str(matricula.get('id_estudiante')),
                'nombres': estudiante_info.get('nombres', ''),
                'apellidos': estudiante_info.get('apellidos', ''),
                'codigo_est': estudiante_info.get('codigo_est', ''),
                'fecha_matricula': matricula.get('fecha_matricula', '').isoformat() if matricula.get('fecha_matricula') else ''
            })
        
        return jsonify({
            'students': estudiantes,
            'count': len(estudiantes)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Manejo de errores
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5003)
