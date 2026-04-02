from flask import Flask, request, jsonify, g, send_file
from flask_cors import CORS
from datetime import datetime
from keycloak import KeycloakOpenID
import jwt as pyjwt
from functools import wraps
import sys
import os
from bson.timestamp import Timestamp
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.pdf_generator import PDFGenerator
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from io import BytesIO


# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_usuarios_collection,
    get_matriculas_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

app = Flask(__name__)
app.secret_key = "PlataformaColegios"

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
        'service': 'Students Service',
        'version': '2.0.0',
        'database': 'MongoDB',
        'endpoints': {
            'get_all': 'GET /students',
            'get_one': 'GET /students/{id}',
            'create': 'POST /students',
            'update': 'PUT /students/{id}',
            'delete': 'DELETE /students/{id}',
            'grades': 'GET /students/{id}/grades',
            'enrollments': 'GET /students/{id}/enrollments'
        }
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'students', 'database': 'MongoDB'})

@app.route('/student/grades', methods=['GET', 'OPTIONS'])
@token_required('estudiante')
def get_student_grades_dashboard():
    """Endpoint para el dashboard de estudiante - Calificaciones"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        student_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        
        if not student_email:
            return jsonify({'success': False, 'error': 'Email no encontrado'}), 400
        
        usuarios = get_usuarios_collection()
        matriculas = get_matriculas_collection()
        
        estudiante = usuarios.find_one({
            'correo': student_email,
            'rol': 'estudiante',
            'activo': True
        })
        
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        # ✅ CAMBIO: Buscar con 'activa'
        student_matriculas = list(matriculas.find({
            'id_estudiante': estudiante['_id'],
            'estado': 'activa'  # ✅ CAMBIO AQUÍ
        }))
        
        if not student_matriculas:
            return jsonify({
                'average': 0.0,
                'recent': []
            }), 200
        
        # Calcular promedio y obtener calificaciones recientes
        all_grades = []
        
        for matricula in student_matriculas:
            calificaciones_raw = matricula.get('calificaciones', [])
            
            for cal_asignacion in calificaciones_raw:
                notas = cal_asignacion.get('notas', [])
                id_asignacion = cal_asignacion.get('id_asignacion')
                
                # Obtener nombre del curso
                from database.db_config import get_asignaciones_collection
                asignaciones = get_asignaciones_collection()
                asignacion = asignaciones.find_one({'_id': id_asignacion})
                
                nombre_curso = "N/A"
                if asignacion:
                    nombre_curso = asignacion.get('curso_info', {}).get('nombre_curso', 'N/A')
                
                for nota in notas:
                    all_grades.append({
                        'subject': nombre_curso,
                        'grade': nota.get('nota', 0),
                        'date': nota.get('fecha_eval', '').strftime('%Y-%m-%d') if nota.get('fecha_eval') else ''
                    })
        
        # Ordenar por fecha más reciente
        all_grades.sort(key=lambda x: x['date'], reverse=True)
        
        # Calcular promedio general
        if all_grades:
            promedio = round(sum(g['grade'] for g in all_grades) / len(all_grades), 2)
        else:
            promedio = 0.0
        
        return jsonify({
            'average': promedio,
            'recent': all_grades[:5]  # Últimas 5 calificaciones
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_student_grades: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/student/notifications', methods=['GET', 'OPTIONS'])
def get_student_notifications_dashboard():
    """Endpoint para el dashboard de estudiante - Notificaciones"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Por ahora devolver notificaciones mock
        # TODO: Implementar sistema de notificaciones en la base de datos
        
        return jsonify({
            'urgent': 'Entrega de proyecto de Matemáticas el viernes 25 de noviembre',
            'notifications': [
                {
                    'title': 'Nueva tarea de Matemáticas asignada',
                    'date': '2024-11-18',
                    'type': 'tarea'
                },
                {
                    'title': 'Calificaciones actualizadas en Español',
                    'date': '2024-11-17',
                    'type': 'calificacion'
                },
                {
                    'title': 'Reunión de padres próxima semana',
                    'date': '2024-11-16',
                    'type': 'evento'
                }
            ]
        }), 200
        
    except Exception as e:
        print(f"Error en /student/notifications: {e}")
        return jsonify({
            'urgent': None,
            'notifications': []
        }), 200


@app.route('/student/schedule', methods=['GET', 'OPTIONS'])
@token_required('estudiante')
def get_student_schedule_dashboard():
    """Endpoint para el dashboard de estudiante - Horario"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        student_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        
        if not student_email:
            return jsonify({'success': False, 'error': 'Email no encontrado'}), 400
        
        usuarios = get_usuarios_collection()
        
        # Buscar estudiante
        estudiante = usuarios.find_one({
            'correo': student_email,
            'rol': 'estudiante',
            'activo': True
        })
        
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        print(f"✅ Estudiante: {estudiante.get('nombres')} {estudiante.get('apellidos')}")
        
        # ✅ Obtener id_grupo del estudiante
        grupo_obj_id = estudiante.get('id_grupo')
        
        if not grupo_obj_id:
            print("❌ Estudiante sin id_grupo")
            return jsonify({
                'success': False,
                'error': 'Estudiante sin grupo asignado'
            }), 404
        
        # ✅ Buscar información del grupo
        from database.db_config import get_groups_collection
        grupos = get_groups_collection()
        
        grupo = grupos.find_one({'_id': grupo_obj_id})
        
        if not grupo:
            print(f"❌ Grupo con ID {grupo_obj_id} no encontrado")
            return jsonify({
                'success': False,
                'error': 'Grupo no encontrado'
            }), 404
        
        nombre_grupo = grupo.get('nombre_grupo', 'Sin grupo')
        print(f"📚 Grupo del estudiante: {nombre_grupo}")
        
        # ✅ Buscar horario del grupo
        from database.db_config import get_horarios_collection
        horarios = get_horarios_collection()
        
        horario_grupo = horarios.find_one({
            'grupo': nombre_grupo,
            'año_lectivo': '2025'
        })
        
        if not horario_grupo:
            print(f"⚠️ No se encontró horario para el grupo {nombre_grupo}")
            return jsonify({
                'success': True,
                'grupo': nombre_grupo,
                'grado': grupo.get('grado', 'N/A'),
                'horario': [],
                'message': 'No hay horario configurado para tu grupo',
                'año_lectivo': '2025',
                # Horario de hoy vacío para el dashboard
                'date': datetime.now().strftime('%Y-%m-%d'),
                'events': []
            }), 200
        
        print(f"✅ Horario encontrado para {nombre_grupo}")
        
        # ✅ Formatear horario para el dashboard (eventos de hoy)
        day_of_week = datetime.now().strftime('%A').lower()
        day_map = {
            'monday': 'lunes',
            'tuesday': 'martes',
            'wednesday': 'miércoles',
            'thursday': 'jueves',
            'friday': 'viernes'
        }
        dia_hoy = day_map.get(day_of_week, 'lunes')
        
        eventos_hoy = []
        for bloque in horario_grupo.get('horario', []):
            if bloque.get('dia') == dia_hoy:
                curso_info = bloque.get('curso_info', {})
                eventos_hoy.append({
                    'time': f"{bloque.get('hora_inicio')} - {bloque.get('hora_fin')}",
                    'subject': curso_info.get('nombre_curso', 'N/A'),
                    'teacher': curso_info.get('docente_nombres', 'N/A'),
                    'room': curso_info.get('salon', 'N/A')
                })
        
        return jsonify({
            'success': True,
            'grupo': nombre_grupo,
            'grado': grupo.get('grado', 'N/A'),
            'date': datetime.now().strftime('%Y-%m-%d'),
            'events': eventos_hoy,
            'año_lectivo': '2025'
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_student_schedule: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/student/profile', methods=['GET'])
@token_required('estudiante')
def get_student_profile():
    try:
        student_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        student_sub = g.userinfo.get('sub')
        
        usuarios = get_usuarios_collection()
        
        # Buscar estudiante
        estudiante = usuarios.find_one({'correo': student_email, 'rol': 'estudiante'})
        
        # ✅ Si no existe, crearlo automáticamente desde Keycloak
        if not estudiante:
            print(f"ℹ️ Estudiante no existe en MongoDB, creando desde Keycloak...")
            
            nuevo_estudiante = {
                'correo': student_email,
                'keycloak_id': student_sub,
                'rol': 'estudiante',
                'nombres': g.userinfo.get('given_name', 'Sin nombre'),
                'apellidos': g.userinfo.get('family_name', 'Sin apellido'),
                'codigo_est': f'AUTO-{student_sub[:8]}',
                'activo': True,
                'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0)
            }
            
            resultado = usuarios.insert_one(nuevo_estudiante)
            estudiante = usuarios.find_one({'_id': resultado.inserted_id})
            
            print(f"✅ Estudiante creado automáticamente: {estudiante.get('correo')}")
        
        return jsonify({
            'success': True,
            'profile': serialize_doc(estudiante)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500        

@app.route('/student/courses', methods=['GET'])
@token_required('estudiante')
def get_student_courses():
    """Obtener cursos matriculados del estudiante con calificaciones por periodo"""
    try:
        student_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        
        if not student_email:
            return jsonify({'success': False, 'error': 'Email no encontrado'}), 400
        
        usuarios = get_usuarios_collection()
        matriculas = get_matriculas_collection()
        
        estudiante = usuarios.find_one({
            'correo': student_email,
            'rol': 'estudiante',
            'activo': True
        })
        
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        print(f"✅ Estudiante: {estudiante.get('nombres')} {estudiante.get('apellidos')}")
        
        # ✅ CAMBIO: Buscar con 'activa' en lugar de 'activo'
        student_matriculas = list(matriculas.find({
            'id_estudiante': estudiante['_id'],
            'estado': 'activa'  # ✅ CAMBIO AQUÍ
        }))
        
        print(f"📚 Matrículas encontradas: {len(student_matriculas)}")
        
        if not student_matriculas:
            return jsonify({
                'success': True,
                'courses': [],
                'count': 0
            }), 200
        
        cursos = []
        for matricula in student_matriculas:
            grupo_info = matricula.get('grupo_info', {})
            calificaciones_raw = matricula.get('calificaciones', [])
            
            print(f"📊 Procesando matrícula - Grupo: {grupo_info.get('nombre_grupo')}")
            print(f"   Calificaciones raw: {len(calificaciones_raw)}")
            
            # Procesar cada asignación (asignatura)
            for cal_asignacion in calificaciones_raw:
                id_asignacion = cal_asignacion.get('id_asignacion')
                periodo = cal_asignacion.get('periodo', '1')
                notas = cal_asignacion.get('notas', [])
                
                # Obtener info de la asignación
                from database.db_config import get_asignaciones_collection
                asignaciones = get_asignaciones_collection()
                
                asignacion = asignaciones.find_one({'_id': id_asignacion})
                
                if not asignacion:
                    continue
                
                curso_info = asignacion.get('curso_info', {})
                docente_info = asignacion.get('docente_info', {})
                
                # Calcular promedio de las notas
                if notas:
                    total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas)
                    total_peso = sum(n.get('peso', 0) for n in notas)
                    promedio = round(total / total_peso, 2) if total_peso > 0 else 0
                else:
                    promedio = 0
                
                cursos.append({
                    'curso_id': str(id_asignacion),
                    'nombre_curso': curso_info.get('nombre_curso', 'N/A'),
                    'codigo_curso': curso_info.get('codigo_curso', 'N/A'),
                    'grado': curso_info.get('grado', 'N/A'),
                    'periodo': periodo,
                    'docente': f"{docente_info.get('nombres', '')} {docente_info.get('apellidos', '')}",
                    'promedio': promedio,
                    'calificaciones': serialize_doc(notas)
                })
        
        print(f"✅ Total cursos procesados: {len(cursos)}")
        
        return jsonify({
            'success': True,
            'courses': cursos,
            'count': len(cursos)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en get_student_courses: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
            
@app.route('/student/certificado/<tipo>', methods=['GET'])
@token_required('estudiante')
def download_certificado(tipo):
    """Generar certificado en PDF"""
    try:
        # ✅ SOLO obtener email del token
        student_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        
        if not student_email:
            return jsonify({'success': False, 'error': 'Email no encontrado en el token'}), 400
        
        usuarios = get_usuarios_collection()
        
        # ✅ Buscar SOLO por email
        estudiante = usuarios.find_one({
            'correo': student_email,
            'rol': 'estudiante',
            'activo': True
        })
        
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        # Crear PDF en memoria
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Encabezado
        p.setFont("Helvetica-Bold", 24)
        p.drawCentredString(width / 2, height - inch, "CERTIFICADO DE ESTUDIOS")
        
        # Información del estudiante
        p.setFont("Helvetica", 12)
        y_position = height - 2 * inch
        
        p.drawString(inch, y_position, f"Nombre: {estudiante.get('nombres')} {estudiante.get('apellidos')}")
        y_position -= 0.5 * inch
        
        p.drawString(inch, y_position, f"Código: {estudiante.get('codigo_est')}")
        y_position -= 0.5 * inch
        
        p.drawString(inch, y_position, f"Documento: {estudiante.get('tipo_doc')} {estudiante.get('documento')}")
        y_position -= 0.5 * inch
        
        p.drawString(inch, y_position, f"Correo: {estudiante.get('correo')}")
        y_position -= inch
        
        # Texto del certificado
        p.setFont("Helvetica", 11)
        texto = f"""
        La institución educativa certifica que el/la estudiante {estudiante.get('nombres')} 
        {estudiante.get('apellidos')}, identificado(a) con {estudiante.get('tipo_doc')} 
        {estudiante.get('documento')}, se encuentra actualmente matriculado(a) en nuestra 
        institución.
        """
        
        for line in texto.strip().split('\n'):
            p.drawString(inch, y_position, line.strip())
            y_position -= 0.3 * inch
        
        # Fecha
        p.drawString(inch, y_position - inch, f"Fecha de expedición: {datetime.now().strftime('%d/%m/%Y')}")
        
        # Finalizar PDF
        p.showPage()
        p.save()
        
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'certificado_{tipo}_{estudiante.get("codigo_est")}.pdf'
        )
        
    except Exception as e:
        print(f"❌ Error en download_certificado: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/student/boletin', methods=['GET'])
@token_required('estudiante')
def download_boletin():
    """Generar boletín de calificaciones en PDF filtrado por periodo"""
    try:
        # Obtener parámetros
        periodo = request.args.get('periodo', '1')
        
        # Obtener email del token
        student_email = g.userinfo.get('email') or g.userinfo.get('preferred_username')
        
        if not student_email:
            return jsonify({'success': False, 'error': 'Email no encontrado en el token'}), 400
        
        usuarios = get_usuarios_collection()
        
        # Buscar estudiante por email
        estudiante = usuarios.find_one({
            'correo': student_email,
            'rol': 'estudiante',
            'activo': True
        })
        
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        print(f"✅ Generando boletín para: {estudiante.get('nombres')} {estudiante.get('apellidos')}")
        print(f"📅 Periodo: {periodo}")
        
        matriculas = get_matriculas_collection()
        
        # ✅ Obtener matrícula del estudiante
        matricula = matriculas.find_one({
            'id_estudiante': estudiante['_id'],
            'estado': 'activa',
            'anio_lectivo': '2025'
        })
        
        if not matricula:
            return jsonify({'success': False, 'error': 'No se encontró matrícula activa'}), 404
        
        print(f"✅ Matrícula encontrada")
        
        # Crear PDF en memoria
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Encabezado
        p.setFont("Helvetica-Bold", 20)
        p.drawCentredString(width / 2, height - inch, "BOLETÍN DE CALIFICACIONES")
        
        # Información del estudiante
        p.setFont("Helvetica", 12)
        y_position = height - 1.5 * inch
        
        p.drawString(inch, y_position, f"Estudiante: {estudiante.get('nombres')} {estudiante.get('apellidos')}")
        y_position -= 0.4 * inch
        
        p.drawString(inch, y_position, f"Código: {estudiante.get('codigo_est')}")
        y_position -= 0.4 * inch
        
        grupo_info = matricula.get('grupo_info', {})
        p.drawString(inch, y_position, f"Grupo: {grupo_info.get('nombre_grupo', 'N/A')} - Grado {grupo_info.get('grado', 'N/A')}°")
        y_position -= 0.4 * inch
        
        p.drawString(inch, y_position, f"Periodo Académico: {periodo}")
        y_position -= 0.4 * inch
        
        p.drawString(inch, y_position, f"Año Lectivo: 2025")
        y_position -= 0.8 * inch
        
        # Tabla de calificaciones - Encabezados
        p.setFont("Helvetica-Bold", 11)
        p.drawString(inch, y_position, "Materia")
        p.drawString(3.5 * inch, y_position, "Promedio")
        p.drawString(4.5 * inch, y_position, "Estado")
        y_position -= 0.05 * inch
        
        # Línea separadora
        p.line(inch, y_position, 6 * inch, y_position)
        y_position -= 0.3 * inch
        
        p.setFont("Helvetica", 10)
        
        # ✅ CAMBIO: Procesar calificaciones por asignación
        calificaciones_raw = matricula.get('calificaciones', [])
        
        print(f"📊 Total de asignaciones con calificaciones: {len(calificaciones_raw)}")
        
        total_promedio = 0
        count_materias = 0
        
        from database.db_config import get_asignaciones_collection
        asignaciones = get_asignaciones_collection()
        
        for cal_asignacion in calificaciones_raw:
            # ✅ FILTRAR POR PERIODO A NIVEL DE ASIGNACIÓN
            periodo_asignacion = cal_asignacion.get('periodo', '1')
            
            if periodo_asignacion != periodo:
                continue  # Saltar si no es el periodo seleccionado
            
            id_asignacion = cal_asignacion.get('id_asignacion')
            notas = cal_asignacion.get('notas', [])
            
            if not notas:
                continue  # Saltar si no hay notas
            
            # Obtener información de la asignación (curso)
            asignacion = asignaciones.find_one({'_id': id_asignacion})
            
            if not asignacion:
                continue
            
            curso_info = asignacion.get('curso_info', {})
            nombre_curso = curso_info.get('nombre_curso', 'N/A')
            
            # Calcular promedio ponderado de las notas
            total = sum(n.get('nota', 0) * n.get('peso', 0) for n in notas)
            total_peso = sum(n.get('peso', 0) for n in notas)
            promedio = round(total / total_peso, 2) if total_peso > 0 else 0
            
            estado = 'Aprobado' if promedio >= 3.0 else 'Reprobado'
            
            # Verificar si hay espacio suficiente en la página
            if y_position < 2 * inch:
                p.showPage()
                p.setFont("Helvetica", 10)
                y_position = height - inch
            
            # Dibujar fila
            p.drawString(inch, y_position, nombre_curso)
            p.drawString(3.5 * inch, y_position, f"{promedio:.2f}")
            
            # Color del estado
            if promedio >= 3.0:
                p.setFillColorRGB(0, 0.5, 0)  # Verde
            else:
                p.setFillColorRGB(0.8, 0, 0)  # Rojo
            
            p.drawString(4.5 * inch, y_position, estado)
            p.setFillColorRGB(0, 0, 0)  # Volver a negro
            
            y_position -= 0.3 * inch
            
            total_promedio += promedio
            count_materias += 1
        
        # Promedio general del periodo
        y_position -= 0.5 * inch
        
        if count_materias > 0:
            promedio_general = total_promedio / count_materias
            
            # Línea separadora
            p.line(inch, y_position, 6 * inch, y_position)
            y_position -= 0.4 * inch
            
            p.setFont("Helvetica-Bold", 12)
            p.drawString(inch, y_position, f"Promedio General del Periodo {periodo}:")
            p.drawString(3.5 * inch, y_position, f"{promedio_general:.2f}")
            
            # Estado general
            estado_general = 'APROBADO' if promedio_general >= 3.0 else 'REPROBADO'
            if promedio_general >= 3.0:
                p.setFillColorRGB(0, 0.5, 0)
            else:
                p.setFillColorRGB(0.8, 0, 0)
            
            p.drawString(4.5 * inch, y_position, estado_general)
            p.setFillColorRGB(0, 0, 0)
            
            print(f"✅ Promedio general: {promedio_general:.2f}")
            print(f"✅ Materias procesadas: {count_materias}")
        else:
            p.setFont("Helvetica", 11)
            p.drawString(inch, y_position, f"No hay calificaciones registradas para el periodo {periodo}")
            print(f"⚠️ No se encontraron calificaciones para el periodo {periodo}")
        
        # Fecha de expedición
        p.setFont("Helvetica", 10)
        p.drawString(inch, inch, f"Fecha de expedición: {datetime.now().strftime('%d/%m/%Y')}")
        
        # Firmas
        y_firma = 1.5 * inch
        p.line(inch, y_firma, 2.5 * inch, y_firma)
        p.drawString(inch, y_firma - 0.3 * inch, "Director de Grupo")
        
        p.line(3.5 * inch, y_firma, 5 * inch, y_firma)
        p.drawString(3.5 * inch, y_firma - 0.3 * inch, "Coordinador Académico")
        
        # Finalizar PDF
        p.showPage()
        p.save()
        
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'boletin_periodo_{periodo}_{estudiante.get("codigo_est")}.pdf'
        )
        
    except Exception as e:
        print(f"❌ Error en download_boletin: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/students', methods=['GET'])
def get_students():
    """Obtener todos los estudiantes"""
    try:
        usuarios = get_usuarios_collection()
        
        # Filtros opcionales
        grado = request.args.get('grado') or request.args.get('grade')
        status = request.args.get('status')
        
        # Construir query
        query = {'rol': 'estudiante'}
        
        if status:
            query['activo'] = (status.lower() == 'active')
        
        # Buscar estudiantes
        estudiantes = list(usuarios.find(query))
        
        # Serializar documentos
        estudiantes_serializados = serialize_doc(estudiantes)
        
        return jsonify({
            'success': True,
            'data': estudiantes_serializados,
            'count': len(estudiantes_serializados)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/students/<student_id>', methods=['GET'])
def get_student(student_id):
    """Obtener un estudiante por ID"""
    try:
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(student_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Buscar estudiante
        estudiante = usuarios.find_one({'_id': obj_id, 'rol': 'estudiante'})
        
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        return jsonify({
            'success': True,
            'data': serialize_doc(estudiante)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/students', methods=['POST'])
def create_student():
    """Crear un nuevo estudiante"""
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
        
        # Crear documento del estudiante
        nuevo_estudiante = {
            'correo': data['correo'],
            'rol': 'estudiante',
            'nombres': data['nombres'],
            'apellidos': data['apellidos'],
            'creado_en': Timestamp(int(datetime.utcnow().timestamp()), 0),
            'activo': data.get('activo', True)
        }
        
        # Campos opcionales específicos de estudiante
        if 'codigo_est' in data:
            nuevo_estudiante['codigo_est'] = data['codigo_est']
        if 'fecha_nacimiento' in data:
            nuevo_estudiante['fecha_nacimiento'] = datetime.fromisoformat(data['fecha_nacimiento'].replace('Z', '+00:00'))
        if 'direccion' in data:
            nuevo_estudiante['direccion'] = data['direccion']
        if 'telefono' in data:
            nuevo_estudiante['telefono'] = data['telefono']
        if 'nombre_acudiente' in data:
            nuevo_estudiante['nombre_acudiente'] = data['nombre_acudiente']
        if 'telefono_acudiente' in data:
            nuevo_estudiante['telefono_acudiente'] = data['telefono_acudiente']
        
        # Insertar en la base de datos
        resultado = usuarios.insert_one(nuevo_estudiante)
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='crear_estudiante',
            entidad_afectada='usuarios',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Estudiante creado: {data['nombres']} {data['apellidos']}"
        )
        
        # Obtener el documento insertado
        estudiante_creado = usuarios.find_one({'_id': resultado.inserted_id})
        
        return jsonify({
            'success': True,
            'message': 'Estudiante creado exitosamente',
            'data': serialize_doc(estudiante_creado)
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/students/<student_id>', methods=['PUT'])
def update_student(student_id):
    """Actualizar un estudiante"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(student_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el estudiante existe
        estudiante_existente = usuarios.find_one({'_id': obj_id, 'rol': 'estudiante'})
        if not estudiante_existente:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        # Preparar datos para actualizar
        campos_no_modificables = {'_id', 'rol', 'creado_en', 'correo'}
        datos_actualizacion = {k: v for k, v in data.items() if k not in campos_no_modificables}
        
        # Convertir fecha_nacimiento si viene en el request
        if 'fecha_nacimiento' in datos_actualizacion:
            datos_actualizacion['fecha_nacimiento'] = datetime.fromisoformat(
                datos_actualizacion['fecha_nacimiento'].replace('Z', '+00:00')
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
                accion='actualizar_estudiante',
                entidad_afectada='usuarios',
                id_entidad=student_id,
                detalles=f"Campos actualizados: {', '.join(datos_actualizacion.keys())}"
            )
            
            # Obtener documento actualizado
            estudiante_actualizado = usuarios.find_one({'_id': obj_id})
            
            return jsonify({
                'success': True,
                'message': 'Estudiante actualizado exitosamente',
                'data': serialize_doc(estudiante_actualizado)
            }), 200
        else:
            return jsonify({
                'success': True,
                'message': 'No se realizaron cambios',
                'data': serialize_doc(estudiante_existente)
            }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/students/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    """Eliminar (desactivar) un estudiante"""
    try:
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(student_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el estudiante existe
        estudiante = usuarios.find_one({'_id': obj_id, 'rol': 'estudiante'})
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado'}), 404
        
        # Desactivar
        resultado = usuarios.update_one(
            {'_id': obj_id},
            {'$set': {'activo': False}}
        )
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='desactivar_estudiante',
            entidad_afectada='usuarios',
            id_entidad=student_id,
            detalles=f"Estudiante desactivado: {estudiante['nombres']} {estudiante['apellidos']}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Estudiante desactivado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/students/<student_id>/grades', methods=['GET'])
def get_student_grades(student_id):
    """Obtener calificaciones de un estudiante"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(student_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Buscar matrículas del estudiante
        student_matriculas = list(matriculas.find({'id_estudiante': obj_id}))
        
        return jsonify({
            'success': True,
            'data': serialize_doc(student_matriculas),
            'count': len(student_matriculas)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/students/<student_id>/enrollments', methods=['GET'])
def get_student_enrollments(student_id):
    """Obtener inscripciones de un estudiante"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(student_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Buscar matrículas activas del estudiante
        enrollments = list(matriculas.find({
            'id_estudiante': obj_id,
            'estado': 'activa'
        }))
        
        return jsonify({
            'success': True,
            'data': serialize_doc(enrollments),
            'count': len(enrollments)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Manejo de errores
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

# ...existing code...

@app.route('/student/certificado/<tipo>', methods=['GET'])
def generar_certificado_estudiante(tipo):
    """Generar certificado para el estudiante autenticado"""
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header:
            return jsonify({'error': 'No autenticado'}), 401
        
        estudiante_id = request.args.get('student_id', '673df46bfaf2a31cb63b0bbd')
        
        usuarios = get_usuarios_collection()
        estudiante = usuarios.find_one({'_id': string_to_objectid(estudiante_id)})
        
        if not estudiante:
            return jsonify({'error': 'Estudiante no encontrado'}), 404
        
        if tipo == 'estudios':
            data = {
                'estudiante': {
                    'nombre': estudiante.get('nombres', 'N/A') + ' ' + estudiante.get('apellidos', ''),
                    'codigo': estudiante_id,
                    'documento': estudiante.get('documento', '1234567890')
                },
                'institucion': {
                    'nombre': 'Institución Educativa El Pórtico',
                    'nit': '900.123.456-7',
                    'direccion': 'Calle 123 #45-67, Bogotá D.C.'
                },
                'grado': '10° A',
                'periodo': '2024-2025'
            }
            
            pdf_buffer = PDFGenerator.generar_certificado_estudios(data)
            
            return send_file(
                pdf_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'certificado_estudios_{estudiante_id}.pdf'
            )
        
        else:
            return jsonify({'error': 'Tipo de certificado no válido'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/student/boletin', methods=['GET'])
def generar_boletin_estudiante():
    """Generar boletín de calificaciones"""
    try:
        estudiante_id = request.args.get('student_id', '673df46bfaf2a31cb63b0bbd')
        periodo = request.args.get('periodo', 'Periodo 1')
        
        usuarios = get_usuarios_collection()
        estudiante = usuarios.find_one({'_id': string_to_objectid(estudiante_id)})
        
        if not estudiante:
            return jsonify({'error': 'Estudiante no encontrado'}), 404
        
        data = {
            'estudiante': {
                'nombre': estudiante.get('nombres', 'N/A') + ' ' + estudiante.get('apellidos', ''),
                'codigo': estudiante_id
            },
            'periodo': periodo,
            'materias': [
                {'nombre': 'Matemáticas', 'nota1': 4.2, 'nota2': 3.8, 'nota3': 4.5, 'promedio': 4.17},
                {'nombre': 'Español', 'nota1': 4.5, 'nota2': 4.2, 'nota3': 4.8, 'promedio': 4.5},
                {'nombre': 'Ciencias', 'nota1': 3.5, 'nota2': 4.0, 'nota3': 3.8, 'promedio': 3.77},
                {'nombre': 'Sociales', 'nota1': 4.0, 'nota2': 4.3, 'nota3': 4.1, 'promedio': 4.13},
            ],
            'promedio_general': 4.14
        }
        
        pdf_buffer = PDFGenerator.generar_boletin_notas(data)
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'boletin_{estudiante_id}_{periodo}.pdf'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ...existing code...


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)