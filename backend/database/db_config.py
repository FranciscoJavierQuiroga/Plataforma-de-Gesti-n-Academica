from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
import os
from contextlib import contextmanager
from bson import ObjectId
from bson.timestamp import Timestamp
from datetime import datetime
import requests


class DatabaseConfig:
    """Configuración centralizada para la conexión a MongoDB"""

    MONGO_URI = os.getenv("MONGO_URI", "")
    DB_NAME = os.getenv("MONGO_DB_NAME", "colegio")

    if not MONGO_URI:
        DB_USER = os.getenv("MONGO_USER", "")
        DB_PASSWORD = os.getenv("MONGO_PASSWORD", "")
        DB_HOST = os.getenv("MONGO_HOST", "localhost")
        DB_PORT = os.getenv("MONGO_PORT", "27017")

        if DB_USER and DB_PASSWORD:
            MONGO_URI = f"mongodb://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?authSource=admin"
        else:
            MONGO_URI = f"mongodb://{DB_HOST}:{DB_PORT}/{DB_NAME}"

    # Cliente de MongoDB
    client = None
    db = None

    @classmethod
    def initialize_connection(cls):
        """Inicializa la conexión a MongoDB"""
        try:
            cls.client = MongoClient(cls.MONGO_URI, serverSelectionTimeoutMS=5000)
            # Verificar conexión
            cls.client.admin.command("ping")
            cls.db = cls.client[cls.DB_NAME]
            print(f"✓ Conexión a MongoDB establecida exitosamente")
            print(f"✓ Base de datos: {cls.DB_NAME}")
            return cls.db
        except ConnectionFailure as error:
            print(f"✗ Error al conectar con MongoDB: {error}")
            raise

    @classmethod
    def get_db(cls):
        """Obtiene la instancia de la base de datos"""
        if cls.db is None:
            cls.initialize_connection()
        return cls.db

    @classmethod
    def close_connection(cls):
        """Cierra la conexión a MongoDB"""
        if cls.client:
            cls.client.close()
            print("✓ Conexión a MongoDB cerrada")

    @classmethod
    def get_collection(cls, collection_name):
        """Obtiene una colección específica"""
        db = cls.get_db()
        return db[collection_name]


# Funciones de ayuda para operaciones comunes


def get_usuarios_collection():
    """Obtiene la colección de usuarios"""
    return DatabaseConfig.get_collection("usuarios")


def get_cursos_collection():
    """Obtiene la colección de cursos"""
    return DatabaseConfig.get_collection("cursos")


def get_matriculas_collection():
    """Obtiene la colección de matrículas"""
    return DatabaseConfig.get_collection("matriculas")


def get_reportes_collection():
    """Obtiene la colección de reportes"""
    return DatabaseConfig.get_collection("reportes")


def get_certificados_collection():
    """Obtiene la colección de certificados"""
    return DatabaseConfig.get_collection("certificados")


def get_auditoria_collection():
    """Obtiene la colección de auditoría"""
    return DatabaseConfig.get_collection("auditoria")


def get_asistencia_collection():
    """Obtener la colección de asistencia"""
    return DatabaseConfig.get_collection("asistencia")


# Agregar después de get_asistencia_collection():


def get_observaciones_collection():
    """Obtener la colección de observaciones"""
    return DatabaseConfig.get_collection("observaciones")


def get_groups_collection():
    """Obtener la coleccion de grupos"""
    return DatabaseConfig.get_collection("grupos")


def get_horarios_collection():
    """Obtener coleccion de horarios"""
    return DatabaseConfig.get_collection("horarios")


def get_asignaciones_collection():
    """Obtener coleccion de asignaciones docentes"""
    return DatabaseConfig.get_collection("asignaciones_docentes")


# Funciones de utilidad para conversión de datos
def serialize_doc(doc):
    """Convierte un documento MongoDB a formato JSON serializable"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, Timestamp):
                # Convertir Timestamp a datetime y luego a ISO string
                result[key] = datetime.fromtimestamp(value.time).isoformat()
            elif isinstance(value, (dict, list)):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc


def string_to_objectid(id_string):
    """Convierte un string a ObjectId de MongoDB"""
    try:
        if isinstance(id_string, ObjectId):
            return id_string
        return ObjectId(id_string)
    except:
        return None


def registrar_auditoria(
    id_usuario,
    accion,
    entidad_afectada,
    id_entidad=None,
    detalles=None,
    ip_address=None,
):
    """Registra una acción en el log de auditoría

    Args:
        id_usuario: ID del usuario que realiza la acción (puede ser None para acciones del sistema)
        accion: Tipo de acción realizada (crear, actualizar, eliminar, etc.)
        entidad_afectada: Nombre de la colección afectada
        id_entidad: ID del documento afectado (opcional)
        detalles: Información adicional sobre la acción (opcional)
        ip_address: Dirección IP del usuario (opcional)
    """
    try:
        from bson import ObjectId
        from bson.timestamp import Timestamp
        import time

        auditoria = get_auditoria_collection()

        # Convertir id_usuario a ObjectId si es necesario
        if id_usuario is None:
            # Usar un ObjectId especial para acciones del sistema
            id_usuario_obj = ObjectId("000000000000000000000000")
        elif isinstance(id_usuario, str):
            try:
                id_usuario_obj = ObjectId(id_usuario)
            except:
                id_usuario_obj = ObjectId("000000000000000000000000")
        else:
            id_usuario_obj = id_usuario

        # Convertir id_entidad a ObjectId si es necesario
        id_entidad_obj = None
        if id_entidad is not None:
            if isinstance(id_entidad, str):
                try:
                    id_entidad_obj = ObjectId(id_entidad)
                except:
                    id_entidad_obj = None
            elif isinstance(id_entidad, ObjectId):
                id_entidad_obj = id_entidad

        # Convertir datetime a Timestamp de MongoDB
        timestamp_actual = Timestamp(int(time.time()), 1)

        log = {
            "id_usuario": id_usuario_obj,
            "accion": accion,
            "entidad_afectada": entidad_afectada,
            "fecha": timestamp_actual,
            "detalles": detalles or {},
        }

        # Solo agregar id_entidad si no es None
        if id_entidad_obj is not None:
            log["id_entidad"] = id_entidad_obj

        # Solo agregar IP si está disponible
        if ip_address is not None:
            log["ip"] = ip_address

        auditoria.insert_one(log)

    except Exception as e:
        print(f"Error al registrar auditoría: {e}")
